import { Module } from '@nestjs/common';
import { DashboardPayinController } from './dashboard-payin-controller';
import { DashboardPayinService } from './dashboard-payin-service';

@Module({
  controllers: [DashboardPayinController],
  providers: [DashboardPayinService],
})
export class DashboardPayinModule {}
