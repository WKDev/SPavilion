import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // CORS 비활성화: NestJS(3000)와 Next.js(3001) 모두 localhost에서 동작하므로 불필요
  // 프록시를 통해 동일 origin으로 처리되므로 CORS 헤더가 필요 없음
  // app.enableCors();

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('S-Pavilion API 문서')
    .setDescription('S-Pavilion 시스템의 NestJS API 문서입니다. 디바이스 제어, 히트맵 데이터, 바운딩 박스 히스토리 관리 기능을 제공합니다.')
    .setVersion('1.0')
    .addTag('devices', '디바이스 상태 조회 및 제어')
    .addTag('bbox-history', '바운딩 박스 히스토리 관리')
    .addTag('heatmap', '히트맵 데이터 조회')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document); // /api-docs 경로에서 확인


  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Proxy to Next.js server (port 3001)
  // API 경로와 Swagger 문서는 제외하고 나머지는 Next.js로 프록시
  const nextJsUrl = process.env.NEXTJS_URL || 'http://localhost:3001';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // 프로덕션 모드이거나 ENABLE_PROXY 환경 변수가 설정된 경우 프록시 활성화
  // 개발 환경에서는 직접 Next.js에 접근 가능하므로 선택적으로 사용
  if (isProduction || process.env.ENABLE_PROXY === 'true') {
    // 프록시 미들웨어 생성 (한 번만 생성)
    const proxyMiddleware = createProxyMiddleware({
      target: nextJsUrl,
      changeOrigin: true,
      ws: true, // WebSocket 지원 (HMR 등)
      onProxyReq: (proxyReq, req, res) => {
        logger.debug(`Proxying ${req.method} ${req.url} to ${nextJsUrl}`);
      },
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${req.method} ${req.url}: ${err.message}`);
        if (!res.headersSent) {
          // Check if it's a connection error
          const isConnectionError = err.message.includes('ECONNREFUSED') || 
                                   err.message.includes('connect') ||
                                   err.code === 'ECONNREFUSED';
          
          if (isConnectionError) {
            res.status(502).send(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Next.js Server Not Available</title>
                  <style>
                    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                    h1 { color: #d32f2f; }
                    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
                    .solution { background: #e3f2fd; padding: 15px; border-radius: 5px; margin-top: 20px; }
                  </style>
                </head>
                <body>
                  <h1>Next.js Server Not Available</h1>
                  <p>The proxy is trying to forward requests to <code>${nextJsUrl}</code>, but the Next.js server is not running.</p>
                  <div class="solution">
                    <h3>Solutions:</h3>
                    <ol>
                      <li><strong>Start Next.js server:</strong><br>
                        <code>cd next && npm run dev</code> (or <code>pnpm dev</code>)
                      </li>
                      <li><strong>Disable proxy (development mode):</strong><br>
                        Set <code>NODE_ENV=development</code> or remove <code>ENABLE_PROXY=true</code><br>
                        Then access Next.js directly at <code>http://localhost:3001</code>
                      </li>
                    </ol>
                  </div>
                  <p><small>Requested path: <code>${req.url}</code></small></p>
                </body>
              </html>
            `);
          } else {
            res.status(502).json({
              error: 'Bad Gateway',
              message: `Proxy error: ${err.message}`,
              target: nextJsUrl,
            });
          }
        }
      },
    } as any);
    
    // API 경로와 Swagger 문서는 제외하고 나머지는 Next.js로 프록시
    // NestJS 컨트롤러가 먼저 처리되므로, 여기서는 명시적으로 경로 제외
    app.use((req, res, next) => {
      const pathname = req.path;
      
      // API 경로는 NestJS가 처리 (프록시하지 않음)
      if (pathname.startsWith('/api')) {
        return next();
      }
      // Swagger 문서는 NestJS가 처리 (프록시하지 않음)
      if (pathname.startsWith('/api-docs')) {
        return next();
      }
      
      // 나머지는 Next.js로 프록시
      return proxyMiddleware(req, res, next);
    });
    
    logger.log(`Proxy configured: non-API requests will be forwarded to ${nextJsUrl}`);
  } else {
    logger.log(`Proxy disabled. Set ENABLE_PROXY=true to enable proxy to Next.js`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Next.js proxy target: ${nextJsUrl}`);
}
bootstrap();

