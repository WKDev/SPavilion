import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import { BoundingBoxArrayConstraint } from '../validators/bbox-array.validator';

export class CreateBboxHistoryDto {
  @IsOptional()
  @IsDateString()
  ts?: string;

  @IsArray()
  @Validate(BoundingBoxArrayConstraint)
  bboxes!: number[][];

  @IsOptional()
  @Type(() => Number)
  frame_count?: number;

  @IsOptional()
  @IsString()
  camera_id?: string;
}
