import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { HeatmapQueryDto } from '../dto/heatmap-query.dto';

@ApiTags('heatmap')
@Controller('api/heatmap')
export class HeatmapController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '히트맵 데이터 조회' })
  @ApiQuery({ name: 'from', required: false, description: '시작 시간 (ISO 8601)', example: '2025-01-23T10:00:00+09:00' })
  @ApiQuery({ name: 'to', required: false, description: '종료 시간 (ISO 8601)', example: '2025-01-23T13:00:00+09:00' })
  @ApiResponse({ 
    status: 200, 
    description: '히트맵 데이터 조회 성공',
    schema: {
      example: {
        from: '2025-01-23T10:00:00.000Z',
        to: '2025-01-23T13:00:00.000Z',
        data: [
          { hourTs: '2025-01-23T10:00:00.000Z', gx: 12, gy: 7, hits: 35 },
          { hourTs: '2025-01-23T11:00:00.000Z', gx: 13, gy: 7, hits: 22 }
        ]
      }
    }
  })
  @ApiResponse({ status: 500, description: '히트맵 데이터 조회 실패' })
  async getHeatmap(@Query() query: HeatmapQueryDto) {
    try {
      const { from, to } = query;

      const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      const heatmapData = await this.prisma.heatmapHour.findMany({
        where: {
          hourTs: {
            gte: fromDate,
            lte: toDate,
          },
        },
        orderBy: {
          hourTs: 'asc',
        },
      });

      return {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        data: heatmapData.map(item => ({
          ...item,
          hits: Number(item.hits), // BigInt를 Number로 변환
        })),
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch heatmap data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
