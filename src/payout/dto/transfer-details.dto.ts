import { IsString, IsNotEmpty, Matches, ValidateIf } from 'class-validator';

export class TransferDetailsDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsNotEmpty()
  @Matches(/^\d+(\.\d{2})?$/, {
    message: 'amount must be a valid decimal with two digits after decimal',
  })
  amount: string;

  @IsString()
  @IsNotEmpty()
  transferMode: string;

  @ValidateIf((o) => o.transferMode === 'UPI')
  @IsNotEmpty({ message: 'UPI is required for UPI mode' })
  upi?: string;

  @ValidateIf((o) => o.transferMode !== 'UPI')
  @IsNotEmpty({ message: 'account_no is required for non-UPI mode' })
  account_no?: string;

  @ValidateIf((o) => o.transferMode !== 'UPI')
  @IsNotEmpty({ message: 'ifsc_code is required for non-UPI mode' })
  ifsc_code?: string;

  @ValidateIf((o) => o.transferMode !== 'UPI')
  @IsNotEmpty({ message: 'acc_holder_name is required for non-UPI mode' })
  acc_holder_name?: string;

  @ValidateIf((o) => o.transferMode !== 'UPI')
  @IsNotEmpty({ message: 'bank_name is required for non-UPI mode' })
  bank_name?: string;
}
