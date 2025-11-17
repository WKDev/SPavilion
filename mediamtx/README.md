# MediaMTX

# Description
- Receives RTSP stream from detection-service
- Provides WebRTC and HLS output streaming services
- Configuration file: mediamtx.yml

# Configuration
- RTSP input: `rtsp://localhost:8554/camera` (published by detection-service)
- RTSP port: 8554
- WebRTC port: 8889
- HLS port: 8888
- Authentication: disabled (internal network)

# How it works
1. detection-service publishes RTSP stream to mediamtx at `rtsp://localhost:8554/camera`
2. mediamtx converts RTSP to WebRTC/HLS
3. React frontend connects to WebRTC endpoint for real-time video streaming

# Access URLs
- WebRTC: `http://localhost:8889/camera/`
- HLS: `http://localhost:8888/camera/`