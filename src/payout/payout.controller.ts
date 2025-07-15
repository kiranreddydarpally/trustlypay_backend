import { Body, Controller, Post, Req } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { PayoutDto } from './dto/payout.dto';
import { Request as ExpressRequest } from 'express';

@Controller('payout')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Post('direct/payoutTransfer')
  directPayoutTransfer(
    @Body() payoutDto: PayoutDto,
    @Req() req: ExpressRequest,
  ): Promise<any> {
    return this.payoutService.directPayoutTransfer(payoutDto, req);
  }
}
