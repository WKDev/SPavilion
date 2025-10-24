# Mock Environment Guide

S-Pavilion 프로젝트의 Mock 환경 사용법입니다. 실제 하드웨어 없이도 전체 시스템을 테스트할 수 있습니다.

## 🎯 Mock 환경 구성

### Mock 서비스들
- **mock-stream**: FFmpeg를 사용한 더미 영상 RTSP 스트리밍
- **mock-modbus**: pymodbus를 사용한 PLC 시뮬레이션
- **postgres**: 데이터베이스 (실제 서비스와 동일)
- **mediamtx**: RTSP → WebRTC/HLS 변환 (실제 서비스와 동일)
- **nest**: NestJS 백엔드 API (Mock 모드로 실행)
- **detection-service**: YOLOv8 감지 서비스 (Mock 모드로 실행)

## 🚀 사용법

### 1. Mock 환경 실행

#### Linux/macOS (Bash)
```bash
# Mock 환경으로 전체 시스템 실행
MOCK_MODE=true docker-compose --profile mock up -d

# 또는 환경변수 파일 사용
echo "MOCK_MODE=true" > .env
docker-compose --profile mock up -d
```

#### Windows PowerShell
```powershell
# Mock 환경으로 전체 시스템 실행
$env:MOCK_MODE="true"; docker-compose --profile mock up -d

# 또는 환경변수 파일 사용
"MOCK_MODE=true" | Out-File -FilePath .env -Encoding utf8
docker-compose --profile mock up -d

# 한 줄로 실행
$env:MOCK_MODE="true"; docker-compose --profile mock up -d
```

### 2. 서비스별 실행

#### Linux/macOS (Bash)
```bash
# Mock 서비스들만 실행
docker-compose --profile mock up -d mock-stream mock-modbus

# 특정 서비스만 Mock 모드로 실행
MOCK_MODE=true docker-compose up -d nest detection-service
```

#### Windows PowerShell
```powershell
# Mock 서비스들만 실행
docker-compose --profile mock up -d mock-stream mock-modbus

# 특정 서비스만 Mock 모드로 실행
$env:MOCK_MODE="true"; docker-compose up -d nest detection-service
```

### 3. 하이브리드 모드

#### Linux/macOS (Bash)
```bash
# Detection만 Mock, PLC는 실제 하드웨어 사용
MOCK_MODE=detection docker-compose up -d

# PLC만 Mock, Detection은 실제 카메라 사용  
MOCK_MODE=plc docker-compose up -d
```

#### Windows PowerShell
```powershell
# Detection만 Mock, PLC는 실제 하드웨어 사용
$env:MOCK_MODE="detection"; docker-compose up -d

# PLC만 Mock, Detection은 실제 카메라 사용
$env:MOCK_MODE="plc"; docker-compose up -d
```

## 🔧 Mock 서비스 상세

### Mock Stream Service
- **포트**: RTSP 스트림을 MediaMTX로 전송
- **기능**: 테스트 비디오 파일을 무한 루프로 스트리밍
- **설정**: `mock-stream/test-video.mp4` 파일 교체 가능

```bash
# 스트림 확인
ffplay rtsp://localhost:8554/camera
```

### Mock Modbus Server
- **포트**: 502 (Modbus TCP)
- **기능**: LS XBC-DN20E PLC 시뮬레이션
- **디바이스**: 8개 디바이스 (heat, fan, btsp, lights, display)
- **타이머**: 자동 꺼짐 기능 (heat/fan: 10분, lights: 1시간)

```bash
# Modbus 클라이언트 테스트
python3 -c "
from pymodbus.client.sync import ModbusTcpClient
client = ModbusTcpClient('localhost', 502)
result = client.read_coils(0, 8)
print('Device status:', result.bits)
client.close()
"
```

## 📊 환경 변수

### 공통 환경 변수
- `MOCK_MODE`: Mock 모드 활성화 (`true`, `false`, `detection`, `plc`)
- `TZ`: 시간대 설정 (기본값: Asia/Seoul)

