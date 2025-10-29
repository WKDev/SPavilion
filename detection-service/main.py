import shutil
import sys
import traceback
import cv2
import numpy as np
import time
import os
import requests
import subprocess
from datetime import datetime
# Conditional imports for detection
if os.getenv('USE_DETECTION', 'false').lower() == 'true':
    from ultralytics import YOLO
    import torch

# GStreamer imports (PyGObject)
try:
    import gi
    gi.require_version('Gst', '1.0')
    from gi.repository import Gst, GLib
    Gst.init(None)
    GST_AVAILABLE = True
except (ImportError, ValueError) as e:
    print(f"Warning: PyGObject/GStreamer not available: {e}")
    GST_AVAILABLE = False

# Extract variables for backward compatibility
MOCK_MODE = os.getenv('MOCK_MODE', 'true')
MOCK_VIDEO_FILE = os.getenv('MOCK_VIDEO_FILE', 'test-video.mp4')
API_URL = os.getenv('API_URL', 'http://localhost:3000')
RTSP_URL = os.getenv('RTSP_URL', 'rtsp://localhost:8554/camera')
CAMERA_INDEX = int(os.getenv('CAMERA_INDEX', '0'))
CELL_SIZE = int(os.getenv('CELL_SIZE', '32'))
POST_INTERVAL = int(os.getenv('POST_INTERVAL', '30'))
USE_GSTREAMER = os.getenv('USE_GSTREAMER', 'false')
USE_DETECTION = os.getenv('USE_DETECTION', 'false')

# Global variables
model = None
camera = None
frame_count = 0
camera_width = 640
camera_height = 480
video_fps = 29.97  # Default FPS for mock video


class GStreamerWriter:
    """GStreamer-based RTSP writer using PyGObject"""

    def __init__(self, rtsp_url, width, height, fps):
        if not GST_AVAILABLE:
            raise RuntimeError("PyGObject/GStreamer is not available")

        self.rtsp_url = rtsp_url
        self.width = width
        self.height = height
        self.fps = fps
        self.pipeline = None
        self.appsrc = None
        self.is_playing = False

    def start(self):
        """Initialize and start the GStreamer pipeline"""
        try:
            # Create pipeline string
            # appsrc -> videoconvert -> x264enc -> rtph264pay -> rtspclientsink
            pipeline_str = (
                f"appsrc name=source is-live=true format=time "
                f"caps=video/x-raw,format=BGR,width={self.width},height={self.height},framerate={int(self.fps)}/1 ! "
                f"videoconvert ! "
                f"video/x-raw,format=I420 ! "
                f"x264enc tune=zerolatency bitrate=2000 speed-preset=superfast key-int-max=60 ! "
                f"video/x-h264,profile=baseline ! "
                f"rtph264pay config-interval=1 pt=96 ! "
                f"rtspclientsink location={self.rtsp_url} protocols=tcp"
            )

            print(f"Creating GStreamer pipeline: {pipeline_str}")

            # Parse and create pipeline
            self.pipeline = Gst.parse_launch(pipeline_str)

            # Get appsrc element
            self.appsrc = self.pipeline.get_by_name("source")
            if not self.appsrc:
                raise RuntimeError("Failed to get appsrc element")

            # Set appsrc properties
            self.appsrc.set_property("format", Gst.Format.TIME)
            self.appsrc.set_property("block", False)

            # Connect to bus for error messages
            bus = self.pipeline.get_bus()
            bus.add_signal_watch()
            bus.connect("message::error", self._on_error)
            bus.connect("message::warning", self._on_warning)
            bus.connect("message::eos", self._on_eos)

            # Start pipeline
            ret = self.pipeline.set_state(Gst.State.PLAYING)
            if ret == Gst.StateChangeReturn.FAILURE:
                raise RuntimeError("Failed to set pipeline to PLAYING state")

            self.is_playing = True
            print("GStreamer pipeline started successfully")
            return True

        except Exception as e:
            print(f"Error starting GStreamer pipeline: {e}")
            self.cleanup()
            return False

    def _on_error(self, bus, message):
        """Handle error messages from GStreamer"""
        err, debug = message.parse_error()
        print(f"GStreamer Error: {err}")
        print(f"Debug info: {debug}")
        self.is_playing = False

    def _on_warning(self, bus, message):
        """Handle warning messages from GStreamer"""
        warn, debug = message.parse_warning()
        print(f"GStreamer Warning: {warn}")

    def _on_eos(self, bus, message):
        """Handle end-of-stream"""
        print("GStreamer: End of stream")
        self.is_playing = False

    def write_frame(self, frame):
        """Push a frame to the pipeline"""
        if not self.is_playing or not self.appsrc:
            return False

        try:
            # Convert numpy array to GStreamer buffer
            data = frame.tobytes()
            buf = Gst.Buffer.new_wrapped(data)

            # Push buffer to appsrc
            ret = self.appsrc.emit("push-buffer", buf)

            if ret != Gst.FlowReturn.OK:
                print(f"Error pushing buffer: {ret}")
                return False

            return True

        except Exception as e:
            print(f"Error writing frame: {e}")
            return False

    def cleanup(self):
        """Stop and cleanup the pipeline"""
        if self.pipeline:
            # Send EOS
            if self.appsrc:
                self.appsrc.emit("end-of-stream")

            # Stop pipeline
            self.pipeline.set_state(Gst.State.NULL)
            self.pipeline = None
            self.appsrc = None
            self.is_playing = False
            print("GStreamer pipeline cleaned up")


