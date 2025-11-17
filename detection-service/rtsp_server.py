"""
Video Streaming Module for S-Pavilion Detection Service

Implements hardware-accelerated video streaming using GStreamer.
Publishes H.264 encoded video to MediaMTX via RTMP protocol.
MediaMTX then distributes the stream via RTSP, WebRTC, HLS, and other protocols.
Supports NVIDIA NVENC, Intel VA-API, Apple VideoToolbox, and software fallback.
"""

import logging
import threading
import time
import queue
from typing import Optional
import numpy as np
import cv2

# GStreamer imports
try:
    import gi
    gi.require_version('Gst', '1.0')
    gi.require_version('GLib', '2.0')
    from gi.repository import Gst, GLib
except ImportError as e:
    raise ImportError(f"GStreamer Python bindings not found: {e}\n"
                      "Install with: apt-get install python3-gi gir1.2-gstreamer-1.0")

from hw_detect import HardwareConfig


logger = logging.getLogger(__name__)


class RTSPStreamer:
    """
    Video Streamer using GStreamer pipeline.
    Reads frames from a queue and publishes them to MediaMTX via RTMP.
    MediaMTX then makes the stream available via RTSP, WebRTC, HLS, and other protocols.
    """

    def __init__(self, hw_config: HardwareConfig, frame_queue: queue.Queue,
                 rtsp_url: str, width: int = 640, height: int = 480, fps: int = 30):
        """
        Initialize RTSP streamer with GStreamer pipeline.

        Args:
            hw_config: Hardware configuration with selected encoder
            frame_queue: Thread-safe queue to pull frames from
            rtsp_url: Target RTSP URL (e.g., rtsp://mediamtx:8554/camera)
            width: Frame width
            height: Frame height
            fps: Frames per second
        """
        self.hw_config = hw_config
        self.frame_queue = frame_queue
        self.rtsp_url = rtsp_url
        self.width = width
        self.height = height
        self.fps = fps

        self.pipeline = None
        self.appsrc = None
        self.is_running = False
        self.frame_count = 0
        
        # Initialize GStreamer
        Gst.init(None)
        
        logger.info(f"RTSPStreamer initialized: {width}x{height}@{fps}fps -> {rtsp_url}")
        logger.info(f"Using encoder: {hw_config.selected_encoder}")

    def build_pipeline(self) -> bool:
        """
        Build GStreamer pipeline for RTMP streaming to MediaMTX.
        Pipeline: appsrc ! videoconvert ! encoder ! h264parse ! flvmux ! rtmpsink
        """
        try:
            # Build encoder element string with properties
            encoder_str = self.hw_config.selected_encoder
            if self.hw_config.encoder_options:
                props = ' '.join([f'{k}={v}' for k, v in self.hw_config.encoder_options.items()])
                encoder_str = f"{encoder_str} {props}"

            # Convert RTSP URL to RTMP URL for MediaMTX
            # rtsp://mediamtx:8554/camera -> rtmp://mediamtx:1935/camera
            rtmp_url = self.rtsp_url.replace('rtsp://', 'rtmp://').replace(':8554', ':1935')

            # Build complete pipeline string
            # appsrc handles raw video input
            # videoconvert ensures format compatibility
            # encoder compresses to H.264
            # h264parse parses H.264 stream
            # flvmux packages H.264 into FLV container for RTMP
            # rtmpsink publishes to RTMP server
            pipeline_str = (
                f"appsrc name=src is-live=true format=time "
                f"caps=video/x-raw,format=BGR,width={self.width},height={self.height},framerate={self.fps}/1 ! "
                f"videoconvert ! "
                f"videoscale ! "
                f"{encoder_str} ! "
                f"h264parse ! "
                f"flvmux streamable=true name=mux ! "
                f"rtmpsink location={rtmp_url} sync=false"
            )

            logger.info(f"Building GStreamer pipeline:")
            logger.info(f"  {pipeline_str}")

            # Create pipeline from string
            self.pipeline = Gst.parse_launch(pipeline_str)
            
            if self.pipeline is None:
                logger.error("Failed to create GStreamer pipeline")
                return False

            # Get appsrc element for frame injection
            self.appsrc = self.pipeline.get_by_name('src')
            if self.appsrc is None:
                logger.error("Failed to get appsrc element from pipeline")
                return False

            # Configure appsrc callbacks
            self.appsrc.connect('need-data', self._on_need_data)
            self.appsrc.connect('enough-data', self._on_enough_data)

            # Set up bus for error/warning messages
            bus = self.pipeline.get_bus()
            bus.add_signal_watch()
            bus.connect('message', self._on_bus_message)

            logger.info("GStreamer pipeline built successfully")
            return True

        except Exception as e:
            logger.error(f"Error building pipeline: {e}", exc_info=True)
            return False

    def _on_need_data(self, src, length):
        """Callback when appsrc needs more data"""
        # This signals that we can push more frames
        pass

    def _on_enough_data(self, src):
        """Callback when appsrc has enough data buffered"""
        # This signals that we should slow down pushing frames
        pass

    def _on_bus_message(self, bus, message):
        """Handle GStreamer bus messages"""
        t = message.type
        
        if t == Gst.MessageType.ERROR:
            err, debug = message.parse_error()
            logger.error(f"GStreamer Error: {err}, {debug}")
            self.stop()
        elif t == Gst.MessageType.WARNING:
            warn, debug = message.parse_warning()
            logger.warning(f"GStreamer Warning: {warn}, {debug}")
        elif t == Gst.MessageType.EOS:
            logger.info("End of stream")
            self.stop()
        elif t == Gst.MessageType.STATE_CHANGED:
            if message.src == self.pipeline:
                old_state, new_state, pending_state = message.parse_state_changed()
                logger.info(f"Pipeline state changed: {old_state.value_nick} -> {new_state.value_nick}")

    def start(self) -> bool:
        """Start the GStreamer pipeline"""
        try:
            if self.pipeline is None:
                logger.error("Pipeline not built. Call build_pipeline() first.")
                return False

            logger.info("Starting GStreamer pipeline...")
            
            # Set pipeline to PLAYING state
            ret = self.pipeline.set_state(Gst.State.PLAYING)
            
            if ret == Gst.StateChangeReturn.FAILURE:
                logger.error("Unable to set pipeline to PLAYING state")
                return False

            self.is_running = True
            logger.info("GStreamer pipeline started successfully")
            
            # Start frame feeding thread
            self.feed_thread = threading.Thread(target=self._feed_frames, daemon=True)
            self.feed_thread.start()
            logger.info("Frame feeding thread started")

            return True

        except Exception as e:
            logger.error(f"Error starting pipeline: {e}", exc_info=True)
            return False

    def _feed_frames(self):
        """
        Feed frames from queue to GStreamer appsrc.
        Runs in a separate thread.
        """
        logger.info("Frame feeding loop started")
        
        # Calculate frame duration in nanoseconds
        frame_duration = int(1e9 / self.fps)
        
        try:
            while self.is_running:
                try:
                    # Get frame from queue (with timeout)
                    frame = self.frame_queue.get(timeout=1.0)
                    
                    # Ensure frame is correct size
                    if frame.shape[0] != self.height or frame.shape[1] != self.width:
                        frame = cv2.resize(frame, (self.width, self.height))
                    
                    # Convert frame to GStreamer buffer
                    data = frame.tobytes()
                    
                    # Create Gst.Buffer
                    buf = Gst.Buffer.new_allocate(None, len(data), None)
                    buf.fill(0, data)
                    
                    # Set buffer timestamp and duration
                    buf.pts = self.frame_count * frame_duration
                    buf.duration = frame_duration
                    
                    # Push buffer to appsrc
                    ret = self.appsrc.emit('push-buffer', buf)
                    
                    if ret != Gst.FlowReturn.OK:
                        logger.warning(f"Failed to push buffer: {ret}")
                    
                    self.frame_count += 1
                    
                    # Log progress periodically
                    if self.frame_count % 300 == 0:  # Every 10 seconds at 30fps
                        logger.info(f"Pushed {self.frame_count} frames to RTSP stream")
                    
                except queue.Empty:
                    # No frame available, continue
                    continue
                except Exception as e:
                    logger.error(f"Error feeding frame: {e}", exc_info=True)
                    time.sleep(0.1)

        except Exception as e:
            logger.error(f"Fatal error in frame feeding loop: {e}", exc_info=True)
        finally:
            logger.info("Frame feeding loop stopped")
            # Send EOS to pipeline
            if self.appsrc:
                self.appsrc.emit('end-of-stream')

    def stop(self):
        """Stop the GStreamer pipeline"""
        logger.info("Stopping RTSP streamer...")
        
        self.is_running = False
        
        # Wait for feed thread to finish
        if hasattr(self, 'feed_thread') and self.feed_thread.is_alive():
            self.feed_thread.join(timeout=2.0)
        
        # Stop pipeline
        if self.pipeline:
            self.pipeline.set_state(Gst.State.NULL)
            logger.info("GStreamer pipeline stopped")

    def is_alive(self) -> bool:
        """Check if streamer is running"""
        return self.is_running and (hasattr(self, 'feed_thread') and self.feed_thread.is_alive())


