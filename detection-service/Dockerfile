FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive

# OS deps + GStreamer full runtime + RTSP 서버 + VAAPI
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    # X/OpenGL 런타임
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 \
    # VAAPI 가속(호스트 /dev/dri 필요)
    libdrm2 va-driver-all gstreamer1.0-vaapi \
    # GStreamer 코어
    libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 gstreamer1.0-tools \
    gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav gstreamer1.0-gl \
    # PyGObject(GStreamer 바인딩)
    python3-gi gobject-introspection gir1.2-gstreamer-1.0 \
    # RTSP 서버 라이브러리
    libgstrtspserver-1.0-0 gir1.2-gst-rtsp-server-1.0 \
    # 유틸(선택) : 코덱·디버깅 보조
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# uv 설치(전역 경로)
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh

WORKDIR /app

# Python deps
COPY requirements.txt .
RUN uv pip install --system --no-cache-dir -r requirements.txt

# hot-reload(필요 시)
RUN uv pip install --system watchdog

# 선택: GStreamer 동작 자가 테스트(빌드 시 검증용)
RUN gst-inspect-1.0 | head -n 20 && \
    gst-launch-1.0 -q fakesrc num-buffers=5 ! fakesink

# 런타임 참고:
# - 하드웨어 가속: --device=/dev/dri:/dev/dri 권장
# - RTSP 서버 바인딩: -p 8554:8554 등 포트 매핑


ENV PYTHONUNBUFFERED=1


CMD ["python", "main.py"]



