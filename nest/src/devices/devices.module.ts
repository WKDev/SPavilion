import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { ModbusModule } from '../modbus/modbus.module';

@Module({
  imports: [ModbusModule],
  controllers: [DevicesController],
})
export class DevicesModule {}
