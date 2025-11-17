export class PrismaServiceMock {
  private deviceUsageId = 1n;
  private bboxHistoryId = 1n;
  private readonly heatmapStore = new Map<string, {
    hourTs: Date;
    gx: number;
    gy: number;
    hits: bigint;
  }>();

  readonly deviceUsage = {
    create: jest.fn(async ({ data }: { data: any }) => {
      const record = {
        id: this.deviceUsageId++,
        ts: data.ts ?? new Date(),
        deviceType: data.deviceType,
        action: data.action,
        value: data.value ?? null,
      };
      return record;
    }),
  };

  readonly bboxHistory = {
    create: jest.fn(async ({ data }: { data: any }) => {
      const record = {
        id: this.bboxHistoryId++,
        ts: data.ts,
        bboxes: data.bboxes,
        frameCount: data.frameCount ?? null,
        cameraId: data.cameraId ?? null,
      };
      return record;
    }),
  };

  readonly heatmapHour = {
    upsert: jest.fn(async ({
      where,
      update,
      create,
    }: {
      where: { hourTs_gx_gy: { hourTs: Date; gx: number; gy: number } };
      update: { hits: { increment: bigint } };
      create: { hourTs: Date; gx: number; gy: number; hits: bigint };
    }) => {
      const key = this.getHeatmapKey(
        where.hourTs_gx_gy.hourTs,
        where.hourTs_gx_gy.gx,
        where.hourTs_gx_gy.gy,
      );
      const existing = this.heatmapStore.get(key);
      if (existing) {
        existing.hits += update.hits.increment;
        return existing;
      }
      const entry = { ...create };
      this.heatmapStore.set(key, entry);
      return entry;
    }),
    findMany: jest.fn(async ({
      where,
    }: {
      where: { hourTs: { gte: Date; lte: Date } };
    }) => {
      const result = Array.from(this.heatmapStore.values()).filter((row) => {
        return (
          row.hourTs.getTime() >= where.hourTs.gte.getTime() &&
          row.hourTs.getTime() <= where.hourTs.lte.getTime()
        );
      });
      result.sort((a, b) => {
        if (a.hourTs.getTime() !== b.hourTs.getTime()) {
          return a.hourTs.getTime() - b.hourTs.getTime();
        }
        if (a.gx !== b.gx) {
          return a.gx - b.gx;
        }
        return a.gy - b.gy;
      });
      return result;
    }),
  };

  async $transaction<T>(cb: (tx: this) => Promise<T>): Promise<T> {
    return cb(this);
  }

  private getHeatmapKey(hourTs: Date, gx: number, gy: number): string {
    return `${hourTs.toISOString()}|${gx}|${gy}`;
  }
}
