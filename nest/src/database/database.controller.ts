import { Controller, Get, Delete, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DatabaseService } from './database.service';
import { DatabaseStatsDto, ClearTableResponseDto } from './dto/database-stats.dto';

@ApiTags('database')
@Controller('api/database')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * 데이터베이스 통계 조회
   */
  @Get('stats')
  @ApiOperation({ summary: '데이터베이스 테이블 통계 조회' })
  @ApiResponse({
    status: 200,
    description: '데이터베이스 통계 조회 성공',
    type: DatabaseStatsDto,
  })
  @ApiResponse({
    status: 500,
    description: '데이터베이스 통계 조회 실패',
  })
  async getDatabaseStats(): Promise<DatabaseStatsDto> {
    try {
      return await this.databaseService.getDatabaseStats();
    } catch (error) {
      throw new HttpException(
        `데이터베이스 통계 조회 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 테이블 데이터 삭제
   */
  @Delete('clear/:tableName')
  @ApiOperation({ summary: '테이블 데이터 삭제 (TRUNCATE)' })
  @ApiParam({
    name: 'tableName',
    description: '삭제할 테이블 이름',
    example: 'bbox_history',
    enum: ['bbox_history', 'heatmap_hour', 'device_usage', 'device_usage_hour'],
  })
  @ApiResponse({
    status: 200,
    description: '테이블 데이터 삭제 성공',
    type: ClearTableResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (허용되지 않은 테이블)',
  })
  @ApiResponse({
    status: 500,
    description: '테이블 데이터 삭제 실패',
  })
  async clearTable(
    @Param('tableName') tableName: string,
  ): Promise<ClearTableResponseDto> {
    try {
      return await this.databaseService.clearTable(tableName);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `테이블 데이터 삭제 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
