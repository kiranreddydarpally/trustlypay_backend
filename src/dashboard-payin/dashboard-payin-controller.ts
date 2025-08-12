import { Controller, Get, Query } from '@nestjs/common';
import { DashboardPayinService } from './dashboard-payin-service';
import { PayinDetailedTxnsFilterDto } from './dto/Payin-Detailed-Txns-Filter-dto';

@Controller('dashboard-payin')
export class DashboardPayinController {
  constructor(private readonly dashboardPayinService: DashboardPayinService) {}

  @Get('dashboard-payin-summary')
  async getPayinMerchantsTxnSummary() {
    return await this.dashboardPayinService.getPayinMerchantsTxnSummary();
  }

  @Get('detailed-txn-summary')
  async getPayinDetailedTransactionSummary(
    @Query() query: PayinDetailedTxnsFilterDto,
  ) {
    return await this.dashboardPayinService.getPayinDetailedTransactionSummary(
      query
    );
  }
}
