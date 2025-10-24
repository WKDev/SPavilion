# Mock Modbus Server

pymodbus를 사용하여 LS XBC-DN20E PLC를 시뮬레이션하는 Mock 서비스입니다.

## 기능

- Modbus TCP 서버 (포트 502)
- 8개 디바이스 상태 시뮬레이션
- 타이머 기반 자동 꺼짐 기능
- NestJS 백엔드와 연동

## 디바이스 매핑

### 상태 코일 (0x00-0x07)
- 0x00: heat_status
- 0x01: fan_status  
- 0x02: btsp_status
- 0x03: light_red_status
- 0x04: light_green_status
- 0x05: light_blue_status
- 0x06: light_white_status
- 0x07: display_status

### 제어 코일 (0x10-0x17)
- 0x10: heat_set
- 0x11: fan_set
- 0x12: btsp_set
- 0x13: light_red_set
- 0x14: light_green_set
- 0x15: light_blue_set
- 0x16: light_white_set
- 0x17: display_set

## 타이머 설정

- **heat, fan**: 10분 자동 꺼짐
- **btsp, lights**: 1시간 자동 꺼짐
- **display**: 수동 토글 (타이머 없음)

## 사용법

```bash
# Mock 환경에서 실행
docker-compose --profile mock up -d mock-modbus

# Modbus 클라이언트로 테스트
python3 -c "
from pymodbus.client.sync import ModbusTcpClient
client = ModbusTcpClient('localhost', 502)
result = client.read_coils(0, 8)
print('Device status:', result.bits)
client.close()
"
```

## 로그

서버는 다음과 같은 로그를 출력합니다:
- 디바이스 상태 변경
- 타이머 만료로 인한 자동 꺼짐
- Modbus 요청/응답
