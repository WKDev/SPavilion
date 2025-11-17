import { Module } from '@nestjs/common';
import { BboxHistoryController } from './bbox-history.controller';

@Module({
  controllers: [BboxHistoryController],
})
export class BboxHistoryModule {}