def check_gpu_availability():
    """Check GPU and CUDA availability when detection is enabled"""
    if USE_DETECTION == 'true':
        print("\n" + "=" * 60)
        print("GPU AND CUDA AVAILABILITY CHECK")
        print("=" * 60)
        
        try:
            # Check if PyTorch is available
            print(f"PyTorch version: {torch.__version__}")
            
            # Check CUDA availability
            cuda_available = torch.cuda.is_available()
            print(f"CUDA available: {cuda_available}")
            
            if cuda_available:
                print(f"CUDA version: {torch.version.cuda}")
                print(f"Number of GPUs: {torch.cuda.device_count()}")
                
                for i in range(torch.cuda.device_count()):
                    gpu_name = torch.cuda.get_device_name(i)
                    gpu_memory = torch.cuda.get_device_properties(i).total_memory / (1024**3)  # GB
                    print(f"  GPU {i}: {gpu_name} ({gpu_memory:.1f} GB)")
                
                # Set device
                device = torch.device('cuda' if cuda_available else 'cpu')
                print(f"Using device: {device}")
            else:
                print("CUDA not available - will use CPU for inference")
                print("Make sure NVIDIA drivers and CUDA toolkit are installed")
                
        except Exception as e:
            print(f"Error checking GPU availability: {e}")
            print("PyTorch or CUDA may not be properly installed")
        
        print("=" * 60)
    else:
        print("\nGPU detection skipped (USE_DETECTION=false)")


def print_environment_variables():
    """Print all environment variables at startup"""
    print("=" * 60)
    print("ENVIRONMENT VARIABLES")
    print("=" * 60)

    print(f"MOCK_MODE: {MOCK_MODE}")
    print(f"MOCK_VIDEO_FILE: {MOCK_VIDEO_FILE}")
    print(f"API_URL: {API_URL}")
    print(f"RTSP_URL: {RTSP_URL}")
    print(f"CAMERA_INDEX: {CAMERA_INDEX}")
    print(f"CELL_SIZE: {CELL_SIZE}")
    print(f"POST_INTERVAL: {POST_INTERVAL}")
    print(f"USE_GSTREAMER: {USE_GSTREAMER}")
    print(f"USE_DETECTION: {USE_DETECTION}")
    print("=" * 60)


