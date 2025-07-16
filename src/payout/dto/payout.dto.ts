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
      '+Y6NJiGPh2V/bXk/0oRBEPKQR+pM5w1RvzkMu1Wreja5y63TCo9CrVkrOUw9l8KWE7nqv+1ELnjHWPPkth7pT2w8N2B6hoSFSptDOUzzXooHKXVC+Ak3nnqptGwfWnpOX5JljnCUtJ3jnNncWf0j0hLaXfvNDRIILhcCOxh0V6qrVznjTbPnDrhH3en26tMe1crAstCp1EH517nxFHqf9cMJRwSSwnwOzJfGkQ2qwcpNnxb/Nj4WdDssSNrs+rqxnm03Bl1OOpZEeafXQ1p1aY8jPLvOE+vFQKKaKB1+wfujg1UYkNjdEaSnkWuYjWjza0ktkTOO0HEMTiVc+jqDU3VVK7fhjRXf6xMLEfwRHGiC1aKpw5/E60ZhKd76F3Yje/6wIxSGH6EzIov3mQg05erl/Vbw/IJSSrOf0dZbBkRTCgejaLXhpXbhS3LUlWW/',
  })
  @IsNotEmpty()
  @IsString()
  encrypt: string;
}
