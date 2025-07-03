import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PayinDto {
  @ApiProperty({
    example: 'TP_live_gC7KkRBRQCdtssWK',
  })
  @IsString()
  clientId: string;

  @ApiProperty({
    example:
      '4c120e49c06f03cb4c6fa18fa15bd63a9638ba4a207843cd8e644dc59f2b1c7fa730518ba873b6e693f81e5eb0b85371df048496572797e37dde0b7b9a4154b432c0a5658d4c91d6190985e2d87ad721fe99570f51ca6d7a39d0ec504d54332b0c18226fc1540911b53c818d9e32f2e7a2071daafc0a95c4de7d08ce3fd83c0978bc54bba59c1f5e13c5eb2a642d7eace527bae3efb98da0e5949479fcd12d06d798218f5a16d7583f5233b6721a88aca7575e4b9e0ac0996fb8853f360ff0fbeef5a212bb90763e11093a300a309781749edf1e9a0160193b2756044eb58893977f34ebe8b6759123599dee1adcb0ab8da5353087f340b435dfd509b0a6b394d1b94c1220c6b6b29fef74cb74a46b35f17bef62d0a70575b0534b8e5d020bd260a3e3d8c8305160cacdfec1ddf65b8132c21240c719557b72db14fed7ada99a',
  })
  @IsString()
  encryptedData: string;
}
