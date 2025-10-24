# 로컬 개발 환경 가이드

Mock 환경의 Docker 컨테이너들과 로컬에서 실행하는 NestJS/React 간의 통신 설정 방법입니다.

## 🎯 시나리오

- **Docker 컨테이너**: postgres, mock-modbus, mock-stream, mediamtx
- **로컬 실행**: NestJS (포트 3000), React (포트 5173)

## 🚀 설정 방법

### 1. Mock 컨테이너들만 실행

```bash
# Linux/macOS
MOCK_MODE=true docker-compose --profile mock up -d postgres mock-modbus mock-stream mediamtx

# Windows PowerShell
$env:MOCK_MODE="true"; docker-compose --profile mock up -d postgres mock-modbus mock-stream mediamtx
```

### 2. NestJS 로컬 실행 설정

#### 환경 변수 설정
```bash
# .env 파일 생성 (nest 디렉토리에)
DATABASE_URL=postgresql://admin:changeme@localhost:5432/s_pavilion
MOCK_MODE=true
MOCK_MODBUS_HOST=localhost
MOCK_MODBUS_PORT=502
NODE_ENV=development
```

#### PowerShell에서 환경 변수 설정
```powershell
# PowerShell에서 환경 변수 설정
$env:DATABASE_URL="postgresql://admin:changeme@localhost:5432/s_pavilion"
$env:MOCK_MODE="true"
$env:MOCK_MODBUS_HOST="localhost"
$env:MOCK_MODBUS_PORT="502"
$env:NODE_ENV="development"
```

### 3. React 로컬 실행 설정

#### 환경 변수 설정
```bash
# .env 파일 생성 (s-pavilion-react 디렉토리에)
VITE_API_URL=http://localhost:3000
VITE_WEBRTC_URL=http://localhost:8889
```

#### PowerShell에서 환경 변수 설정
```powershell
# PowerShell에서 환경 변수 설정
$env:VITE_API_URL="http://localhost:3000"
$env:VITE_WEBRTC_URL="http://localhost:8889"
```

## 🔧 실행 순서

### 1. 컨테이너 시작
```bash
# Mock 컨테이너들만 실행
MOCK_MODE=true docker-compose --profile mock up -d postgres mock-modbus mock-stream mediamtx
```

### 2. NestJS 로컬 실행
```bash
cd nest
npm install
npm run start:dev
```

### 3. React 로컬 실행
```bash
cd s-pavilion-react
npm install
npm run dev
```

## 🧪 테스트

### 1. 데이터베이스 연결 테스트
```bash
# PostgreSQL 연결 확인
psql -h localhost -p 5432 -U admin -d s_pavilion
```

### 2. Mock Modbus 연결 테스트
```python
# Python으로 Modbus 테스트
from pymodbus.client.sync import ModbusTcpClient
client = ModbusTcpClient('localhost', 502)
result = client.read_coils(0, 8)
print('Device status:', result.bits)
client.close()
```

### 3. API 테스트
```bash
# NestJS API 테스트
curl http://localhost:3000/api/devices
```

### 4. WebRTC 스트림 테스트
```bash
# RTSP 스트림 확인
ffplay rtsp://localhost:8554/camera
```

## 🔍 문제 해결

### 포트 충돌 해결
```bash
# 포트 사용 확인
netstat -tulpn | grep :3000
lsof -i :3000

# Windows PowerShell
Get-NetTCPConnection -LocalPort 3000
```

### Docker 네트워크 확인
```bash
# Docker 네트워크 확인
docker network ls
docker network inspect s-pavilion_s-pavilion-network
```

### 컨테이너 로그 확인
```bash
# 특정 컨테이너 로그
docker-compose logs -f mock-modbus
docker-compose logs -f postgres
```

## 📊 통신 다이어그램

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   로컬 React    │    │  로컬 NestJS    │    │  Docker 컨테이너들 │
│   (포트 5173)   │    │   (포트 3000)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         │              ┌────────▼────────┐              │
         │              │   PostgreSQL    │              │
         │              │  (포트 5432)    │              │
         │              └─────────────────┘              │
         │                       │                       │
         │              ┌────────▼────────┐              │
         │              │  Mock Modbus    │              │
         │              │   (포트 502)    │              │
         │              └─────────────────┘              │
         │                       │                       │
         │              ┌────────▼────────┐              │
         │              │   MediaMTX      │              │
         │              │ (포트 8889)     │              │
         │              └─────────────────┘              │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Mock Stream          │
                    │   (RTSP 스트림)         │
                    └─────────────────────────┘
```

## 🚀 개발 워크플로우

### 1. 초기 설정
```bash
# 1. Mock 컨테이너들 시작
MOCK_MODE=true docker-compose --profile mock up -d postgres mock-modbus mock-stream mediamtx

# 2. NestJS 개발 서버 시작
cd nest && npm run start:dev

# 3. React 개발 서버 시작 (새 터미널)
cd s-pavilion-react && npm run dev
```

### 2. 개발 중
- NestJS 코드 변경 시 자동 재시작
- React 코드 변경 시 Hot Reload
- Mock 서비스들은 계속 실행

### 3. 종료
```bash
# 컨테이너 종료
docker-compose --profile mock down

# 또는 특정 컨테이너만 종료
docker-compose stop mock-modbus
```

## 💡 팁

### 1. 환경 변수 관리
```bash
# .env 파일을 사용하여 환경 변수 관리
# nest/.env
DATABASE_URL=postgresql://admin:changeme@localhost:5432/s_pavilion
MOCK_MODE=true
MOCK_MODBUS_HOST=localhost
MOCK_MODBUS_PORT=502

# s-pavilion-react/.env
VITE_API_URL=http://localhost:3000
VITE_WEBRTC_URL=http://localhost:8889
```

### 2. 스크립트 자동화
```bash
# start-local-dev.sh
#!/bin/bash
echo "Starting local development environment..."
MOCK_MODE=true docker-compose --profile mock up -d postgres mock-modbus mock-stream mediamtx
echo "Mock containers started!"
echo "Now run: cd nest && npm run start:dev"
echo "And in another terminal: cd s-pavilion-react && npm run dev"
```

### 3. PowerShell 스크립트
```powershell
# start-local-dev.ps1
Write-Host "Starting local development environment..." -ForegroundColor Green
$env:MOCK_MODE="true"
docker-compose --profile mock up -d postgres mock-modbus mock-stream mediamtx
Write-Host "Mock containers started!" -ForegroundColor Green
Write-Host "Now run: cd nest && npm run start:dev" -ForegroundColor Yellow
Write-Host "And in another terminal: cd s-pavilion-react && npm run dev" -ForegroundColor Yellow
```

이 설정을 통해 Docker 컨테이너들과 로컬 개발 환경을 효율적으로 연동할 수 있습니다!
