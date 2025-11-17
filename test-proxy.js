/**
 * NestJS/Next.js 프록시 동작 확인 스크립트
 * 
 * 테스트 항목:
 * 1. NestJS 서버 상태 확인 (포트 3000)
 * 2. Next.js 서버 상태 확인 (포트 3001)
 * 3. NestJS API 엔드포인트 직접 접근 확인
 * 4. NestJS 프록시 동작 확인 (루트 경로가 Next.js로 프록시되는지)
 * 5. API 경로가 프록시되지 않고 NestJS가 처리하는지 확인
 */

const http = require('http');

// 테스트 결과 저장
const results = {
  nestjs: { status: 'unknown', port: 3000 },
  nextjs: { status: 'unknown', port: 3001 },
  proxy: { status: 'unknown' },
  api: { status: 'unknown' },
};

// 색상 출력 함수
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// HTTP 요청 헬퍼
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// 1. NestJS 서버 상태 확인
async function testNestJS() {
  log('\n[1] NestJS 서버 상태 확인 (포트 3000)...', 'blue');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET',
    });

    if (response.statusCode === 200) {
      results.nestjs.status = 'running';
      log('✓ NestJS 서버가 정상적으로 실행 중입니다', 'green');
      log(`  응답: ${response.data.substring(0, 100)}`, 'reset');
      return true;
    } else {
      results.nestjs.status = 'error';
      log(`✗ NestJS 서버 응답 오류: ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    results.nestjs.status = 'not_running';
    log(`✗ NestJS 서버에 연결할 수 없습니다: ${error.message}`, 'red');
    return false;
  }
}

// 2. Next.js 서버 상태 확인
async function testNextJS() {
  log('\n[2] Next.js 서버 상태 확인 (포트 3001)...', 'blue');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/',
      method: 'GET',
    });

    if (response.statusCode === 200 || response.statusCode === 304) {
      results.nextjs.status = 'running';
      log('✓ Next.js 서버가 정상적으로 실행 중입니다', 'green');
      log(`  상태 코드: ${response.statusCode}`, 'reset');
      return true;
    } else {
      results.nextjs.status = 'error';
      log(`✗ Next.js 서버 응답 오류: ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    results.nextjs.status = 'not_running';
    log(`✗ Next.js 서버에 연결할 수 없습니다: ${error.message}`, 'red');
    return false;
  }
}

// 3. NestJS API 엔드포인트 직접 접근 확인
async function testAPIEndpoints() {
  log('\n[3] NestJS API 엔드포인트 직접 접근 테스트...', 'blue');
  
  const endpoints = [
    { path: '/api/health', name: 'Health Check' },
    { path: '/api/devices', name: 'Devices' },
  ];

  let successCount = 0;
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: endpoint.path,
        method: 'GET',
      });

      if (response.statusCode === 200 || response.statusCode === 404) {
        // 404는 엔드포인트가 존재하지만 데이터가 없을 수 있음
        log(`✓ ${endpoint.name} (${endpoint.path}): ${response.statusCode}`, 'green');
        successCount++;
      } else {
        log(`✗ ${endpoint.name} (${endpoint.path}): ${response.statusCode}`, 'red');
      }
    } catch (error) {
      log(`✗ ${endpoint.name} (${endpoint.path}): ${error.message}`, 'red');
    }
  }

  if (successCount === endpoints.length) {
    results.api.status = 'ok';
    log('✓ 모든 API 엔드포인트가 정상적으로 접근 가능합니다', 'green');
    return true;
  } else {
    results.api.status = 'partial';
    log(`⚠ 일부 API 엔드포인트에 문제가 있습니다 (${successCount}/${endpoints.length})`, 'yellow');
    return false;
  }
}

