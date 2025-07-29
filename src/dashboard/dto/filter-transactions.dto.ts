import { IsDateString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FilterTransactionsDto {
  @ApiProperty({
    example: '2025-07-01',
    description: 'Start date should be (YYYY-MM-DD) format',
  })
  @IsDateString()
  fromDate: string;

  @ApiProperty({
    example: '2025-07-17',
    description: 'End date should be (YYYY-MM-DD) format',
  })
  @IsDateString()
  toDate: string;

  @ApiPropertyOptional({
    description: 'Merchant id should be number',
  })
  @IsOptional()
  merchantId?: number;
}
