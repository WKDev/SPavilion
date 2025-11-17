# Electron 설정

이 디렉토리는 Electron 애플리케이션 설정을 포함합니다.

## 파일 구조

- `main.js`: Electron 메인 프로세스 파일
- `preload.js`: Preload 스크립트 (보안을 위한 브리지)
- `favicon.ico`: 애플리케이션 아이콘 (이 파일을 추가해주세요)

## 사용 방법

### 개발 모드

1. Next.js 개발 서버 실행:
   ```bash
   npm run dev
   ```

2. 별도 터미널에서 Electron 실행:
   ```bash
   npm run electron:dev
   ```

### 프로덕션 모드

1. Next.js 빌드 및 실행:
   ```bash
   npm run build
   npm run start
   ```

2. 별도 터미널에서 Electron 실행:
   ```bash
   npm run electron
   ```

### EXE 패키징

electron-builder를 사용하여 Windows 실행 파일(.exe)을 생성할 수 있습니다.

#### 설치 (최초 1회)
```bash
npm install
```

#### 패키징 실행

1. **전체 빌드 (설치 파일 + 포터블)**
   ```bash
   npm run electron:dist
   ```
   - `dist-electron` 폴더에 다음 파일들이 생성됩니다:
     - `스마트 쉼터 Setup 0.1.0.exe` (NSIS 설치 파일)
     - `스마트 쉼터-0.1.0-portable.exe` (포터블 실행 파일)

2. **설치 파일만 빌드**
   ```bash
   npm run electron:pack
   ```

3. **빌드된 파일 확인 (설치하지 않고)**
   ```bash
   npm run electron:dist:dir
   ```
   - `dist-electron/win-unpacked` 폴더에 압축 해제된 파일들이 생성됩니다.

#### 패키징된 파일 실행

패키징된 Electron 앱은 Next.js 서버가 실행 중이어야 합니다:
- 개발 모드: `localhost:3001`
- 프로덕션 모드: `localhost:3000`

## 기능

- **커스텀 뷰어**: 주소창 없이 localhost:3000 (또는 3001)에서 실행
- **자동 시작**: 파일 메뉴에서 "자동 시작" 체크박스로 토글 가능
- **창 위치/크기 저장**: 마지막 창 위치와 크기를 저장하고 복원
- **검증**: 창이 모니터 밖에 있으면 기본값(중앙, 1200x800) 사용

## 아이콘 설정

`favicon.ico` 파일을 이 디렉토리에 추가하세요. 권장 크기는 256x256 픽셀입니다.

현재 사용 중인 아이콘 파일이 없으면 기본 Electron 아이콘이 사용됩니다.

