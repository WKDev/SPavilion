#!/bin/bash
# Mac 웹캠을 MediaMTX로 스트리밍하는 스크립트
# FaceTime HD Camera (디바이스 0)를 RTMP로 MediaMTX에 퍼블리시

echo "🎥 Starting Mac Webcam Stream to MediaMTX..."
echo "Stream URL: rtmp://localhost:1935/camera"
echo "Press Ctrl+C to stop"
echo ""

ffmpeg \
  -f avfoundation \
  -framerate 30 \
  -video_size 640x480 \
  -i "0" \
  -c:v libx264 \
  -preset ultrafast \
  -tune zerolatency \
  -b:v 2000k \
  -maxrate 2000k \
  -bufsize 4000k \
  -pix_fmt yuv420p \
  -g 60 \
  -keyint_min 60 \
  -f flv \
  rtmp://localhost:1935/camera

echo ""
echo "Stream stopped."


