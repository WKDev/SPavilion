import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for development (Next.js frontend on different port)
  // 개발 환경: Next.js는 3001, 이전 React는 5173
  // 프로덕션: 프록시를 통해 동일 origin이지만, 개발 환경을 위해 CORS 유지
  app.enableCors({
    origin: [
      'http://localhost:3000', // NestJS (프록시 서버)
      'http://localhost:3001', // Next.js 직접 접근 (개발용)
      'http://localhost:5173', // Vite (이전 React)
    ],
    credentials: true,
  });

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
        logger.error(`Proxy error: ${err.message}`);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Bad Gateway',
            message: 'Next.js server is not available',
          });
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

