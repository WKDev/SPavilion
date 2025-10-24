# Docker 개발 환경 가이드

Docker 컨테이너에서 로컬 폴더를 마운트하여 빌드 없이 바로 개발할 수 있는 환경 설정입니다.

## 🎯 변경사항

### 기존 방식 (빌드 필요)
```yaml
nest:
  build:
    context: ./nest
    dockerfile: Dockerfile
```

### 새로운 방식 (빌드 불필요)
```yaml
nest:
  image: node:20-alpine
  volumes:
    - ./nest:/app  # 로컬 폴더 마운트
    - /app/node_modules  # node_modules 보존
  command: sh -c "npm install && npm run start:dev"
```

## 🚀 사용법

### 1. NestJS 개발 (Docker)
```bash
# NestJS 컨테이너에서 개발
docker-compose up -d nest

# 코드 변경 시 자동 재시작 (Hot Reload)
# 로컬에서 파일 수정 → 컨테이너에서 즉시 반영
```

### 2. Detection Service 개발 (Docker)
```bash
# Detection Service 컨테이너에서 개발
docker-compose up -d detection-service

# Python 코드 변경 시 수동 재시작 필요
docker-compose restart detection-service
```

### 3. React 개발 (Docker)
```bash
# React 개발 서버 (Docker)
docker-compose --profile development up -d react-dev

# 코드 변경 시 자동 Hot Reload
```

## 🔧 설정 상세

### NestJS 컨테이너
- **이미지**: `node:20-alpine`
- **마운트**: `./nest:/app`
- **명령어**: `npm install && npm run start:dev`
- **포트**: `3000:3000`

### Detection Service 컨테이너
- **이미지**: `python:3.11-slim`
- **마운트**: `./detection-service:/app`
- **명령어**: `pip install -r requirements.txt && python main.py`
- **포트**: 내부 통신만

### React 개발 서버 컨테이너
- **이미지**: `node:20-alpine`
- **마운트**: `./s-pavilion-react:/app`
- **명령어**: `npm install && npm run dev -- --host 0.0.0.0`
- **포트**: `5173:5173`

## 💡 장점

### 1. **빠른 개발**
- 빌드 과정 생략
- 코드 변경 시 즉시 반영
- Docker 이미지 재빌드 불필요

### 2. **일관된 환경**
- 모든 개발자가 동일한 Node.js/Python 버전 사용
- 의존성 관리 자동화
- 환경 변수 통일

### 3. **유연성**
- 로컬 개발과 Docker 개발 모두 지원
- Mock 환경과 실제 환경 쉽게 전환
- CI/CD와 동일한 환경

## 🛠️ 개발 워크플로우

### 1. 초기 설정
```bash
# Mock 환경으로 전체 개발 환경 시작
MOCK_MODE=true docker-compose --profile mock up -d

# 또는 특정 서비스만 시작
docker-compose up -d nest
docker-compose up -d detection-service
```

### 2. 개발 중
```bash
# NestJS 코드 수정
# → 자동으로 컨테이너에서 재시작

# Detection Service 코드 수정
# → 수동 재시작 필요
docker-compose restart detection-service

# React 코드 수정
# → 자동으로 Hot Reload
```

### 3. 로그 확인
```bash
# 실시간 로그 확인
docker-compose logs -f nest
docker-compose logs -f detection-service
docker-compose logs -f react-dev
```

## 🔍 문제 해결

### 1. node_modules 문제
```bash
# node_modules 초기화
docker-compose down
docker volume prune
docker-compose up -d nest
```

### 2. 권한 문제 (Linux/macOS)
```bash
# 파일 권한 수정
sudo chown -R $USER:$USER ./nest
sudo chown -R $USER:$USER ./detection-service
sudo chown -R $USER:$USER ./s-pavilion-react
```

### 3. 포트 충돌
```bash
# 포트 사용 확인
netstat -tulpn | grep :3000
lsof -i :3000

# Windows PowerShell
Get-NetTCPConnection -LocalPort 3000
```

### 4. 컨테이너 재시작
```bash
# 특정 서비스 재시작
docker-compose restart nest
docker-compose restart detection-service

# 전체 재시작
docker-compose down && docker-compose up -d
```

## 📊 성능 비교

| 방식 | 빌드 시간 | 코드 반영 | 환경 일관성 | 설정 복잡도 |
|------|-----------|-----------|-------------|-------------|
| 기존 (빌드) | 2-5분 | 느림 | 높음 | 중간 |
| 새로운 (마운트) | 0초 | 빠름 | 높음 | 낮음 |
| 로컬 개발 | 0초 | 즉시 | 낮음 | 낮음 |

## 🚀 추천 사용법

### 1. **일반 개발**
```bash
# Mock 환경으로 전체 시작
MOCK_MODE=true docker-compose --profile mock up -d
```

### 2. **특정 서비스 개발**
```bash
# NestJS만 Docker에서 개발
docker-compose up -d nest

# Detection Service만 Docker에서 개발
docker-compose up -d detection-service
```

### 3. **하이브리드 개발**
```bash
# Mock 컨테이너들만 실행
MOCK_MODE=true docker-compose --profile mock up -d postgres mock-modbus mock-stream mediamtx

# NestJS는 로컬에서 개발
cd nest && npm run start:dev
```

## 💡 추가 팁

### 1. **VS Code 개발**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS in Docker",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "localRoot": "${workspaceFolder}/nest",
      "remoteRoot": "/app"
    }
  ]
}
```

### 2. **환경 변수 관리**
```bash
# .env 파일 사용
# nest/.env
DATABASE_URL=postgresql://admin:changeme@postgres:5432/s_pavilion
MOCK_MODE=true
```

### 3. **스크립트 자동화**
```bash
# start-dev.sh
#!/bin/bash
echo "Starting development environment..."
MOCK_MODE=true docker-compose --profile mock up -d
echo "Development environment started!"
echo "NestJS: http://localhost:3000"
echo "React: http://localhost:5173"
```

이제 Docker 컨테이너에서 빌드 없이 바로 개발할 수 있습니다! 🎉