### NestJS Mock 설정
- `MOCK_MODBUS_HOST`: Mock Modbus 서버 호스트 (기본값: mock-modbus)
- `MOCK_MODBUS_PORT`: Mock Modbus 서버 포트 (기본값: 502)

### Detection Service Mock 설정
- `MOCK_VIDEO_FILE`: Mock 비디오 파일 경로 (기본값: /app/test-video.mp4)

## 🧪 테스트 시나리오

### 1. 기본 Mock 테스트

#### Linux/macOS (Bash)
```bash
# Mock 환경 실행
MOCK_MODE=true docker-compose --profile mock up -d

# API 테스트
curl http://localhost:3000/api/devices

# WebRTC 스트림 확인
# 브라우저에서 http://localhost:8889 접속
```

#### Windows PowerShell
```powershell
# Mock 환경 실행
$env:MOCK_MODE="true"; docker-compose --profile mock up -d

# API 테스트
Invoke-RestMethod -Uri "http://localhost:3000/api/devices" -Method Get

# 또는 curl 사용 (Windows 10+)
curl http://localhost:3000/api/devices

# WebRTC 스트림 확인
# 브라우저에서 http://localhost:8889 접속
```

### 2. 디바이스 제어 테스트

#### Linux/macOS (Bash)
```bash
# 디바이스 토글
curl -X POST http://localhost:3000/api/device-control \
  -H "Content-Type: application/json" \
  -d '{"device_kind": "heat", "action": "toggle"}'

# 상태 확인
curl http://localhost:3000/api/devices
```

#### Windows PowerShell
```powershell
# 디바이스 토글
$body = @{
    device_kind = "heat"
    action = "toggle"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/device-control" -Method Post -Body $body -ContentType "application/json"

# 또는 curl 사용
curl -X POST http://localhost:3000/api/device-control -H "Content-Type: application/json" -d '{\"device_kind\": \"heat\", \"action\": \"toggle\"}'

# 상태 확인
Invoke-RestMethod -Uri "http://localhost:3000/api/devices" -Method Get
```

### 3. 감지 데이터 테스트

#### Linux/macOS (Bash)
```bash
# 감지 데이터 전송
curl -X POST http://localhost:3000/api/bbox_history \
  -H "Content-Type: application/json" \
  -d '{
    "bboxes": [[100, 100, 50, 100], [200, 150, 60, 110]],
    "frame_count": 1,
    "camera_id": "camera_0"
  }'
```

#### Windows PowerShell
```powershell
# 감지 데이터 전송
$body = @{
    bboxes = @(@(100, 100, 50, 100), @(200, 150, 60, 110))
    frame_count = 1
    camera_id = "camera_0"
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:3000/api/bbox_history" -Method Post -Body $body -ContentType "application/json"

# 또는 curl 사용
curl -X POST http://localhost:3000/api/bbox_history -H "Content-Type: application/json" -d '{\"bboxes\": [[100, 100, 50, 100], [200, 150, 60, 110]], \"frame_count\": 1, \"camera_id\": \"camera_0\"}'
```

## 🔍 로그 확인

#### Linux/macOS (Bash)
```bash
# 전체 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f mock-modbus
docker-compose logs -f mock-stream
docker-compose logs -f nest
docker-compose logs -f detection-service
```

#### Windows PowerShell
```powershell
# 전체 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f mock-modbus
docker-compose logs -f mock-stream
docker-compose logs -f nest
docker-compose logs -f detection-service
```

## 🛠️ 개발 및 디버깅

### Mock 서비스 수정

#### Linux/macOS (Bash)
```bash
# Mock 서비스 재빌드
docker-compose build mock-stream mock-modbus

# 특정 서비스만 재시작
docker-compose restart mock-modbus
```

#### Windows PowerShell
```powershell
# Mock 서비스 재빌드
docker-compose build mock-stream mock-modbus

# 특정 서비스만 재시작
docker-compose restart mock-modbus
```

