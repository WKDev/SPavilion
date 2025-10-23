import cv2
import numpy as np
import time
import os
import requests
from datetime import datetime
from ultralytics import YOLO

# Environment variables with defaults
API_URL = os.getenv('API_URL', 'http://localhost:3000')
RTSP_URL = os.getenv('RTSP_URL', 'rtsp://localhost:8554/camera')
CAMERA_INDEX = int(os.getenv('CAMERA_INDEX', '0'))
CELL_SIZE = int(os.getenv('CELL_SIZE', '32'))
POST_INTERVAL = int(os.getenv('POST_INTERVAL', '30'))  # Post every N frames

# Global variables
model = None
camera = None
frame_count = 0
camera_width = 640
camera_height = 480


def load_yolo_model():
    """Load YOLOv8n model for person detection"""
    global model
    print("Loading YOLOv8n model...")
    try:
        model = YOLO('yolov8n.pt')
        print("YOLOv8n model loaded successfully")
        return True
    except Exception as e:
        print(f"Error loading YOLOv8n model: {e}")
        return False


def init_camera():
    """Initialize camera with retry logic"""
    global camera, camera_width, camera_height

    while True:
        try:
            print(f"Attempting to open camera at index {CAMERA_INDEX}...")
            camera = cv2.VideoCapture(CAMERA_INDEX)

            if not camera.isOpened():
                raise Exception("Failed to open camera")

            # Set camera properties
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            camera.set(cv2.CAP_PROP_FPS, 30)

            # Get actual dimensions
            camera_width = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH))
            camera_height = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT))

            print(f"Camera opened successfully: {camera_width}x{camera_height}")
            return True

        except Exception as e:
            print(f"Error opening camera: {e}")
            print("Retrying in 1 second...")
            if camera is not None:
                camera.release()
                camera = None
            time.sleep(1)


def init_gstreamer_writer():
    """Initialize GStreamer pipeline for RTSP streaming"""
    global camera_width, camera_height

    try:
        # GStreamer pipeline for RTSP output
        gst_pipeline = (
            f"appsrc ! "
            f"videoconvert ! "
            f"video/x-raw,format=I420 ! "
            f"x264enc tune=zerolatency bitrate=2000 speed-preset=superfast ! "
            f"rtspclientsink location={RTSP_URL}"
        )

        writer = cv2.VideoWriter(
            gst_pipeline,
            cv2.CAP_GSTREAMER,
            0,  # FPS (0 means use appsrc rate)
            (camera_width, camera_height),
            True
        )

        if not writer.isOpened():
            raise Exception("Failed to open GStreamer pipeline")

        print(f"GStreamer RTSP pipeline initialized: {RTSP_URL}")
        return writer

    except Exception as e:
        print(f"Error initializing GStreamer pipeline: {e}")
        return None


def send_bbox_to_api(bboxes):
    """Send bounding box data to NestJS backend API"""
    try:
        payload = {
            'bboxes': bboxes,
            'frame_count': frame_count,
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
    print(f"API URL: {API_URL}")
    print(f"RTSP URL: {RTSP_URL}")
    print(f"Camera Index: {CAMERA_INDEX}")
    print(f"Cell Size: {CELL_SIZE}")
    print(f"Post Interval: {POST_INTERVAL} frames")
    print("-" * 50)

    # Load YOLO model
    if not load_yolo_model():
        print("Failed to load YOLO model. Exiting...")
        return

    # Initialize camera
    if not init_camera():
        print("Failed to initialize camera. Exiting...")
        return

    # Initialize GStreamer RTSP writer
    writer = init_gstreamer_writer()
    if writer is None:
        print("Warning: GStreamer pipeline not available. Continuing without RTSP streaming...")

    print("\nStarting detection loop...")
    print("Press Ctrl+C to stop")
    print("-" * 50)

    try:
        while True:
            # Read frame from camera
            ret, frame = camera.read()

            if not ret:
                print("Failed to read frame from camera. Attempting to reconnect...")
                camera.release()
                if writer is not None:
                    writer.release()
                time.sleep(1)
                init_camera()
                writer = init_gstreamer_writer()
                continue

            frame_count += 1

            # Perform person detection
            detections = perform_detection(frame)

            # Draw bounding boxes on frame
            if detections:
                frame = draw_bboxes(frame, detections)

            # Send bbox data to API every POST_INTERVAL frames
            if frame_count % POST_INTERVAL == 0 and detections:
                bbox_list = [det['bbox'] for det in detections]
                send_bbox_to_api(bbox_list)

            # Write frame to RTSP stream
            if writer is not None and writer.isOpened():
                try:
                    writer.write(frame)
                except Exception as e:
                    print(f"Error writing to RTSP stream: {e}")
                    writer.release()
                    writer = init_gstreamer_writer()

            # Display detection info
            if frame_count % 30 == 0:  # Print every second (assuming 30fps)
                print(f"Frame {frame_count}: {len(detections)} person(s) detected")

            # Small delay to prevent CPU overload
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
            writer.release()
        print("Detection service stopped")


if __name__ == "__main__":
    main()
