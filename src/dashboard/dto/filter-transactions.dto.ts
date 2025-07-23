import { IsDateString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FilterTransactionsDto {
  @ApiProperty({
    example: '2025-07-01',
    description: 'Start date (YYYY-MM-DD)',
  })
  @IsDateString()
  fromDate: string;

  @ApiProperty({ example: '2025-07-17', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  toDate: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Merchant id or ""',
  })
  @IsOptional()
  @IsNumber()
  merchantId?: number;
}