def run_rtsp_streamer(hw_config: HardwareConfig, frame_queue: queue.Queue,
                      rtsp_url: str, width: int = 640, height: int = 480, fps: int = 30):
    """
    Run RTSP streamer in the current thread.
    This is the main entry point for starting the RTSP streaming.

    Args:
        hw_config: Hardware configuration
        frame_queue: Thread-safe queue containing CV2 frames
        rtsp_url: Target RTSP URL
        width: Video width
        height: Video height
        fps: Frames per second
    """
    logger.info("Initializing RTSP streamer...")
    
    streamer = RTSPStreamer(hw_config, frame_queue, rtsp_url, width, height, fps)
    
    if not streamer.build_pipeline():
        logger.error("Failed to build GStreamer pipeline")
        return None
    
    if not streamer.start():
        logger.error("Failed to start GStreamer pipeline")
        return None
    
    # Extract path from RTSP URL for display purposes
    path = rtsp_url.split('/')[-1]
    logger.info(f"Stream published to MediaMTX via RTMP")
    logger.info("Stream is now available via multiple protocols:")
    logger.info(f"  - RTSP: rtsp://mediamtx:8554/{path}")
    logger.info(f"  - WebRTC: http://mediamtx:8889/{path}")
    logger.info(f"  - HLS: http://mediamtx:8888/{path}")
    logger.info(f"  - RTMP: rtmp://mediamtx:1935/{path}")
    
    return streamer


