import { Controller, Get } from '@nestjs/common';
import { DashboardPayoutService } from './dashboard-payout-service';

@Controller('dashboard-payout')
export class DashboardPayoutController {
  constructor(
    private readonly dashboardPayoutService: DashboardPayoutService,
  ) {}

  @Get('dashboard-payout-summary')
  async getPayoutMerchantsTxnSummary() {
    return await this.dashboardPayoutService.getPayoutMerchantsTxnSummary();
  }
}
