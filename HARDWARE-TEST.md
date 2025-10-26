# 윈도우 하드웨어 바이패스 테스트 가이드

## 🎯 목표
윈도우에서 Docker 컨테이너로 웹캠과 COM포트를 직접 바이패스하여 사용

## 📋 사전 준비

### 1. Docker Desktop 설정
```bash
# Docker Desktop에서 WSL2 백엔드 사용 확인
# Settings > General > Use the WSL 2 based engine 체크
```

### 2. 하드웨어 확인
```powershell
# 웹캠 확인
Get-PnpDevice -Class Camera

# COM포트 확인
Get-WmiObject -Class Win32_SerialPort | Select-Object Name, DeviceID
```

## 🚀 실행 방법

### 1. 기본 하드웨어 모드
```bash
# 웹캠과 COM포트 모두 바이패스
docker-compose --profile hardware up
```

### 2. 윈도우 전용 설정
```bash
# 윈도우 최적화 하드웨어 바이패스
docker-compose -f docker-compose.yml -f docker-compose.windows.yml up
```

### 3. GPU 가속 포함
```bash
# NVIDIA GPU 사용 (설치된 경우)
docker-compose --profile windows-gpu up
```

## 🔧 하드웨어 접근 테스트

### 1. 웹캠 테스트
```bash
# 컨테이너 내부에서 웹캠 접근 테스트
docker exec -it detection-service python -c "
import cv2
import os
print('Available video devices:')
for i in range(5):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        print(f'Device {i}: Available')
        cap.release()
    else:
        print(f'Device {i}: Not available')
"
```

### 2. COM포트 테스트
```bash
# 컨테이너 내부에서 시리얼 포트 접근 테스트
docker exec -it nest sh -c "
ls -la /dev/tty* | grep -E '(USB|ACM)'
echo 'Available serial devices:'
for device in /dev/ttyUSB* /dev/ttyACM*; do
    if [ -e \$device ]; then
        echo \"Found: \$device\"
    fi
done
"
```

### 3. USB 디바이스 테스트
```bash
# USB 디바이스 접근 테스트
docker exec -it detection-service ls -la /dev/bus/usb/
```

## 🐛 문제 해결

### 웹캠이 인식되지 않는 경우

#### 1. Windows Camera Privacy 설정
```
Settings > Privacy > Camera > Allow apps to access your camera: ON
Settings > Privacy > Camera > Allow desktop apps to access your camera: ON
```

#### 2. Docker Desktop 리소스 설정
```
Docker Desktop > Settings > Resources > Advanced
- Memory: 최소 4GB
- CPUs: 최소 2개
```

#### 3. WSL2에서 USB 디바이스 접근
```bash
# WSL2에서 USB 디바이스 확인
lsusb
ls /dev/video*
```

### COM포트가 인식되지 않는 경우

#### 1. Windows Device Manager 확인
```
Device Manager > Ports (COM & LPT)
- COM포트가 올바르게 인식되는지 확인
- 드라이버가 설치되어 있는지 확인
```

#### 2. USB-to-Serial 드라이버 설치
```
- CH340, CP2102, FTDI 등 USB-to-Serial 칩셋 드라이버 설치
- Arduino IDE 설치 시 자동으로 드라이버 설치됨
```

#### 3. 포트 권한 확인
```powershell
# PowerShell에서 COM포트 확인
[System.IO.Ports.SerialPort]::getPortNames()
```

## 📊 성능 모니터링

### 1. 웹캠 성능 확인
```bash
# 컨테이너 내부에서 FPS 확인
docker exec -it detection-service python -c "
import cv2
import time
cap = cv2.VideoCapture(0)
if cap.isOpened():
    start_time = time.time()
    frame_count = 0
    for i in range(100):
        ret, frame = cap.read()
        if ret:
            frame_count += 1
    end_time = time.time()
    fps = frame_count / (end_time - start_time)
    print(f'Camera FPS: {fps:.2f}')
    cap.release()
else:
    print('Camera not accessible')
"
```

### 2. 메모리 사용량 확인
```bash
# 컨테이너 리소스 사용량 확인
docker stats detection-service nest
```

## 🔄 개발 워크플로우

### 1. 개발 모드 (Mock)
```bash
# 하드웨어 없이 개발
MOCK_MODE=true docker-compose up
```

### 2. 테스트 모드 (Hardware)
```bash
# 실제 하드웨어로 테스트
MOCK_MODE=false docker-compose --profile hardware up
```

### 3. 프로덕션 모드
```bash
# 최적화된 설정으로 실행
docker-compose -f docker-compose.yml -f docker-compose.windows.yml up
```

## ⚠️ 주의사항

1. **보안**: `privileged: true` 설정으로 인한 보안 위험
2. **성능**: 하드웨어 바이패스로 인한 성능 오버헤드
3. **호환성**: Windows 버전과 Docker Desktop 버전 호환성 확인
4. **드라이버**: 하드웨어별 드라이버 설치 필요

## 📝 로그 확인

### 1. 웹캠 로그
```bash
docker logs detection-service -f
```

### 2. COM포트 로그
```bash
docker logs nest -f
```

### 3. 전체 시스템 로그
```bash
docker-compose logs -f
```

## 🎉 성공 확인

웹캠과 COM포트가 정상적으로 바이패스되면:

1. **웹캠**: RTSP 스트림이 `rtsp://localhost:8554/camera`에서 접근 가능
2. **COM포트**: NestJS API에서 PLC 통신 정상 작동
3. **GPU**: YOLOv8 모델이 GPU 가속으로 실행 (NVIDIA GPU 있는 경우)

## 🔗 관련 링크

- [Docker Desktop for Windows](https://docs.docker.com/desktop/windows/)
- [WSL2 USB Support](https://docs.microsoft.com/en-us/windows/wsl/connect-usb)
- [OpenCV Camera Access](https://docs.opencv.org/4.x/d8/dfe/classcv_1_1VideoCapture.html)
