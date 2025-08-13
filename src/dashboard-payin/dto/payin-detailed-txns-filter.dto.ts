import {
  IsDateString,
  IsOptional,
  IsNumber,
  IsDefined,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { StatusNames } from 'src/enums/status-names.enum';

export class PayinDetailedTxnsFilterDto {
  @ApiProperty({
    example: '2025-07-01 00:00:00',
    description: 'Start date should be (YYYY-MM-DD HH:MM:SS) format',
  })
  @IsDateString()
  @IsNotEmpty()
  fromDate: string;

  @ApiProperty({
    example: '2025-07-31 23:59:59',
    description: 'End date should be (YYYY-MM-DD HH:MM:SS) format',
  })
  @IsDateString()
  @IsNotEmpty()
  toDate: string;

  @ApiProperty({
    example: 1,
    description: 'Page number',
  })
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  pageNumber: number;

  @ApiProperty({
    example: 10,
    description: 'Page size',
  })
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  pageSize: number;

  @ApiPropertyOptional({
    description: 'TransactionId must be Alphanumeric',
  })
  @IsOptional()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'UTR must be a number',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  utr?: number;

  @ApiPropertyOptional({
    description: 'UDF1 must be Alphanumeric',
  })
  @IsOptional()
  udf1?: string;

  @ApiPropertyOptional({
    description: 'Transaction Status must be one of the following',
    enum: StatusNames,
    example: StatusNames.success,
  })
  @IsOptional()
  transactionStatus?: StatusNames;

  @ApiPropertyOptional({
    description: 'Merchant id should be number',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  merchantId?: number;
}
