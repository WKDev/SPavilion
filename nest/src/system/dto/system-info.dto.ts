import { ApiProperty } from '@nestjs/swagger';

// CPU 정보
export class CpuInfoDto {
  @ApiProperty({ description: 'CPU 사용률 (퍼센트)', example: 45.2 })
  usage: number;

  @ApiProperty({ description: 'CPU 코어 수', example: 8 })
  cores: number;
}

// 메모리 정보
export class MemoryInfoDto {
  @ApiProperty({ description: '전체 메모리 (bytes)', example: 17179869184 })
  total: number;

  @ApiProperty({ description: '사용 중인 메모리 (bytes)', example: 8589934592 })
  used: number;

  @ApiProperty({ description: '여유 메모리 (bytes)', example: 8589934592 })
  free: number;

  @ApiProperty({ description: '메모리 사용률 (퍼센트)', example: 50 })
  percentage: number;
}

// 디스크 정보
export class DiskInfoDto {
  @ApiProperty({ description: '전체 디스크 용량 (bytes)', example: 500000000000 })
  total: number;

  @ApiProperty({ description: '사용 중인 디스크 용량 (bytes)', example: 250000000000 })
  used: number;

  @ApiProperty({ description: '여유 디스크 용량 (bytes)', example: 250000000000 })
  free: number;

  @ApiProperty({ description: '디스크 사용률 (퍼센트)', example: 50 })
  percentage: number;
}

// 시스템 정보 응답
export class SystemInfoDto {
  @ApiProperty({ description: 'CPU 정보', type: CpuInfoDto })
  cpu: CpuInfoDto;

  @ApiProperty({ description: '메모리 정보', type: MemoryInfoDto })
  memory: MemoryInfoDto;

  @ApiProperty({ description: '디스크 정보', type: DiskInfoDto })
  disk: DiskInfoDto;
}

// Health Check 응답
export class HealthCheckDto {
  @ApiProperty({ description: '상태', example: 'ok' })
  status: string;

  @ApiProperty({ description: '타임스탬프', example: '2025-10-29T12:00:00.000Z' })
  timestamp: string;
}
