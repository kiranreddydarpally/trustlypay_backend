import { Module } from '@nestjs/common';
import { DashboardPayoutController } from './dashboard-payout-controller';
import { DashboardPayoutService } from './dashboard-payout-service';

@Module({
  controllers: [DashboardPayoutController],
  providers: [DashboardPayoutService],
})
export class DashboardPayoutModule {}
