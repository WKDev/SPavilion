# Windows Docker Setup Guide

## USB 카메라와 GPU 바이패스 문제 해결

### 현재 상황
윈도우에서 Docker를 통한 USB 카메라와 GPU 바이패스는 제한적입니다:

1. **USB 카메라**: `/dev/video0` 경로가 윈도우에 존재하지 않음
2. **GPU**: NVIDIA Container Toolkit 설치 필요

### 해결 방안

#### 1. USB 카메라 접근

**문제**: 윈도우에서는 Linux의 `/dev/video0` 경로가 존재하지 않습니다.

**해결책**:
- **Mock 모드 사용** (권장): 테스트 비디오 파일 사용
- **DirectShow/Media Foundation**: 윈도우 네이티브 카메라 API 사용
- **RTSP 스트림**: 외부 카메라 소프트웨어를 통해 RTSP 스트림 제공

#### 2. GPU 가속 (NVIDIA)

**필요 조건**:
1. NVIDIA GPU 드라이버 설치
2. NVIDIA Container Toolkit 설치
3. Docker Desktop에서 WSL2 백엔드 사용

**설치 방법**:
```powershell
# 1. NVIDIA Container Toolkit 설치 (WSL2에서)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# 2. Docker 설정
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### 사용 방법

#### 1. Mock 모드 (권장)
```bash
# Mock 모드로 실행 (USB 카메라 없이)
docker-compose --profile mock up
```

#### 2. GPU 가속 모드
```bash
# NVIDIA GPU 사용
docker-compose --profile windows-gpu up
```

#### 3. 윈도우 전용 설정
```bash
# 윈도우 최적화 설정 사용
docker-compose -f docker-compose.yml -f docker-compose.windows.yml up
```

### 환경 변수

윈도우용 환경 변수 설정:

```bash
# .env 파일 생성
PLATFORM=windows
MOCK_MODE=true
USE_GSTREAMER=false
NVIDIA_VISIBLE_DEVICES=all
NVIDIA_DRIVER_CAPABILITIES=compute,utility
```

### 대안 솔루션

#### 1. 카메라 접근
- **OBS Studio**: 가상 카메라로 RTSP 스트림 생성
- **VLC**: USB 카메라를 RTSP 스트림으로 변환
- **DirectShow**: Python에서 `opencv-python`의 DirectShow 백엔드 사용

#### 2. GPU 가속
- **CPU 모드**: GPU 없이 CPU로 YOLOv8 실행 (느림)
- **WSL2**: Linux 환경에서 GPU 가속 사용
- **Native Windows**: Docker 없이 직접 Python 실행

### 문제 해결

#### GPU 인식 안됨
```bash
# GPU 상태 확인
nvidia-smi

# Docker에서 GPU 접근 테스트
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

#### 카메라 접근 안됨
```bash
# Mock 모드로 우선 테스트
MOCK_MODE=true docker-compose up detection-service
```

### 권장 개발 워크플로우

1. **개발 단계**: Mock 모드 사용
2. **테스트 단계**: RTSP 스트림 사용
3. **배포 단계**: Linux 서버에서 실제 하드웨어 사용

### 참고사항

- 윈도우 Docker는 Linux 컨테이너를 실행하므로 하드웨어 접근이 제한적
- 프로덕션 환경에서는 Linux 서버 사용 권장
- 개발/테스트 목적으로는 Mock 모드가 가장 안정적
