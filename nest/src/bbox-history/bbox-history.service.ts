import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { HeatmapService } from '../heatmap/heatmap.service';
import { CreateBboxHistoryDto } from './dto/create-bbox-history.dto';

@Injectable()
export class BboxHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly heatmapService: HeatmapService,
  ) {}

  async record(dto: CreateBboxHistoryDto) {
    const ts = dto.ts ? new Date(dto.ts) : new Date();
    const bboxes = dto.bboxes as Prisma.JsonArray;

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bboxHistory.create({
        data: {
          ts,
          bboxes,
          frameCount: dto.frame_count,
          cameraId: dto.camera_id,
        },
      });

      await this.heatmapService.aggregateBoundingBoxes({
        ts: created.ts,
        bboxes: dto.bboxes,
        transaction: tx,
      });

      return created;
    });

    return record;
  }
}
