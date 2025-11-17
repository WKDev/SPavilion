import { Module } from '@nestjs/common';
import { HeatmapController } from './heatmap.controller';

@Module({
  controllers: [HeatmapController],
})
export class HeatmapModule {}
