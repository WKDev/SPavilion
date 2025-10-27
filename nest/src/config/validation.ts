import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsInt()
  @IsOptional()
  PORT?: number;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  PLC_PORT?: string;

  @IsNumber()
  @IsOptional()
  PLC_BAUD_RATE?: number;

  @IsBooleanString()
  @IsOptional()
  MODBUS_MOCK?: string;

  @IsString()
  @IsOptional()
  MODBUS_TCP_HOST?: string;

  @IsInt()
  @IsOptional()
  MODBUS_TCP_PORT?: number;

  @IsInt()
  @IsOptional()
  MODBUS_DEVICE_UNIT_ID?: number;

  @IsInt()
  @IsOptional()
  HEATMAP_GRID_SIZE?: number;

  @IsInt()
  @IsOptional()
  HEATMAP_CELL_SIZE?: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: true,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
