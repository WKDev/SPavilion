import { IsIn } from 'class-validator';
import { DEVICE_TARGETS } from '../device-target';
import type { DeviceTarget } from '../device-target';

export class DeviceControlDto {
  @IsIn(DEVICE_TARGETS, {
    message: `target must be one of: ${DEVICE_TARGETS.join(', ')}`,
  })
  target!: DeviceTarget;
}
