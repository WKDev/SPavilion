import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

// 루트 경로는 Next.js가 처리하므로, 이 컨트롤러는 제거하거나 경로 변경
// 또는 프로덕션 모드에서만 사용하지 않도록 설정
@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  // 헬스 체크는 SystemController에서 처리하므로 제거 가능
  // @Get()
  // getHello(): string {
  //   return this.appService.getHello();
  // }
}
