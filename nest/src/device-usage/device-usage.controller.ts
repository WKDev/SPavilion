import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateDeviceUsageDto } from './dto/create-device-usage.dto';
import { DeviceUsageService } from './device-usage.service';

@Controller('api')
export class DeviceUsageController {
  constructor(private readonly deviceUsageService: DeviceUsageService) {}

  @Post('device-usage')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDeviceUsageDto) {
    const record = await this.deviceUsageService.createFromDto(dto);
    return {
      id: record.id,
      ts: record.ts,
      device_type: dto.device_type,
      action: record.action,
      value: record.value,
    };
  }
}
