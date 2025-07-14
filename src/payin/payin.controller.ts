import { Body, Controller, Post, Req, Res, Get } from '@nestjs/common';
import { PayinService } from './payin.service';
import { PayinDto } from './dto/payin.dto';
import { Request as ExpressRequest, Response } from 'express';
import { PayinWebHookDto } from './dto/payin-webhook.dto';
import { WebhookTriggerDto } from './dto/webhook-trigger.dto';

@Controller('payin')
export class PayinController {
  constructor(private readonly payinService: PayinService) {}
  @Post('gateway')
  payIn(
    @Body() payinDto: PayinDto,
    @Req() req: ExpressRequest,
    @Res() res: Response,
  ) {
    return this.payinService.payIn(payinDto, req, res);
  }

  @Post('payin-webhook')
  payinWebhook(@Body() payinWeebHookDto: PayinWebHookDto): Promise<void> {
    return this.payinService.payinWebhook(payinWeebHookDto);
  }

  @Get('generate-token')
  generateTokenIFNotExist(): Promise<string> {
    return this.payinService.generateTokenIFNotExist();
  }

  @Post('webhook-trigger')
  webHookTrigger(
    @Body() webhookTriggerDto: WebhookTriggerDto,
  ): Promise<string> {
    return this.payinService.webHookTrigger(webhookTriggerDto);
  }
}
