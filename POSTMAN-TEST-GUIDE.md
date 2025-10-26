# S-Pavilion API 테스트 가이드

## 📋 개요
이 파일들은 S-Pavilion 프로젝트의 API를 Postman으로 테스트하기 위한 컬렉션과 환경 설정입니다.

## 🚀 사용법

### 1. Postman 설치 및 설정
1. [Postman](https://www.postman.com/downloads/) 다운로드 및 설치
2. Postman 실행

### 2. 컬렉션 및 환경 가져오기
1. **컬렉션 가져오기**:
   - Postman에서 `Import` 버튼 클릭
   - `S-Pavilion-API-Test.postman_collection.json` 파일 선택
   - Import 클릭

2. **환경 설정 가져오기**:
   - Postman에서 `Import` 버튼 클릭
   - `S-Pavilion-Environment.postman_environment.json` 파일 선택
   - Import 클릭

3. **환경 활성화**:
   - 우측 상단의 환경 드롭다운에서 `S-Pavilion Environment` 선택

### 3. Mock 환경 실행
```bash
# PowerShell에서 실행
$env:MOCK_MODE="true"
docker-compose --profile mock up -d
```

### 4. API 테스트 순서

#### 기본 테스트
1. **Device Status** - 디바이스 상태 확인
2. **Device Control - Toggle Heat** - 히터 토글 테스트
3. **Device Status** - 상태 변경 확인

#### 전체 디바이스 테스트
1. **Device Control - Turn On Fan** - 팬 켜기
2. **Device Control - Toggle Red Light** - 빨간 조명 토글
3. **Device Control - Turn On All Lights** - 초록 조명 켜기
4. **Device Control - Toggle Display** - 디스플레이 토글
5. **Device Control - Toggle BTSP** - BTSP 토글

#### 기타 기능 테스트
1. **Device Usage Log** - 사용 로그 기록
2. **Heatmap Data** - 히트맵 데이터 조회
3. **Bbox History Submit** - 바운딩 박스 히스토리 제출

## 📊 예상 응답

### Device Status (GET /api/devices)
```json
{
  "connected": true,
  "devices": {
    "heat": false,
    "fan": false,
    "btsp": false,
    "light_red": false,
    "light_green": false,
    "light_blue": false,
    "light_white": false,
    "display": false
  }
}
```

### Device Control (POST /api/devices/control)
```json
{
  "success": true,
  "message": "Device heat toggle command sent"
}
```

### Device Usage Log (POST /api/devices/usage)
```json
{
  "success": true,
  "id": 123
}
```

## 🔧 사용 가능한 디바이스 종류
- `heat` - 히터
- `fan` - 팬
- `btsp` - BTSP
- `light_red` - 빨간 조명
- `light_green` - 초록 조명
- `light_blue` - 파란 조명
- `light_white` - 흰색 조명
- `display` - 디스플레이

## 🎯 사용 가능한 액션
- `toggle` - 토글 (ON/OFF 전환)
- `on` - 켜기
- `off` - 끄기

## 🐛 문제 해결

### 연결 오류
- Mock 환경이 실행 중인지 확인: `docker ps`
- 포트 3000이 열려있는지 확인: `netstat -an | findstr :3000`

### API 오류
- Nest 서비스 로그 확인: `docker logs spavilion-nest-1`
- Mock-modbus 서비스 로그 확인: `docker logs mock-modbus`

### Mock 환경 재시작
```bash
docker-compose --profile mock down
$env:MOCK_MODE="true"
docker-compose --profile mock up -d
```

## 📝 참고사항
- Mock 환경에서는 실제 하드웨어 없이도 모든 기능을 테스트할 수 있습니다.
- 디바이스 상태는 100ms마다 자동으로 업데이트됩니다.
- 일부 디바이스는 자동으로 꺼지는 타이머가 있습니다 (히터/팬: 10분, 조명: 1시간).
