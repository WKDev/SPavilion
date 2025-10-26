import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceKind } from '@prisma/client';

export class DeviceControlDto {
  @ApiProperty({
    enum: DeviceKind,
    example: DeviceKind.heat,
    description: '제어할 디바이스 종류',
  })
  @IsEnum(DeviceKind)
  device_kind: DeviceKind;

  @ApiProperty({
    example: 'toggle',
    description: '디바이스 제어 액션 (toggle, on, off)',
    enum: ['toggle', 'on', 'off'],
  })
  @IsString()
  action: string; // 'toggle', 'on', 'off'
}