def check_dependencies():
    """Check if GStreamer and FFmpeg are installed and print version info"""
    print("\n" + "=" * 60)
    print("DEPENDENCY CHECK")
    print("=" * 60)

    # Check PyGObject/GStreamer
    if GST_AVAILABLE:
        print("PyGObject (GStreamer Python bindings): Installed")
        try:
            print(f"  GStreamer version: {Gst.version_string()}")
            print(f"  PyGObject version: {gi.__version__}")
        except Exception as e:
            print(f"  Version info error: {e}")
    else:
        print("PyGObject (GStreamer Python bindings): NOT INSTALLED")
        print("  Warning: GStreamer via PyGObject will not be available")

    # Check GStreamer CLI (for reference)
    gst_path = shutil.which('gst-launch-1.0')
    if gst_path:
        print("GStreamer (gst-launch-1.0): \u2713 Installed")
        print(f"  Path: {gst_path}")
        try:
            result = subprocess.run(
                ['gst-launch-1.0', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                # Extract version from output (first line usually contains version)
                version_line = result.stdout.split('\n')[0]
                print(f"  {version_line}")
        except Exception as e:
            print(f"  Version check failed: {e}")
    else:
        print("GStreamer (gst-launch-1.0): \u2717 NOT INSTALLED")
        print("  Warning: RTSP streaming via GStreamer will not be available")

    # Check FFmpeg
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        print("\nFFmpeg: \u2713 Installed")
        print(f"  Path: {ffmpeg_path}")
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                # Extract version from output (first line usually contains version)
                version_line = result.stdout.split('\n')[0]
                print(f"  {version_line}")
        except Exception as e:
            print(f"  Version check failed: {e}")
    else:
        print("\nFFmpeg: \u2717 NOT INSTALLED")
        print("  Warning: RTSP streaming via FFmpeg will not be available")

    print("=" * 60)

    # Determine streaming availability
    if USE_GSTREAMER == 'true':
        if GST_AVAILABLE:
            print("\nStreaming will use: GStreamer (PyGObject)")
        else:
            print("\nWARNING: USE_GSTREAMER is set to 'true' but PyGObject is not available!")
            print("Please install PyGObject/GStreamer or set USE_GSTREAMER to 'false' to use FFmpeg.")
    else:
        if ffmpeg_path:
            print("\nStreaming will use: FFmpeg")
        else:
            print("\nWARNING: USE_GSTREAMER is set to 'false' but FFmpeg is not installed!")
            print("Please install FFmpeg or set USE_GSTREAMER to 'true' to use GStreamer.")

    print()


def load_yolo_model():
    """Load YOLOv8n model for person detection"""
    if USE_DETECTION == 'true':
        global model
        print("Loading YOLOv8n model...")
        try:
            # Load model
            model = YOLO('yolov8n.pt')
            
            # Check if CUDA is available and set device
            if torch.cuda.is_available():
                device = 'cuda'
                print(f"YOLOv8n model loaded successfully on GPU")
            else:
                device = 'cpu'
                print(f"YOLOv8n model loaded successfully on CPU")
            
            # Move model to device
            model.to(device)
            print(f"Model device: {device}")
            
            return True
        except Exception as e:
            print(f"Error loading YOLOv8n model: {e}")
            return False
    else:
        print("YOLOv8n model not used (USE_DETECTION=false)")
        return True


def init_camera():
    """Initialize camera with retry logic"""
    global camera, camera_width, camera_height, video_fps

    while True:
        try:
            if MOCK_MODE == 'true':
                print(f"Attempting to open mock video file: {MOCK_VIDEO_FILE}")
                video_file = MOCK_VIDEO_FILE
                camera = cv2.VideoCapture(video_file, )
                camera.set(cv2.CAP_PROP_POS_FRAMES, 0)
                
                # Get actual video dimensions and FPS
                camera_width = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH))
                camera_height = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
                video_fps = camera.get(cv2.CAP_PROP_FPS)
                    
                print(f"Video dimensions: {camera_width}x{camera_height}")
                print(f"Video FPS: {video_fps}")

                
                
                return True
            else:
                print(f"Attempting to open camera at index {CAMERA_INDEX}...")
                camera = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_V4L2)

                if not camera.isOpened():
                    raise Exception("Failed to open camera")


                camera.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'YUYV'))
                camera.set(cv2.CAP_PROP_FPS, 15)
                time.sleep(2.0)

                # Get actual camera dimensions and FPS (don't force specific resolution)
                camera_width = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH))
                camera_height = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
                video_fps = camera.get(cv2.CAP_PROP_FPS)
                
                    
                print(f"Camera opened successfully: {camera_width}x{camera_height}@{video_fps}fps")
                
                
                
                print(f"Camera capabilities:")
                print(f"  - Max width: {int(camera.get(cv2.CAP_PROP_FRAME_WIDTH))}")
                print(f"  - Max height: {int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT))}")
                print(f"  - Current FPS: {camera.get(cv2.CAP_PROP_FPS)}")
                
                return True

        except Exception as e:
            print(f"Error opening camera: {e}")
            print("Retrying in 1 second...")
            if camera is not None:
                camera.release()
                camera = None
            time.sleep(1)


