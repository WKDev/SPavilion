# NestJS/Next.js 프록시 설정 분석 및 확인

## 프록시 구조

### 1. NestJS → Next.js 프록시 (포트 3000 → 3001)

**설정 위치**: `nest/src/main.ts`

**동작 방식**:
- NestJS(3000)가 Next.js(3001)로 프록시합니다
- `/api` 경로는 제외하고 NestJS가 직접 처리
- `/api-docs` 경로는 제외하고 Swagger가 처리
- 나머지 모든 경로는 Next.js로 프록시

**활성화 조건**:
- `NODE_ENV=production` 또는 `ENABLE_PROXY=true`일 때 활성화
- 개발 모드에서는 기본적으로 비활성화 (직접 접근 가능)

**코드 위치**: `nest/src/main.ts:53-94`

### 2. Next.js → NestJS API 호출

**설정 위치**: `next/lib/api.ts`

**동작 방식**:
- Next.js는 프록시를 사용하지 않고 직접 API를 호출합니다
- 기본 API URL: `http://localhost:3000/api` (환경 변수로 변경 가능)
- 환경 변수: `NEXT_PUBLIC_API_URL` (기본값: `http://localhost:3000/api`)

**코드 위치**: `next/lib/api.ts:21`

## 프록시 설정 검증

### ✅ 올바른 점

1. **경로 제외 로직**: `/api`와 `/api-docs` 경로가 올바르게 제외됨
2. **프록시 미들웨어**: `http-proxy-middleware`를 올바르게 사용
3. **에러 처리**: 프록시 오류 시 502 응답 처리
4. **WebSocket 지원**: HMR 등을 위한 WebSocket 지원
5. **환경 변수**: `NEXTJS_URL`로 프록시 대상 URL 설정 가능

### ⚠️ 잠재적 문제점

1. **미들웨어 순서**: 
   - NestJS는 Express 기반이므로 라우팅이 먼저 처리됨
   - 현재 설정은 올바르지만, 명시적으로 경로 제외를 하고 있어 문제 없음

2. **개발 환경 프록시 비활성화**:
   - 개발 환경에서는 프록시가 기본적으로 비활성화됨
   - 이는 의도된 동작이지만, 테스트 시 `ENABLE_PROXY=true` 필요

3. **Next.js 프록시 없음**:
   - Next.js는 API 호출을 위해 프록시를 사용하지 않음
   - 직접 `http://localhost:3000/api`로 호출
   - 이는 정상적인 설정 (CORS가 활성화되어 있음)

## 테스트 방법

### 1. 서버 실행

```bash
# Terminal 1: NestJS 서버 실행
cd nest
npm run start:dev

# Terminal 2: Next.js 서버 실행 (프록시 테스트용)
cd next
npm run dev
```

### 2. 프록시 활성화 (개발 환경)

```bash
# NestJS 프록시 활성화
cd nest
ENABLE_PROXY=true npm run start:dev
```

### 3. 테스트 스크립트 실행

```bash
node test-proxy.js
```

### 4. 수동 테스트

#### NestJS API 직접 접근 확인
```bash
curl http://localhost:3000/api/health
```

#### 프록시 동작 확인 (프록시 활성화 상태)
```bash
curl http://localhost:3000/
# Next.js 응답이 반환되어야 함
```

#### API 경로 프록시 제외 확인
```bash
curl http://localhost:3000/api/devices
# NestJS API 응답이 반환되어야 함 (프록시되지 않음)
```

## 프록시 동작 시나리오

### 시나리오 1: 개발 환경 (프록시 비활성화)
- Next.js: `http://localhost:3001` 직접 접근
- NestJS API: `http://localhost:3000/api` 직접 호출
- CORS 활성화로 정상 작동

### 시나리오 2: 개발 환경 (프록시 활성화)
- Next.js: `http://localhost:3000`로 접근 (NestJS가 프록시)
- NestJS API: `http://localhost:3000/api` 직접 호출
- 프록시를 통해 Next.js 제공

### 시나리오 3: 프로덕션 환경
- Next.js: `http://localhost:3000`로 접근 (NestJS가 프록시)
- NestJS API: `http://localhost:3000/api` 직접 호출
- 자동으로 프록시 활성화

## 권장 사항

1. **프록시 테스트**: 개발 환경에서도 프록시를 테스트하려면 `ENABLE_PROXY=true` 사용
2. **환경 변수 설정**: `.env` 파일에 `NEXTJS_URL` 설정 (필요시)
3. **에러 로깅**: 프록시 오류는 이미 로깅되지만, 모니터링 추가 권장
4. **헬스 체크**: Next.js 서버 가용성 확인 후 프록시 활성화 고려

## 결론

프록시 설정은 **올바르게 구성**되어 있습니다. 다만:
- 개발 환경에서는 기본적으로 비활성화됨 (의도된 동작)
- 프로덕션 환경에서는 자동으로 활성화됨
- 테스트 시 `ENABLE_PROXY=true` 환경 변수 사용 필요

