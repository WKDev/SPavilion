/**
 * S-Pavilion NestJS Backend Service
 *
 * This file is executed by the Windows Service.
 * It runs the NestJS production server.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 로그 디렉토리 생성
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 로그 파일 경로
const logFile = path.join(logDir, `nest-service-${new Date().toISOString().split('T')[0]}.log`);
const errorLogFile = path.join(logDir, `nest-service-error-${new Date().toISOString().split('T')[0]}.log`);

// 로그 파일 스트림 생성
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const errorLogStream = fs.createWriteStream(errorLogFile, { flags: 'a' });

// 타임스탬프가 포함된 로그 함수
function writeLog(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // 콘솔에도 출력
  if (isError) {
    console.error(logMessage.trim());
    errorLogStream.write(logMessage);
  } else {
    console.log(logMessage.trim());
  }
  
  logStream.write(logMessage);
}

writeLog('='.repeat(60));
writeLog('S-Pavilion NestJS Backend Service');
writeLog('='.repeat(60));
writeLog('');
writeLog('Starting NestJS production server...');
writeLog(`Working directory: ${__dirname}`);
writeLog(`Node version: ${process.version}`);
writeLog(`Log file: ${logFile}`);
writeLog(`Error log file: ${errorLogFile}`);
writeLog('');

// Change to the nest directory
process.chdir(__dirname);

// Start NestJS production server
// prestart:prod를 건너뛰기 위해 직접 빌드된 파일 실행
const child = spawn('node', ['dist/src/main'], {
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe'], // stdin은 무시, stdout/stderr는 파이프로 캡처
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    ENABLE_PROXY: 'true', // Enable proxy to Next.js server (port 3001)
  },
});

// stdout을 로그 파일과 콘솔에 출력
child.stdout.on('data', (data) => {
  const message = data.toString();
  writeLog(message.trim());
});

// stderr를 에러 로그 파일과 콘솔에 출력
child.stderr.on('data', (data) => {
  const message = data.toString();
  writeLog(message.trim(), true);
});

child.on('error', (error) => {
  writeLog(`Failed to start NestJS server: ${error.message}`, true);
  writeLog(`Error stack: ${error.stack}`, true);
  errorLogStream.end();
  logStream.end();
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (code !== 0) {
    writeLog(`NestJS server exited with code ${code}`, true);
  }
  if (signal) {
    writeLog(`NestJS server was killed with signal ${signal}`, true);
  }
  writeLog(`Service wrapper exiting with code ${code || 0}`);
  errorLogStream.end();
  logStream.end();
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  writeLog('Received SIGTERM, shutting down gracefully...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  writeLog('Received SIGINT, shutting down gracefully...');
  child.kill('SIGINT');
});

// 처리되지 않은 예외 로깅
process.on('uncaughtException', (error) => {
  writeLog(`Uncaught Exception: ${error.message}`, true);
  writeLog(`Stack: ${error.stack}`, true);
});

process.on('unhandledRejection', (reason, promise) => {
  writeLog(`Unhandled Rejection at: ${promise}`, true);
  writeLog(`Reason: ${reason}`, true);
});