def init_gstreamer_writer():
    """Initialize GStreamer pipeline for RTSP streaming via PyGObject"""
    global camera_width, camera_height, video_fps

    if not GST_AVAILABLE:
        print("PyGObject/GStreamer is not available. Cannot create GStreamer writer.")
        return None

    try:
        writer = GStreamerWriter(RTSP_URL, camera_width, camera_height, video_fps)
        if writer.start():
            print(f"GStreamer (PyGObject) RTSP pipeline initialized: {RTSP_URL}")
            print(f"  Resolution: {camera_width}x{camera_height}@{video_fps:.2f}fps")
            return writer
        else:
            print("Failed to start GStreamer pipeline")
            return None

    except Exception as e:
        print(f"Error initializing GStreamer pipeline: {e}")
        print("Tip: Ensure GStreamer and gst-plugins-good/bad/ugly are installed")
        return None


def init_ffmpeg_writer():
    """Initialize FFmpeg process for RTSP streaming"""
    global camera_width, camera_height, video_fps

    # check if ffmpeg is installed
    if not shutil.which('ffmpeg'):
        print("FFmpeg is not installed. Please install FFmpeg and try again.")
        return None

    ffmpeg_cmd = [
        'ffmpeg',
        '-y',  # overwrite output files
        '-loglevel', 'warning',  # Show warnings and errors
        '-f', 'rawvideo',
        '-vcodec', 'rawvideo',
        '-pix_fmt', 'bgr24',
        '-s', f'{camera_width}x{camera_height}',
        '-r', f'{video_fps:.2f}',  # Use actual video FPS
        '-fflags', '+genpts',  # Generate presentation timestamps
        '-i', '-',  # read from stdin
        # Video encoding settings
        '-c:v', 'libx264',
        '-preset', 'ultrafast',  # Use ultrafast for lower latency
        '-tune', 'zerolatency',
        '-profile:v', 'baseline',
        '-g', '60',  # Keyframe interval
        '-b:v', '2000k',  # Bitrate
        '-maxrate', '2000k',
        '-bufsize', '4000k',
        '-pix_fmt', 'yuv420p',
        # Disable audio
        '-an',
        # RTSP output settings
        '-f', 'rtsp',
        '-rtsp_transport', 'tcp',  # Use TCP for more reliable connection
        '-timeout', '5000000',  # 5 second timeout in microseconds
        RTSP_URL
    ]

    try:
        ffmpeg_process = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE  # Capture stderr separately
        )
        print(f"FFmpeg RTSP pipeline initialized: {RTSP_URL}")
        print(f"  Resolution: {camera_width}x{camera_height}@{video_fps:.2f}fps")
        print(f"  Transport: TCP")
        print(f"  Command: {' '.join(ffmpeg_cmd)}")
        
        # Give FFmpeg a moment to start and check if it's still running
        time.sleep(1.0)  # Increased wait time for better stability
        if ffmpeg_process.poll() is not None:
            _, stderr = ffmpeg_process.communicate()
            print(f"FFmpeg process failed to start. Exit code: {ffmpeg_process.returncode}")
            if stderr:
                print(f"FFmpeg error output:")
                print(stderr.decode())
            return None
            
        return ffmpeg_process
    except Exception as e:
        print(f"Error initializing FFmpeg pipeline: {e}")
        return None


def send_bbox_to_api(bboxes: list[dict]):
    """Send bounding box data to NestJS backend API"""
    try:
        payload = {
            'bboxes': bboxes,
            'frame_count': int(frame_count),
            'camera_id': f'camera_{CAMERA_INDEX}'
        }

        response = requests.post(
            f"{API_URL}/api/bbox_history",
            json=payload,
            timeout=2
        )

        if response.status_code == 201:
            print(f"Bbox data sent successfully (frame {frame_count})")
        else:
            print(f"API response error: {response.status_code}")

    except requests.exceptions.RequestException as e:
        print(f"Error sending bbox data to API: {e}")
    except Exception as e:
        print(f"Unexpected error in send_bbox_to_api: {e}")