### 데이터베이스 접근

#### Linux/macOS (Bash)
```bash
# PostgreSQL 접속
docker-compose exec postgres psql -U admin -d s_pavilion

# Prisma Studio 실행
docker-compose exec nest npx prisma studio
```

#### Windows PowerShell
```powershell
# PostgreSQL 접속
docker-compose exec postgres psql -U admin -d s_pavilion

# Prisma Studio 실행
docker-compose exec nest npx prisma studio
```

## ⚠️ 주의사항

1. **포트 충돌**: Mock 환경과 실제 환경이 동일한 포트를 사용합니다
2. **데이터베이스**: Mock 환경도 실제 PostgreSQL을 사용하므로 데이터가 유지됩니다
3. **네트워크**: Mock 서비스들은 Docker 네트워크를 통해 통신합니다
4. **리소스**: Mock 환경도 실제 서비스와 유사한 리소스를 사용합니다

## 🚀 CI/CD 통합

#### GitHub Actions (Linux/macOS)
```yaml
# GitHub Actions 예시
- name: Run Mock Environment Tests
  run: |
    MOCK_MODE=true docker-compose --profile mock up -d
    sleep 30  # 서비스 시작 대기
    # 테스트 실행
    docker-compose --profile mock down
```

#### Windows (PowerShell)
```yaml
# GitHub Actions Windows 예시
- name: Run Mock Environment Tests
  shell: powershell
  run: |
    $env:MOCK_MODE="true"
    docker-compose --profile mock up -d
    Start-Sleep -Seconds 30  # 서비스 시작 대기
    # 테스트 실행
    docker-compose --profile mock down
```

## 📝 추가 Mock 서비스

새로운 Mock 서비스를 추가하려면:

1. `mock-{service-name}/` 디렉토리 생성
2. Dockerfile 및 필요한 파일들 작성
3. `docker-compose.yml`에 서비스 추가
4. `profiles: - mock` 설정
5. 필요한 환경 변수 설정

## 💡 PowerShell 추가 팁

### 환경 변수 관리
```powershell
# 환경 변수 확인
Get-ChildItem Env:MOCK_MODE

# 환경 변수 제거
Remove-Item Env:MOCK_MODE

# 영구 환경 변수 설정 (시스템 재시작 후에도 유지)
[Environment]::SetEnvironmentVariable("MOCK_MODE", "true", "User")
```

### 배치 스크립트 생성
```powershell
# mock-start.ps1 파일 생성
@"
# Mock 환경 시작 스크립트
Write-Host "Starting S-Pavilion Mock Environment..." -ForegroundColor Green
$env:MOCK_MODE="true"
docker-compose --profile mock up -d
Write-Host "Mock environment started successfully!" -ForegroundColor Green
Write-Host "API: http://localhost:3000" -ForegroundColor Yellow
Write-Host "WebRTC: http://localhost:8889" -ForegroundColor Yellow
"@ | Out-File -FilePath "mock-start.ps1" -Encoding utf8

# 스크립트 실행
.\mock-start.ps1
```

### PowerShell 함수로 만들기
```powershell
# PowerShell 프로필에 추가할 함수들
function Start-MockEnvironment {
    $env:MOCK_MODE="true"
    docker-compose --profile mock up -d
    Write-Host "Mock environment started!" -ForegroundColor Green
}

function Stop-MockEnvironment {
    docker-compose --profile mock down
    Write-Host "Mock environment stopped!" -ForegroundColor Red
}

function Get-MockLogs {
    param([string]$Service = "")
    if ($Service) {
        docker-compose logs -f $Service
    } else {
        docker-compose logs -f
    }
}

# 사용법
Start-MockEnvironment
Get-MockLogs -Service "mock-modbus"
Stop-MockEnvironment
```

이 Mock 환경을 통해 하드웨어 없이도 전체 S-Pavilion 시스템을 개발하고 테스트할 수 있습니다.
