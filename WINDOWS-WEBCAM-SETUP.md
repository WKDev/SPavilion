# Windows 웹캠 설정 가이드

## 개요
윈도우 환경에서 Docker 컨테이너 내의 detection-service가 웹캠에 접근하는 방법을 설명합니다.

## 방법 1: 환경변수 기반 접근 (권장)

### 1. 웹캠 인덱스 확인
Windows에서 웹캠의 인덱스를 확인하려면:

```powershell
# PowerShell에서 실행
python -c "import cv2; print([i for i in range(10) if cv2.VideoCapture(i).isOpened()])"
```

일반적으로:
- 인덱스 0: 기본 웹캠
- 인덱스 1: 두 번째 웹캠 (있는 경우)

### 2. Docker Compose 실행
```bash
# 기본 웹캠 사용 (인덱스 0)
docker-compose -f docker-compose.windows.yml up

# 특정 웹캠 사용 (인덱스 1)
CAMERA_INDEX=1 docker-compose -f docker-compose.windows.yml up

# Mock 모드 비활성화하여 실제 웹캠 사용
MOCK_MODE=false CAMERA_INDEX=0 docker-compose -f docker-compose.windows.yml up
```

## 방법 2: Docker Desktop 설정

### 1. Docker Desktop 권한 설정
- Docker Desktop → Settings → Resources → Advanced
- "Expose daemon on tcp://localhost:2375 without TLS" 체크 해제
- "Use the WSL 2 based engine" 사용 권장

### 2. 웹캠 접근 권한
Windows에서는 Docker Desktop이 자동으로 웹캠 접근 권한을 처리합니다.

## 방법 3: 네트워크 기반 접근 (고급)

### 1. OBS Virtual Camera 사용
1. OBS Studio 설치
2. Virtual Camera 플러그인 활성화
3. 웹캠을 OBS 소스로 추가
4. Virtual Camera 시작
5. Docker 컨테이너에서 네트워크 스트림으로 접근

### 2. FFmpeg를 통한 스트리밍
```bash
# 웹캠을 RTSP 스트림으로 변환
ffmpeg -f dshow -i video="웹캠 이름" -c:v libx264 -preset ultrafast -f rtsp rtsp://localhost:8554/camera
```

## 문제 해결

### 웹캠이 인식되지 않는 경우
1. **다른 애플리케이션 확인**: 다른 프로그램에서 웹캠을 사용 중인지 확인
2. **드라이버 업데이트**: 웹캠 드라이버 최신 버전으로 업데이트
3. **권한 확인**: Windows 카메라 권한 설정 확인

### Docker 컨테이너에서 접근 실패
1. **MOCK_MODE 확인**: `MOCK_MODE=false`로 설정
2. **CAMERA_INDEX 확인**: 올바른 웹캠 인덱스 사용
3. **로그 확인**: `docker logs detection-service`로 오류 메시지 확인

### 성능 최적화
1. **해상도 조정**: 웹캠 해상도를 640x480으로 제한
2. **FPS 제한**: 필요에 따라 프레임 레이트 조정
3. **GPU 사용**: NVIDIA GPU가 있는 경우 CUDA 지원 활성화

## 테스트 방법

### 1. 웹캠 연결 테스트
```bash
# detection-service 컨테이너 내에서 테스트
docker exec -it detection-service python -c "
import cv2
cap = cv2.VideoCapture(0)
if cap.isOpened():
    print('웹캠 연결 성공')
    ret, frame = cap.read()
    if ret:
        print(f'프레임 크기: {frame.shape}')
    else:
        print('프레임 읽기 실패')
else:
    print('웹캠 연결 실패')
cap.release()
"
```

### 2. RTSP 스트림 확인
```bash
# MediaMTX RTSP 스트림 테스트
ffplay rtsp://localhost:9554/camera
```

## 주의사항

1. **보안**: 웹캠 접근 시 보안을 고려하여 적절한 권한 설정
2. **성능**: 실시간 처리 시 CPU/GPU 사용률 모니터링
3. **호환성**: 다양한 웹캠 모델의 호환성 테스트 필요

## 참고사항

- Windows 10/11에서 Docker Desktop 사용 권장
- WSL2 백엔드 사용 시 더 나은 성능
- NVIDIA GPU 사용 시 CUDA 런타임 설정 필요
