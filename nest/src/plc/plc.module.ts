import { Module } from '@nestjs/common';
import { PlcController } from './plc.controller';
import { ModbusModule } from '../modbus/modbus.module';

@Module({
  imports: [ModbusModule],
  controllers: [PlcController],
})
export class PlcModule {}
