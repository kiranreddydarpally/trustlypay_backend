import { Controller, Get } from '@nestjs/common';
import { DashboardPayinService } from './dashboard-payin-service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@Controller('dashboard-payin')
export class DashboardPayinController {
  constructor(private readonly dashboardPayinService: DashboardPayinService) {}

  @Get('dashboard-payin-summary')
  async getPayinMerchantsTxnSummary() {
    return await this.dashboardPayinService.getPayinMerchantsTxnSummary();
  }
}
