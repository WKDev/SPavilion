import { IsOptional, IsISO8601 } from 'class-validator';

export class UsageHistoryQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
