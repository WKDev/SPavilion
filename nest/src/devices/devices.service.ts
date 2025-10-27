import { Injectable } from '@nestjs/common';
import { DeviceUsageService } from '../device-usage/device-usage.service';
import { DeviceControlDto } from './dto/device-control.dto';
import { DeviceStatusDto } from './dto/device-status.dto';
import { ModbusService } from './modbus.service';

@Injectable()
export class DevicesService {
  constructor(
    private readonly modbusService: ModbusService,
    private readonly deviceUsageService: DeviceUsageService,
  ) {}

  async getStatuses(): Promise<DeviceStatusDto> {
    return this.modbusService.getStatuses();
  }

  async toggleDevice(dto: DeviceControlDto): Promise<DeviceStatusDto> {
    const result = await this.modbusService.toggleDevice(dto.target);
    const snapshot = result.toJSON();
    await this.deviceUsageService.recordToggle(
      dto.target,
      snapshot[dto.target],
    );
    return result;
  }
}
