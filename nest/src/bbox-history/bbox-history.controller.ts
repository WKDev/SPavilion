import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBboxHistoryDto } from '../dto/bbox-history.dto';

@ApiTags('bbox-history')
@Controller('api/bbox_history')
export class BboxHistoryController {
  private readonly logger = new Logger(BboxHistoryController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @ApiOperation({ summary: '바운딩 박스 히스토리 생성' })
  @ApiBody({ type: CreateBboxHistoryDto })
  @ApiResponse({ 
    status: 200, 
    description: '바운딩 박스 히스토리 생성 성공',
    schema: {
      example: {
        success: true,
        id: 123
      }
    }
  })
  @ApiResponse({ status: 500, description: '바운딩 박스 히스토리 생성 실패' })
  async createBboxHistory(@Body() dto: CreateBboxHistoryDto) {
    try {
      const { bboxes, frame_count, camera_id } = dto;

      // Save raw bbox data
      const history = await this.prisma.bboxHistory.create({
        data: {
          bboxes: bboxes,
          frameCount: frame_count,
          cameraId: camera_id || 'default',
        },
      });

      // Update heatmap aggregation
      await this.updateHeatmap(bboxes, history.ts);

      return {
        success: true,
        id: history.id.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create bbox history: ${error.message}`);
      throw new HttpException(
        `Failed to create bbox history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async updateHeatmap(bboxes: number[][], timestamp: Date) {
    try {
      // Get the hour timestamp (truncate to hour)
      const hourTs = new Date(timestamp);
      hourTs.setMinutes(0, 0, 0);

      const CELL_SIZE = 16; // Grid cell size (configurable)

      // Process each bounding box
      for (const bbox of bboxes) {
        if (bbox.length < 4) continue;

        const [x, y, w, h] = bbox;

        // Calculate center of bounding box
        const centerX = x + w / 2;
        const centerY = y + h / 2;

        // Convert to grid coordinates
        const gx = Math.floor(centerX / CELL_SIZE);
        const gy = Math.floor(centerY / CELL_SIZE);

        // Upsert heatmap record (increment hit count)
        await this.prisma.heatmapHour.upsert({
          where: {
            hourTs_gx_gy: {
              hourTs,
              gx,
              gy,
            },
          },
          update: {
            hits: {
              increment: 1,
            },
          },
          create: {
            hourTs,
            gx,
            gy,
            hits: 1,
          },
        });
      }

      this.logger.debug(
        `Updated heatmap for ${bboxes.length} detections at ${hourTs.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(`Failed to update heatmap: ${error.message}`);
      // Don't throw - heatmap update failure shouldn't fail the whole request
    }
  }
}
