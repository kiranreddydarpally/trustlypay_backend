import { IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class PayoutEncryptAES128ECB {
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  amount: string;

  @IsNotEmpty()
  @IsString()
  transferMode: string;

  @IsString()
  account_no: string;

  @IsNotEmpty()
  @IsString()
  ifsc_code: string;

  @IsNotEmpty()
  @IsString()
  acc_holder_name: string;

  @IsNotEmpty()
  @IsString()
  bank_name: string;

  @ValidateIf((o) => o.transferMode === 'UPI')
  @IsString()
  upi: string;

  @IsNotEmpty()
  @IsString()
  purpose: string;

  @IsNotEmpty()
  @IsString()
  udf1: string;
}
