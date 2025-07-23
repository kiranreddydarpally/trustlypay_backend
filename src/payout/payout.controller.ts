import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { PayoutDto } from './dto/payout.dto';
import { Request as ExpressRequest } from 'express';
import { PayoutEncryptAES128ECB } from './dto/payout-encrypt-aes128ecb.dto';

@Controller('payout')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Post('direct/payoutTransfer')
  directPayoutTransfer(
    @Body() payoutDto: PayoutDto,
    @Req() req: ExpressRequest,
  ): Promise<string> {
    return this.payoutService.directPayoutTransfer(payoutDto, req);
  }

  @Post('payoutCheckStatus')
  payoutCheckStatus(
    @Body() payoutDto: PayoutDto,
    @Req() req: ExpressRequest,
  ): Promise<string> {
    return this.payoutService.payoutCheckStatus(payoutDto, req);
  }

  @Post('Payout-encrypt-AES128ECB/:key')
  PayoutEncryptAES128ECB(
    @Body() payoutEncryptAES128ECB: PayoutEncryptAES128ECB,
    @Param('key') key: string,
  ): Promise<string> {
    console.log(
      'payoutEncryptAES128ECB',
      typeof JSON.stringify(payoutEncryptAES128ECB),
    );
    return this.payoutService.encryptAES128ECB(
      JSON.stringify(payoutEncryptAES128ECB),
      key,
    );
  }

  @Post('balanceCheck')
  payoutBalanceCheck(
    @Body() payoutDto: PayoutDto,
    @Req() req: ExpressRequest,
  ): Promise<string> {
    return this.payoutService.payoutBalanceCheck(payoutDto, req);
  }
}
