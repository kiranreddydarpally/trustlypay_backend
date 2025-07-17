import { Controller, Get, Query } from '@nestjs/common';
import { FilterTransactionsDto } from './dto/FilterTransactionsDto.dto';
import { DashboardService } from './dashboard.service';
import { ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardservice: DashboardService) {}

  @Get('summary')
  async getSummary(@Query() query: FilterTransactionsDto) {
    return await this.dashboardservice.getTransactionStats(query);
  }
}
