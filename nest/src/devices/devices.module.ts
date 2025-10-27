import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { ModbusModule } from '../modbus/modbus.module';
import { DeviceUsageModule } from '../device-usage/device-usage.module';

@Module({
  imports: [ModbusModule, DeviceUsageModule],
  controllers: [DevicesController],
})
export class DevicesModule {}
