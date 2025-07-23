import {
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

// Custom constraint to check at least one field exists
@ValidatorConstraint({ name: 'atLeastOne', async: false })
export class AtLeastOneConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const obj = args.object as any;
    return !!(obj.orderID || obj.udf1);
  }

  defaultMessage(args: ValidationArguments) {
    return 'At least one of orderID or udf1 must be provided';
  }
}

// Custom decorator to apply the constraint
function AtLeastOne(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'AtLeastOne',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: AtLeastOneConstraint,
    });
  };
}

export class StatusCheckDetailsDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  clientSecret: string;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderID?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  udf1?: string;

  @AtLeastOne({ message: 'Either orderID or udf1 is required.' })
  dummy?: string;
}
