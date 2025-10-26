import { IsEnum, IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceKind } from '@prisma/client';

export class CreateDeviceUsageDto {
  @ApiProperty({
    enum: DeviceKind,
    example: DeviceKind.heat,
    description: '디바이스 종류',
  })
  @IsEnum(DeviceKind)
  device_kind: DeviceKind;

  @ApiProperty({
    example: 'on',
    description: '디바이스 액션',
  })
  @IsString()
  action: string;

  @ApiProperty({
    example: true,
    description: '디바이스 값 (선택사항)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  value?: boolean;
}
