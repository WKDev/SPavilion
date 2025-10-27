import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

interface AggregateOptions {
  ts: Date;
  bboxes: number[][];
  transaction?: Prisma.TransactionClient;
}

@Injectable()
export class HeatmapService {
  private readonly gridSize: number;
  private readonly cellSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.gridSize = this.configService.get('heatmap.gridSize', 50);
    this.cellSize = this.configService.get('heatmap.cellSize', 100);
  }

  async aggregateBoundingBoxes(options: AggregateOptions): Promise<void> {
    const { ts, bboxes, transaction } = options;
    if (!Array.isArray(bboxes) || bboxes.length === 0) {
      return;
    }

    const hourTs = this.startOfHour(ts);
    const increments = new Map<string, { gx: number; gy: number; hits: number }>();

    for (const bbox of bboxes) {
      const [x, y, width, height] = bbox;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      const gx = this.normalizeCoordinate(centerX);
      const gy = this.normalizeCoordinate(centerY);
      const key = `${gx}:${gy}`;

      const current = increments.get(key) ?? { gx, gy, hits: 0 };
      current.hits += 1;
      increments.set(key, current);
    }

    if (increments.size === 0) {
      return;
    }

    const prismaClient = transaction ?? this.prisma;
    const operations = Array.from(increments.values()).map(({ gx, gy, hits }) =>
      prismaClient.heatmapHour.upsert({
        where: { hourTs_gx_gy: { hourTs, gx, gy } },
        update: { hits: { increment: BigInt(hits) } },
        create: { hourTs, gx, gy, hits: BigInt(hits) },
      }),
    );

    await Promise.all(operations);
  }

  async findRange(from: Date, to: Date) {
    return this.prisma.heatmapHour.findMany({
      where: {
        hourTs: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ hourTs: 'asc' }, { gx: 'asc' }, { gy: 'asc' }],
    });
  }

  private normalizeCoordinate(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }
    const index = Math.floor(Math.max(value, 0) / this.cellSize);
    return Math.min(index, this.gridSize - 1);
  }

  private startOfHour(date: Date): Date {
    const hourStart = new Date(date);
    hourStart.setMinutes(0, 0, 0);
    return hourStart;
  }
}
