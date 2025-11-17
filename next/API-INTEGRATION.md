# API 연동 가이드

Next.js 프론트엔드와 NestJS 백엔드 API 연동 문서

## 🚀 빠른 시작

### 1. 환경 변수 설정

`next/.env.local` 파일이 생성되어 있습니다:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WEBRTC_URL=http://localhost:8889
```

### 2. 서버 실행

**터미널 1 - NestJS 백엔드:**
```bash
cd nest
npm run start:dev
# 포트: 3000
```

**터미널 2 - Next.js 프론트엔드:**
```bash
cd next
pnpm dev
# 포트: 3001 (자동 설정됨)
```

### 3. 접속

- **프론트엔드**: http://localhost:3001
- **백엔드 API**: http://localhost:3000/api
- **Swagger 문서**: http://localhost:3000/api-docs

## 📡 구현된 API

### 1. 장치 상태 조회
```typescript
import { api } from "@/lib/api"

// GET /api/devices
const devices = await api.getDevices()
// 반환: Device[] (8개 장치)
```

### 2. 장치 제어
```typescript
import { api } from "@/lib/api"

// POST /api/devices/control
await api.controlDevice("heat", "toggle")
await api.controlDevice("light-red", "on")
await api.controlDevice("fan", "off")
```

### 3. 히트맵 데이터 조회
```typescript
import { api } from "@/lib/api"

// GET /api/heatmap?from=&to=
const heatmapData = await api.getHeatmap({
  from: new Date("2025-01-01"),
  to: new Date("2025-01-02"),
})
```

## 🔄 실시간 폴링

### 자동 폴링 (PLCPollingProvider 사용)

대시보드 레이아웃에서 자동으로 활성화됩니다:

```typescript
// app/(dashboard)/layout.tsx
import { PLCPollingProvider } from "@/components/providers/plc-polling-provider"

<PLCPollingProvider interval={1000}>
  {children}
</PLCPollingProvider>
```

### 수동 폴링 (usePLCPolling 훅)

```typescript
"use client"
import { usePLCPolling } from "@/hooks/use-plc-polling"

function MyComponent() {
  const { isActive, error, stop, start, setInterval } = usePLCPolling(
    true,  // enabled
    1000   // interval (ms)
  )

  return (
    <div>
      <p>폴링 상태: {isActive ? "활성" : "비활성"}</p>
      {error && <p>에러: {error.message}</p>}
      <button onClick={stop}>중지</button>
      <button onClick={start}>시작</button>
    </div>
  )
}
```

## 🔧 Device ID 매핑

UI와 API 간 장치 ID 형식이 다릅니다:

| UI (DeviceId) | API (DeviceKind) |
|---------------|------------------|
| `light-red`   | `light_red`      |
| `light-green` | `light_green`    |
| `light-blue`  | `light_blue`     |
| `light-white` | `light_white`    |
| `heat`        | `heat`           |
| `fan`         | `fan`            |
| `btsp`        | `btsp`           |
| `display`     | `display`        |

변환은 자동으로 처리됩니다:

```typescript
import { toApiDeviceKind, toUiDeviceId } from "@/lib/device-mapper"

toApiDeviceKind("light-red")  // "light_red"
toUiDeviceId("light_red")     // "light-red"
```

## 📝 타입 정의

모든 API 타입은 `lib/types.ts`에 정의되어 있습니다:

```typescript
import type {
  Device,
  DeviceId,
  DeviceKind,
  GetDevicesResponse,
  DeviceControlRequest,
  HeatmapData,
  ApiError,
} from "@/lib/types"
```

## ⚠️ 에러 핸들링

```typescript
import { api, ApiClientError } from "@/lib/api"

try {
  await api.controlDevice("heat", "toggle")
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error(`API 에러 [${error.statusCode}]:`, error.message)
    // error.statusCode: HTTP 상태 코드
    // error.message: 에러 메시지
  } else {
    console.error("알 수 없는 에러:", error)
  }
}
```

## 🚧 TODO (추후 구현 필요)

다음 API 엔드포인트는 백엔드에 아직 구현되지 않았습니다:

1. **Usage History** - 장치 사용 히스토리
   - `GET /api/devices/usage-history?from=&to=`
   - 현재는 Mock 데이터 반환

2. **PLC Coils/Registers** - PLC 디버그 기능
   - `GET /api/plc/coils` - Coil 조회
   - `POST /api/plc/coils/:address` - Coil 설정
   - `GET /api/plc/registers` - Register 조회
   - `POST /api/plc/registers/:address` - Register 설정
   - 현재는 Mock 데이터 반환

## 🔍 디버깅

### API 호출 확인

브라우저 개발자 도구 → Network 탭에서 확인:

- `GET http://localhost:3000/api/devices`
- `POST http://localhost:3000/api/devices/control`
- `GET http://localhost:3000/api/heatmap?from=...&to=...`

### CORS 에러

CORS 에러가 발생하면:

1. NestJS가 3000 포트에서 실행 중인지 확인
2. Next.js가 3001 포트에서 실행 중인지 확인
3. `nest/src/main.ts`의 CORS 설정 확인

### 연결 실패

네트워크 에러 발생 시:

1. NestJS 서버가 실행 중인지 확인
2. PostgreSQL이 실행 중인지 확인 (Docker Compose)
3. `.env` 파일 확인 (nest/.env)

## 📚 참고 파일

- `next/lib/api.ts` - API 클라이언트
- `next/lib/types.ts` - TypeScript 타입 정의
- `next/lib/device-mapper.ts` - Device ID 매핑
- `next/lib/device-polling.ts` - 폴링 서비스
- `next/hooks/use-plc-polling.ts` - 폴링 훅
- `nest/src/devices/devices.controller.ts` - 백엔드 컨트롤러
- `nest/src/dto/` - 백엔드 DTO
