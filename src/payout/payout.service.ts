import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { PayoutDto } from './dto/payout.dto';
import { Request } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class PayoutService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async directPayoutTransfer(payoutDto: PayoutDto, req: Request) {
    this.logger.log('----- PAYOUT TRANSFER -----');

    console.log('req', req);
    // this.logger.log('Request IP Address - ' + req);
    // this.logger.log('Request Data clientId -' + req);
    // this.logger.log('Request encrypt data-' + req);
  }
}
