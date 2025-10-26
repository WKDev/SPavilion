import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for development (Next.js frontend on different port)
  // 개발 환경: Next.js는 3001, 이전 React는 5173
  // 프로덕션: 동일 origin이므로 CORS 불필요
  app.enableCors({
    origin: [
      'http://localhost:3000', // Next.js 기본 포트 (fallback)
      'http://localhost:3001', // Next.js 권장 포트
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

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();

