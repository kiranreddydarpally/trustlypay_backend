import { Module } from '@nestjs/common';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';
import { PayinModule } from 'src/payin/payin.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [PayoutController],
  providers: [PayoutService],
  imports: [PayinModule, HttpModule],
})
export class PayoutModule {}
