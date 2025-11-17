# 브라우저 접근 경로 설명

## 현재 설정

- **NestJS**: 포트 3000에서 실행
- **Next.js**: 포트 3001에서 실행
- **프록시 설정**: NestJS(3000) → Next.js(3001)로 프록시 (프록시 활성화 시)

## 브라우저 접근 시나리오

### 시나리오 1: 브라우저에서 `http://localhost:3000` 접근

```
브라우저 (3000) 
    ↓
NestJS 서버 (3000)
    ├─ /api/* → NestJS가 직접 처리 ✅
    ├─ /api-docs → Swagger가 직접 처리 ✅
    └─ 나머지 경로 (/, /about 등) → Next.js(3001)로 프록시 ✅
```

**결과**: 
- API 호출: NestJS가 직접 처리
- 일반 페이지: NestJS가 Next.js(3001)로 프록시하여 응답

### 시나리오 2: 브라우저에서 `http://localhost:3001` 접근

```
브라우저 (3001)
    ↓
Next.js 서버 (3001) 직접 접근 ✅
```

**결과**: 
- Next.js에 직접 접근 (프록시 없음)
- API 호출은 여전히 `http://localhost:3000/api`로 보냄 (CORS 사용)

## 프록시 활성화 여부에 따른 동작

### 개발 환경 (프록시 비활성화, 기본값)

```bash
# NestJS 실행
cd nest
npm run start:dev  # 프록시 비활성화

# Next.js 실행
cd next
npm run dev
```

- `http://localhost:3000` → NestJS API만 제공 (프록시 없음)
- `http://localhost:3001` → Next.js 직접 접근

### 개발 환경 (프록시 활성화)

```bash
# NestJS 실행
cd nest
ENABLE_PROXY=true npm run start:dev  # 프록시 활성화

# Next.js 실행
cd next
npm run dev
```

- `http://localhost:3000` → NestJS가 API는 직접 처리, 나머지는 Next.js로 프록시
- `http://localhost:3001` → Next.js 직접 접근 (여전히 가능)

### 프로덕션 환경 (프록시 자동 활성화)

```bash
# NestJS 실행
cd nest
npm run start:prod  # 자동으로 프록시 활성화

# Next.js 실행
cd next
npm run start
```

- `http://localhost:3000` → NestJS가 API는 직접 처리, 나머지는 Next.js로 프록시
- `http://localhost:3001` → Next.js 직접 접근 (일반적으로 사용하지 않음)

## 실제 사용 예시

### Electron 앱 (next/electron/main.js 참고)

```javascript
// 개발 모드
if (isDev) {
  win.loadURL('http://localhost:3001');  // Next.js 직접 접근
} else {
  win.loadURL('http://localhost:3000');  // NestJS 프록시 사용
}
```

## 정리

**질문**: 브라우저에서 3000번 포트로 들어가나 3001번 포트로 들어가나 모두 3001번 포트로 가는거지?

**답변**: 아니요!

- **3000번 포트 접근**: NestJS(3000)가 받아서, API가 아니면 Next.js(3001)로 **프록시**합니다
- **3001번 포트 접근**: Next.js(3001)에 **직접** 접근합니다 (프록시 없음)

둘 다 최종적으로는 Next.js의 내용을 보지만, 경로가 다릅니다:
- 3000번: NestJS → Next.js (프록시 경로)
- 3001번: Next.js (직접 접근)

**권장사항**:
- 개발 환경: 3001번 포트 직접 사용 (프록시 불필요)
- 프로덕션 환경: 3000번 포트 사용 (단일 포트로 통합)

