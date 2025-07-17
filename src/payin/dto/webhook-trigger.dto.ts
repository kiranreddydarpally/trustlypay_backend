import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WebhookTriggerDto {
  @ApiProperty({
    example: 'TP_live_gC7KkRBRQCdtssWK',
  })
  @IsString()
  clientId: string;

  @ApiProperty()
  @IsString()
  secureData: string;
}
