import { Controller, Get, Query } from '@nestjs/common';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { DashboardService } from './dashboard.service';
import { ApiQuery, ApiTags } from '@nestjs/swagger';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Query() query: FilterTransactionsDto) {
    return await this.dashboardService.getTransactionSummary(query);
  }
}
