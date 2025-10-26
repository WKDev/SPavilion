import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBboxHistoryDto {
  @ApiProperty({
    example: [[100, 220, 60, 140], [420, 200, 70, 160]],
    description: '바운딩 박스 배열 [[x, y, w, h], ...]',
    type: 'array',
    items: {
      type: 'array',
      items: { type: 'number' },
    },
  })
  @IsArray()
  bboxes: number[][]; // [[x, y, w, h], ...]

  @ApiProperty({
    example: 12345,
    description: '프레임 카운트 (선택사항)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  frame_count?: number;

  @ApiProperty({
    example: 'camera_01',
    description: '카메라 ID (선택사항)',
    required: false,
  })
  @IsString()
  @IsOptional()
  camera_id?: string;
}
