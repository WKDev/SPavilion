import { ApiProperty } from '@nestjs/swagger';

// 테이블 통계 정보
export class TableStatsDto {
  @ApiProperty({ description: '테이블 이름 (기술명)', example: 'bbox_history' })
  name: string;

  @ApiProperty({ description: '테이블 표시 이름', example: 'Bounding Box History' })
  displayName: string;

  @ApiProperty({ description: '행 개수', example: 15432 })
  rowCount: number;

  @ApiProperty({ description: '디스크 사용량 (bytes)', example: 2097152 })
  diskSize: number;

  @ApiProperty({ description: '테이블 설명' })
  description: string;
}

// 데이터베이스 통계 응답
export class DatabaseStatsDto {
  @ApiProperty({
    description: '테이블 목록',
    type: [TableStatsDto],
  })
  tables: TableStatsDto[];
}

// 테이블 삭제 응답
export class ClearTableResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '메시지', example: '테이블 데이터가 삭제되었습니다' })
  message: string;

  @ApiProperty({ description: '삭제된 테이블 이름', example: 'bbox_history' })
  tableName: string;
}
