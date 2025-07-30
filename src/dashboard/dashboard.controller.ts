import { Controller, Get, Query } from '@nestjs/common';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { DashboardService } from './dashboard.service';
import { ApiQuery, ApiTags } from '@nestjs/swagger';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('payin-summary')
  async getPayinTransactionSummary(@Query() query: FilterTransactionsDto) {
    return await this.dashboardService.getPayinTransactionSummary(query);
  }

  @Get('payout-summary')
  async getPayoutTransactionSummary(@Query() query: FilterTransactionsDto) {
    return await this.dashboardService.getPayoutTransactionSummary(query);
  }

  @Get('merchant-routing-details')
  async getMerchantRoutingDetails() {
    return await this.dashboardService.getMerchantRoutingDetails();
  }
}
