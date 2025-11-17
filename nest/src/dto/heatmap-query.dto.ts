import { IsISO8601, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HeatmapQueryDto {
  @ApiProperty({
    example: '2025-01-23T10:00:00+09:00',
    description: '시작 시간 (ISO 8601 형식)',
    required: false,
  })
  @IsISO8601()
  @IsOptional()
  from?: string;

  @ApiProperty({
    example: '2025-01-23T13:00:00+09:00',
    description: '종료 시간 (ISO 8601 형식)',
    required: false,
  })
  @IsISO8601()
  @IsOptional()
  to?: string;
}
