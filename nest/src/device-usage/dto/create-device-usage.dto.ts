import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { DEVICE_TARGETS } from '../../devices/device-target';
import type { DeviceTarget } from '../../devices/device-target';

export class CreateDeviceUsageDto {
  @IsIn(DEVICE_TARGETS, {
    message: `device_type must be one of: ${DEVICE_TARGETS.join(', ')}`,
  })
  device_type!: DeviceTarget;

  @IsString()
  action!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;
}
