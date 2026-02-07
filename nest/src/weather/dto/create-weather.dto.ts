import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateWeatherDto {
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  humidity?: number;

  @IsOptional()
  @IsString()
  precipitation?: string;

  @IsOptional()
  @IsNumber()
  windSpeed?: number;

  @IsString()
  baseDate: string;

  @IsString()
  baseTime: string;

  @IsNumber()
  nx: number;

  @IsNumber()
  ny: number;
}
