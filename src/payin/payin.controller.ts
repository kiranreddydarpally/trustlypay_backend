import { Body, Controller, Post, Req, Res, Get } from '@nestjs/common';
import { PayinService } from './payin.service';
import { PayinDto } from './dto/payin.dto';
import { Request as ExpressRequest, Response } from 'express';
import { PayinWebHookDto } from './dto/payin-webhook.dto';
import { WebhookTriggerDto } from './dto/webhook-trigger.dto';

@Controller('payin')
export class PayinController {
  constructor(private readonly payinService: PayinService) {}
  @Post('gateway/v2/intent/initialrequest')
  payIn(
    @Body() payinDto: PayinDto,
    @Req() req: ExpressRequest,
    @Res() res: Response,
  ): Promise<any> {
    return this.payinService.payIn(payinDto, req, res);
  }

  @Post('payin-webhook')
  payinWebhook(@Body() payinWeebHookDto: PayinWebHookDto): Promise<void> {
    return this.payinService.payinWebhook(payinWeebHookDto);
  }

  @Post('webhook-trigger')
  webHookTrigger(
    @Body() webhookTriggerDto: WebhookTriggerDto,
  ): Promise<string> {
    return this.payinService.webHookTrigger(webhookTriggerDto);
  }

  @Post('gateway/v2/intent/statuscheck/initialrequest')
  StatusCheck(@Body() payinDto: PayinDto): Promise<any> {
    return this.payinService.StatusCheck(payinDto);
  }

  @Get('generate-token')
  generateTokenIfNotExist(): Promise<string> {
    return this.payinService.generateTokenIfNotExist();
  }
}