if __name__ == "__main__":
    # Test RTSP streamer independently
    logging.basicConfig(level=logging.INFO)
    
    from hw_detect import detect_hardware, print_hardware_info, check_gstreamer_dependencies
    
    # Check dependencies
    if not check_gstreamer_dependencies():
        logger.error("GStreamer dependencies not satisfied")
        exit(1)
    
    # Detect hardware
    hw_config = detect_hardware()
    print_hardware_info(hw_config)
    
    # Create test frame queue
    test_queue = queue.Queue(maxsize=30)
    
    # Create test pattern generator
    def generate_test_pattern():
        """Generate test pattern frames"""
        frame_num = 0
        while True:
            # Create test pattern with frame counter
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            
            # Add color gradient
            for i in range(480):
                frame[i, :] = [i * 255 // 480, (480 - i) * 255 // 480, 128]
            
            # Add frame counter text
            cv2.putText(frame, f"Frame {frame_num}", (50, 240),
                       cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
            
            try:
                test_queue.put(frame, timeout=0.1)
            except queue.Full:
                pass
            
            frame_num += 1
            time.sleep(1.0 / 30)  # 30 fps
    
    # Start test pattern generator
    test_thread = threading.Thread(target=generate_test_pattern, daemon=True)
    test_thread.start()
    
    # Run RTSP streamer
    streamer = run_rtsp_streamer(
        hw_config,
        test_queue,
        rtsp_url='rtsp://localhost:8554/test',
        width=640,
        height=480,
        fps=30
    )
    
    if streamer:
        try:
            # Keep running
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        finally:
            streamer.stop()
    else:
        logger.error("Failed to start streamer")