def perform_detection(frame):
    """Perform YOLOv8 person detection on frame"""
    try:
        results = model(frame, verbose=False)
        detections = []

        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Filter for person class (class 0 in COCO dataset)
                if int(box.cls[0]) == 0:
                    # Get box coordinates
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0])

                    # Convert to [x, y, w, h] format
                    x = int(x1)
                    y = int(y1)
                    w = int(x2 - x1)
                    h = int(y2 - y1)

                    detections.append({
                        'bbox': [x, y, w, h],
                        'confidence': confidence
                    })

        return detections

    except Exception as e:
        print(f"Error during detection: {e}")
        return []


def draw_bboxes(frame, detections):
    """Draw bounding boxes on frame"""
    for det in detections:
        x, y, w, h = det['bbox']
        confidence = det['confidence']

        # Draw rectangle
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        # Draw label
        label = f"Person {confidence:.2f}"
        label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
        cv2.rectangle(frame, (x, y - label_size[1] - 10), (x + label_size[0], y), (0, 255, 0), -1)
        cv2.putText(frame, label, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)

    return frame


def main():
    """Main detection loop"""
    global frame_count, camera

    print("Starting S-Pavilion Detection Service")
    print_environment_variables()

    # Check GPU availability (if detection is enabled)
    check_gpu_availability()

    # Check dependencies (GStreamer, FFmpeg)
    check_dependencies()

    # Load YOLO model
    if not load_yolo_model():
        print("Failed to load YOLO model. Exiting...")
        return

    # Initialize camera
    if not init_camera():
        print("Failed to initialize camera. Exiting...")
        return

    # Initialize streaming writer based on USE_GSTREAMER setting
    if USE_GSTREAMER == 'true':
        writer = init_gstreamer_writer()
        writer_type = "GStreamer"
    else:
        writer = init_ffmpeg_writer()
        writer_type = "FFmpeg"

    if writer is None:
        print(f"Warning: {writer_type} pipeline not available. Continuing without RTSP streaming...")

    print("\nStarting detection loop...")
    print("Press Ctrl+C to stop")
    print("-" * 50)

    try:
        first_frame = True
        while True:
            # Read frame from camera
            ret, frame = camera.read()

            if first_frame:
                cv2.imwrite(f"first_frame_{frame_count}.jpg", frame)
                first_frame = False
                continue

            if not ret:
                if MOCK_MODE == 'true':
                    # In mock mode, restart the video from the beginning
                    print("Video ended. Restarting from the beginning...")
                    
                    # Reset video to beginning (keep writer alive)
                    camera.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = camera.read()
                    
                    if not ret:
                        print("Failed to restart video. Attempting to reconnect...")
                        camera.release()
                        time.sleep(1)
                        init_camera()
                        continue
                    else:
                        print("Video restarted successfully")
                else:
                    # In real camera mode, attempt to reconnect
                    print("Failed to read frame from camera. Attempting to reconnect...")
                    camera.release()
                    time.sleep(1)
                    init_camera()
                    continue

            frame_count += 1

            # Perform person detection (if enabled)
            if USE_DETECTION == 'true':
                detections = perform_detection(frame)

                # Draw bounding boxes on frame
                if detections:
                    frame = draw_bboxes(frame, detections)

                # Send bbox data to API every POST_INTERVAL frames
                if frame_count % POST_INTERVAL == 0 and detections:
                    bbox_list = [det['bbox'] for det in detections]
                    send_bbox_to_api(bbox_list)

            # Write frame to RTSP stream
            if writer is not None:
                try:
                    # Check frame properties for debugging
                    if frame_count % 300 == 0:  # Every 10 seconds
                        print(f"Frame info: shape={frame.shape}, dtype={frame.dtype}, size={frame.nbytes} bytes")

                    # Write frame based on writer type
                    if USE_GSTREAMER == 'true':
                        # PyGObject GStreamer writer
                        if not writer.write_frame(frame):
                            raise Exception("Failed to write frame to GStreamer pipeline")
                    else:
                        # FFmpeg subprocess writer
                        writer.stdin.write(frame.tobytes())

                except BrokenPipeError:
                    print(f"Error: RTSP stream pipe broken. Writer process may have terminated.")
                    # Clean up the broken writer and get error output
                    try:
                        if USE_GSTREAMER == 'true':
                            writer.cleanup()
                        else:
                            try:
                                writer.stdin.close()
                            except:
                                pass
                            writer.terminate()
                            try:
                                _, stderr = writer.communicate(timeout=2)
                                if stderr:
                                    print(f"FFmpeg error output:")
                                    print(stderr.decode())
                            except subprocess.TimeoutExpired:
                                writer.kill()
                                _, stderr = writer.communicate()
                                if stderr:
                                    print(f"FFmpeg error output (killed):")
                                    print(stderr.decode())
                    except Exception as e:
                        print(f"Error during writer cleanup: {e}")
                    writer = None
                    print("Attempting to reconnect writer...")

                    # Wait before attempting to reconnect
                    time.sleep(2.0)  # Wait 2 seconds before reconnecting

                    # Attempt to reconnect
                    if USE_GSTREAMER == 'true':
                        writer = init_gstreamer_writer()
                        writer_type = "GStreamer (PyGObject)"
                    else:
                        writer = init_ffmpeg_writer()
                        writer_type = "FFmpeg"

                    if writer is not None:
                        print(f"Writer reconnected successfully using {writer_type}")
                    else:
                        print(f"Failed to reconnect writer. Continuing without RTSP streaming...")

                except Exception as e:
                    print(f"Error writing to RTSP stream: {e}")
                    # Don't recreate writer, just log the error and continue

            # Check writer process status periodically
            if writer is not None and frame_count % 30 == 0:  # Check every second
                # For GStreamer (PyGObject), check is_playing status
                if USE_GSTREAMER == 'true':
                    if not writer.is_playing:
                        print(f"GStreamer pipeline stopped unexpectedly")
                        writer.cleanup()
                        writer = None
                        print("Attempting to reconnect writer...")

                        writer = init_gstreamer_writer()
                        if writer is not None:
                            print(f"Writer reconnected successfully using GStreamer (PyGObject)")
                        else:
                            print(f"Failed to reconnect writer. Continuing without RTSP streaming...")
                else:
                    # For FFmpeg subprocess, check poll status
                    if writer.poll() is not None:  # Process has terminated
                        print(f"Writer process terminated unexpectedly. Exit code: {writer.returncode}")
                        # Try to get any remaining error output
                        try:
                            _, stderr = writer.communicate(timeout=0.1)
                            if stderr:
                                print(f"FFmpeg error output:")
                                print(stderr.decode())
                        except:
                            pass
                        writer = None
                        print("Attempting to reconnect writer...")

                        writer = init_ffmpeg_writer()
                        if writer is not None:
                            print(f"Writer reconnected successfully using FFmpeg")
                        else:
                            print(f"Failed to reconnect writer. Continuing without RTSP streaming...")

            # Display frame info
            if frame_count % (15*10) == 0:  # Print every second (assuming 30fps)
                print(f"Frame {frame_count}: Streaming to {writer_type if writer else 'No stream'}")
                
            # Check if we're near the end of video (for debugging)
            if MOCK_MODE == 'true' and frame_count % (15*10) == 0:
                total_frames = int(camera.get(cv2.CAP_PROP_FRAME_COUNT))
                current_frame = int(camera.get(cv2.CAP_PROP_POS_FRAMES))
                if total_frames > 0:
                    progress = (current_frame / total_frames) * 100
                    if progress > 90:  # Near end of video
                        print(f"Video progress: {progress:.1f}% ({current_frame}/{total_frames} frames)")

            # Frame timing control
            if MOCK_MODE == 'true':
                # In mock mode, maintain video FPS timing
                frame_delay = 1.0 / video_fps
                time.sleep(frame_delay)
            else:
                # In real camera mode, small delay to prevent CPU overload
                time.sleep(0.001)

    except KeyboardInterrupt:
        print("\n\nStopping detection service...")
    except Exception as e:
        print(f"\nUnexpected error in main loop: {e}")
    finally:
        # Cleanup
        if camera is not None:
            camera.release()
        if writer is not None:
            try:
                if USE_GSTREAMER == 'true':
                    # PyGObject GStreamer cleanup
                    writer.cleanup()
                else:
                    # FFmpeg subprocess cleanup
                    writer.stdin.close()
                    writer.wait(timeout=5)  # Wait for graceful shutdown
            except subprocess.TimeoutExpired:
                print("Warning: Writer process did not terminate gracefully, forcing...")
                writer.terminate()
                writer.wait(timeout=2)
            except Exception as e:
                print(f"Error during writer cleanup: {e}")
        print("Detection service stopped")


if __name__ == "__main__":
    main()
