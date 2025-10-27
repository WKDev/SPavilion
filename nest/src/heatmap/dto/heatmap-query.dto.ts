import { IsDateString } from 'class-validator';

export class HeatmapQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
