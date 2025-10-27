import { Module } from '@nestjs/common';
import { DeviceUsageController } from './device-usage.controller';
import { DeviceUsageService } from './device-usage.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DeviceUsageController],
  providers: [DeviceUsageService],
  exports: [DeviceUsageService],
})
export class DeviceUsageModule {}
