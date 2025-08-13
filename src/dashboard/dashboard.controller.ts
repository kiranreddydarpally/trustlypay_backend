import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { OverViewFilterDto } from './dto/Over-View-Filter.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('payin-summary')
  async getPayinTransactionSummary(@Query() query: OverViewFilterDto) {
    return await this.dashboardService.getPayinTransactionSummary(query);
  }

  @Get('payout-summary')
  async getPayoutTransactionSummary(@Query() query: OverViewFilterDto) {
    return await this.dashboardService.getPayoutTransactionSummary(query);
  }

  @Get('merchant-routing-details')
  async getMerchantRoutingDetails() {
    return await this.dashboardService.getMerchantRoutingDetails();
  }
}
