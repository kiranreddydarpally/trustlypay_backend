import {
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// const data = {
//   meta: {
//     response_code: 'APX_000',
//     message: 'SUCCESS',
//   },
//   data: {
//     apx_payment_id: 5789579,
//     client_ref_id: 'TPRmp9qcm0gV8Qv0Z',
//     amount: 100,
//     currency: 'INR',
//     bank_reference: '106564474331',
//     created_at: 1750069414940,
//     modified_at: 1750069427444,
//     status: 'SUCCESS',
//     service_charge: 5.43,
//     service: 'upi',
//     service_details: {
//       upi: {
//         channel: 'UPI_INTENT',
//       },
//     },
//   },
//   errors: null,
// };

class MetaDto {
  //   @ApiProperty({ example: data.meta.response_code })
  @IsString()
  response_code: string;

  //   @ApiProperty({ example: data.meta.message })
  @IsString()
  message: string;
}

class ServiceDetailsUpiDto {
  //   @ApiProperty({ example: data.data.service_details.upi.channel })
  @IsString()
  channel: string;
}

class ServiceDetailsDto {
  // @ApiProperty()
  @ValidateNested()
  @Type(() => ServiceDetailsUpiDto)
  upi: ServiceDetailsUpiDto;
}

class DataDto {
  //   @ApiProperty({ example: data.data.apx_payment_id })
  @IsNumber()
  apx_payment_id: number;

  //   @ApiProperty({ example: data.data.client_ref_id })
  @IsString()
  client_ref_id: string;

  //   @ApiProperty({ example: data.data.amount })
  @IsNumber()
  amount: number;

  //   @ApiProperty({ example: data.data.currency })
  @IsString()
  currency: string;

  //   @ApiProperty({ example: data.data.bank_reference })
  @IsString()
  bank_reference: string;

  //   @ApiProperty({ example: data.data.created_at })
  @IsNumber()
  created_at: number;

  //   @ApiProperty({ example: data.data.modified_at })
  @IsNumber()
  modified_at: number;

  //   @ApiProperty({ example: data.data.status })
  @IsString()
  status: string;

  //   @ApiProperty({ example: data.data.service_charge })
  @IsNumber()
  service_charge: number;

  //   @ApiProperty({ example: data.data.service })
  @IsString()
  service: string;

  //   @ApiProperty()
  @ValidateNested()
  @Type(() => ServiceDetailsDto)
  service_details: ServiceDetailsDto;
}

export class PayinWebHookDto {
  //   @ApiProperty()
  @ValidateNested()
  @Type(() => MetaDto)
  meta: MetaDto;

  //   @ApiProperty()
  @ValidateNested()
  @Type(() => DataDto)
  data: DataDto;

  //   @ApiProperty()
  @IsOptional()
  errors?: any;
}
