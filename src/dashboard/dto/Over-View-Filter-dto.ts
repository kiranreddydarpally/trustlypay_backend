import {
  IsDateString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OverViewFilterDto {
  @ApiProperty({
    example: '2025-07-01 00:00:00',
    description: 'Start date should be (YYYY-MM-DD HH:MM:SS) format',
  })
  @IsDateString()
  @IsNotEmpty()
  fromDate: string;

  @ApiProperty({
    example: '2025-07-17 23:59:59',
    description: 'End date should be (YYYY-MM-DD HH:MM:SS) format',
  })
  @IsDateString()
  @IsNotEmpty()
  toDate: string;

  @ApiPropertyOptional({
    description: 'Merchant id should be number',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  merchantId?: number;
}
