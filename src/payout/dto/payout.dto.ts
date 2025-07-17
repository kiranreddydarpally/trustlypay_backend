import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PayoutDto {
  @ApiProperty({
    example: 'TP_live_gC7KkRBRQCdtssWK',
  })
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @ApiProperty({
    example:
      '+Y6NJiGPh2V/bXk/0oRBEL7n44hG32pkGbJUN6X0Ey4cXosjSI030CbtiyKgfrPRrUgWZ/Sr4wHxhK5iYV7FPWT7+6ryp67oKeXspJBnt5iymQ2ba8/Eb2TzDmxX8+N+ve83T/b2cufGdTNXrLKW7NTV0hrLCfAUc//fJwa/cAkVtHu8/ErLnf8IaTlhctwm25HpQLEp/kmWTYTaARYuzkJXWt4SrESO/0KmzGnixAIHfq650ZVqbfBWupzfmAjRc2Qbn5W6eGj4x3ORfaeKalmw4aE1UORlysQPTyFmgvY9k2czaJPD0Vnq75ZQC7jHrUgWZ/Sr4wHxhK5iYV7FPW2oUmTIr4OQJUrLCb906KeSJllCWVw0o159rxXNPtMdlU8y0je78ePL/piSTbWcGdc2I8teUj415Xeb9z2lKjbIV79VzqczQKhMhGaBGALa6SQsgZck98KCwQmmrgeoIQ==',
  })
  @IsNotEmpty()
  @IsString()
  encrypt: string;
}
