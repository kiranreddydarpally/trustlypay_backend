import { Controller, Get } from '@nestjs/common';
import { TaskScheduleService } from './task-schedule.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly taskScheduleService: TaskScheduleService) {}
  @Get('payout-status-check')
  payoutStatusCheck(): Promise<string> {
    return this.taskScheduleService.payoutStatusCheckSchedule();
  }
}
