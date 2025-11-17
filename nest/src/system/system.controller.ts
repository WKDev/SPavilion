import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { SystemInfoDto, HealthCheckDto } from './dto/system-info.dto';

@ApiTags('system')
@Controller('api')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  /**
   * API Health Check
   */
  @Get('health')
  @ApiOperation({ summary: 'API 상태 확인' })
  @ApiResponse({
    status: 200,
    description: 'API가 정상적으로 작동 중입니다',
    type: HealthCheckDto,
  })
  async healthCheck(): Promise<HealthCheckDto> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 시스템 리소스 정보 조회
   */
  @Get('system/info')
  @ApiOperation({ summary: '시스템 리소스 정보 조회' })
  @ApiResponse({
    status: 200,
    description: '시스템 리소스 정보 조회 성공',
    type: SystemInfoDto,
  })
  @ApiResponse({
    status: 500,
    description: '시스템 리소스 정보 조회 실패',
  })
  async getSystemInfo(): Promise<SystemInfoDto> {
    try {
      return await this.systemService.getSystemInfo();
    } catch (error) {
      throw new HttpException(
        `시스템 정보 조회 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