// 4. NestJS 프록시 동작 확인
async function testProxy() {
  log('\n[4] NestJS 프록시 동작 확인 (루트 경로 → Next.js)...', 'blue');
  
  try {
    // NestJS의 루트 경로에 접근 (Next.js로 프록시되어야 함)
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET',
    });

    // Next.js는 일반적으로 HTML을 반환하거나 200/304 상태 코드를 반환
    const contentType = response.headers['content-type'] || '';
    const isHTML = contentType.includes('text/html');
    
    if (response.statusCode === 200 || response.statusCode === 304) {
      if (isHTML) {
        results.proxy.status = 'working';
        log('✓ 프록시가 정상적으로 동작합니다 (루트 경로가 Next.js로 프록시됨)', 'green');
        log(`  상태 코드: ${response.statusCode}`, 'reset');
        log(`  Content-Type: ${contentType}`, 'reset');
        return true;
      } else {
        results.proxy.status = 'suspicious';
        log(`⚠ 프록시는 동작하지만 HTML이 아닌 응답을 받았습니다: ${contentType}`, 'yellow');
        return false;
      }
    } else {
      results.proxy.status = 'error';
      log(`✗ 프록시 응답 오류: ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    results.proxy.status = 'error';
    log(`✗ 프록시 테스트 실패: ${error.message}`, 'red');
    return false;
  }
}

// 5. API 경로가 프록시되지 않는지 확인
async function testAPIExclusion() {
  log('\n[5] API 경로 프록시 제외 확인...', 'blue');
  
  try {
    // /api 경로가 NestJS에서 직접 처리되는지 확인
    // 프록시가 작동한다면, /api 경로는 Next.js로 프록시되지 않고 NestJS가 처리해야 함
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET',
    });

    // API 경로는 NestJS가 직접 처리하므로 JSON 응답을 받아야 함
    const contentType = response.headers['content-type'] || '';
    const isJSON = contentType.includes('application/json');

    if (isJSON && response.statusCode === 200) {
      log('✓ API 경로가 프록시되지 않고 NestJS가 직접 처리합니다', 'green');
      log(`  응답: ${response.data.substring(0, 100)}`, 'reset');
      return true;
    } else {
      log(`⚠ API 경로 응답이 예상과 다릅니다 (Status: ${response.statusCode}, Content-Type: ${contentType})`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`✗ API 경로 테스트 실패: ${error.message}`, 'red');
    return false;
  }
}

// 메인 테스트 실행
async function runTests() {
  log('='.repeat(60), 'blue');
  log('NestJS/Next.js 프록시 동작 확인 테스트', 'blue');
  log('='.repeat(60), 'blue');

  const nestjsRunning = await testNestJS();
  const nextjsRunning = await testNextJS();

  if (!nestjsRunning) {
    log('\n⚠ NestJS 서버가 실행 중이 아닙니다. 테스트를 계속할 수 없습니다.', 'yellow');
    log('  실행 방법: cd nest && npm run start:dev', 'yellow');
    return;
  }

  if (!nextjsRunning) {
    log('\n⚠ Next.js 서버가 실행 중이 아닙니다. 프록시 테스트가 제한됩니다.', 'yellow');
    log('  실행 방법: cd next && npm run dev', 'yellow');
  }

  await testAPIEndpoints();
  
  if (nextjsRunning) {
    await testProxy();
  } else {
    log('\n⚠ Next.js 서버가 실행 중이 아니므로 프록시 테스트를 건너뜁니다.', 'yellow');
  }

  await testAPIExclusion();

  // 결과 요약
  log('\n' + '='.repeat(60), 'blue');
  log('테스트 결과 요약', 'blue');
  log('='.repeat(60), 'blue');
  log(`NestJS 서버 (포트 3000): ${results.nestjs.status}`, 
    results.nestjs.status === 'running' ? 'green' : 'red');
  log(`Next.js 서버 (포트 3001): ${results.nextjs.status}`, 
    results.nextjs.status === 'running' ? 'green' : 'red');
  log(`프록시 동작: ${results.proxy.status}`, 
    results.proxy.status === 'working' ? 'green' : 'yellow');
  log(`API 엔드포인트: ${results.api.status}`, 
    results.api.status === 'ok' ? 'green' : 'yellow');
  
  // 프록시 활성화 확인
  log('\n프록시 설정 확인:', 'blue');
  log('  - NestJS 프록시는 프로덕션 모드 또는 ENABLE_PROXY=true일 때 활성화됩니다', 'reset');
  log('  - 개발 모드에서는 Next.js(3001)에 직접 접근 가능합니다', 'reset');
  log('  - 프로덕션에서는 NestJS(3000)가 Next.js(3001)로 프록시합니다', 'reset');
  
  log('\n테스트 완료!', 'blue');
}

// 실행
runTests().catch((error) => {
  log(`\n테스트 실행 중 오류 발생: ${error.message}`, 'red');
  process.exit(1);
});

