import { Injectable } from '@nestjs/common';
import { DeviceKind, DeviceUsage } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { DeviceTarget } from '../devices/device-target';
import { CreateDeviceUsageDto } from './dto/create-device-usage.dto';

const TARGET_TO_KIND: Record<DeviceTarget, DeviceKind> = {
  heat: DeviceKind.heat,
  fan: DeviceKind.fan,
  btsp: DeviceKind.btsp,
  'light-red': DeviceKind.light_red,
  'light-green': DeviceKind.light_green,
  'light-blue': DeviceKind.light_blue,
  'light-white': DeviceKind.light_white,
  display: DeviceKind.display,
};

@Injectable()
export class DeviceUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async recordToggle(target: DeviceTarget, nextState: boolean): Promise<void> {
    await this.recordEvent(target, nextState ? 'on' : 'off', nextState ? 1 : 0);
  }

  async recordEvent(
    target: DeviceTarget,
    action: string,
    value?: number,
  ): Promise<DeviceUsage> {
    return this.prisma.deviceUsage.create({
      data: {
        deviceType: TARGET_TO_KIND[target],
        action,
        value,
      },
    });
  }

  async createFromDto(dto: CreateDeviceUsageDto): Promise<DeviceUsage> {
    return this.recordEvent(dto.device_type, dto.action, dto.value);
  }

  /**
   * Get device usage history aggregated by hour
   * Returns count of activation events (ON/rising edge) per hour per device
   */
  async getHistoryInRange(
    from: Date,
    to: Date,
  ): Promise<{ timestamp: string; value: number; device: string }[]> {
    // Query device_usage table for ON events only (rising edges)
    // Aggregate by hour and device type
    const result = await this.prisma.$queryRaw<
      { hour: Date; device_type: string; count: bigint }[]
    >`
      SELECT
        date_trunc('hour', ts) AS hour,
        device_type,
        COUNT(*) AS count
      FROM device_usage
      WHERE ts >= ${from}::timestamptz
        AND ts <= ${to}::timestamptz
        AND action = 'ON'
      GROUP BY date_trunc('hour', ts), device_type
      ORDER BY hour ASC, device_type ASC
    `;

    // Transform to frontend format
    return result.map((row) => ({
      timestamp: row.hour.toISOString(),
      value: Number(row.count),
      device: row.device_type,
    }));
  }
}
