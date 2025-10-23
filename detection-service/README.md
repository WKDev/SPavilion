# detection service

# description
- takes video stream as input and performs object detection using yolov8 model, then sends the detected bounding box data to nestjs backend api

# prerequisites
- use yolov8 for object detection
- python, opencv, requests, gstreamer (pygobject, gi)
- uvc camera as video source
- communicates with nestjs backend api for storing bbox data

# description(how it works)
1. takes video stream from uvc camera (cv2.VideoCapture(0))
2. performs object detection using yolov8 model (yolov8n.pt, person detection)
3. draws bounding boxes on the frame
4. sends bbox data to nestjs backend api (POST /api/bbox_history)
5. feeds annotated video stream to mediamtx via RTSP (rtsp://localhost:8554/camera) using GStreamer
6. repeat steps 1-5 until stopped