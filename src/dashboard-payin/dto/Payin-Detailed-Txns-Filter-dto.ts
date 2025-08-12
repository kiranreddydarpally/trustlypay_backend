import { IsDateString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { StatusNames } from 'src/enums/status.enum';

export class PayinDetailedTxnsFilterDto {
  @ApiProperty({
    example: '2025-07-01',
    description: 'Start date should be (YYYY-MM-DD) format',
  })
  @IsDateString()
  fromDate: string;

  @ApiProperty({
    example: '2025-07-31',
    description: 'End date should be (YYYY-MM-DD) format',
  })
  @IsDateString()
  toDate: string;

  @ApiProperty({
    example: 1,
    description: 'Page number',
  })
  @IsNumber()
  @Type(() => Number)
  pageNumber: number;

  @ApiProperty({
    example: 10,
    description: 'Page size',
  })
  @IsNumber()
  @Type(() => Number)
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
