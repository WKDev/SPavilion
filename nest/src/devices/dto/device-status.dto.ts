import { DEVICE_TARGETS, DeviceTarget } from '../device-target';

export type DeviceStatusRecord = Record<DeviceTarget, boolean>;

export class DeviceStatusDto {
  constructor(private readonly statuses: DeviceStatusRecord) {}

  toJSON(): Record<DeviceTarget, boolean> {
    return this.statuses;
  }

  static empty(): DeviceStatusDto {
    return new DeviceStatusDto(
      DEVICE_TARGETS.reduce<DeviceStatusRecord>((acc, target) => {
        acc[target] = false;
        return acc;
      }, {} as DeviceStatusRecord),
    );
  }
}
