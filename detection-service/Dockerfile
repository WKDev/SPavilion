FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg \
 && rm -rf /var/lib/apt/lists/*  && ln -s /usr/bin/python3 /usr/bin/python \

# uv 설치(전역 경로)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

COPY requirements.txt .
# Python deps
RUN pip install -r requirements.txt

CMD ["python3", "./main.py"]

    # ca-certificates curl \
    # X/OpenGL 런타임
    # libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 \
    # VAAPI 가속(호스트 /dev/dri 필요)
    # libdrm2 va-driver-all gstreamer1.0-vaapi \
    # # GStreamer 코어
    # libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 gstreamer1.0-tools \
    # gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
    # gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
    # gstreamer1.0-libav gstreamer1.0-gl \
    # # PyGObject(GStreamer 바인딩)
    # python3-gi gobject-introspection gir1.2-gstreamer-1.0 \
    # # RTSP 서버 라이브러리
    # libgstrtspserver-1.0-0 gir1.2-gst-rtsp-server-1.0 \
    # 유틸(선택) : 코덱·디버깅 보조
    # ffmpeg \

# hot-reload(필요 시)
# RUN uv pip install --system watchdog

# PyGObject는 시스템 패키지(python3-gi)로 설치되므로 Python이 찾을 수 있도록 경로 추가
# ENV PYTHONPATH="/usr/lib/python3/dist-packages:${PYTHONPATH}"

# 선택: GStreamer 동작 자가 테스트(빌드 시 검증용)
# RUN gst-inspect-1.0 | head -n 20 && \
#     gst-launch-1.0 -q fakesrc num-buffers=5 ! fakesink

# 런타임 참고:
# - 하드웨어 가속: --device=/dev/dri:/dev/dri 권장
# - RTSP 서버 바인딩: -p 8554:8554 등 포트 매핑




