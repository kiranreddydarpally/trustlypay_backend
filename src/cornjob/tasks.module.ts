import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskScheduleService } from './task-schedule.service';
import { TasksController } from './tasks.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ScheduleModule.forRoot(), HttpModule],
  providers: [TasksService, TaskScheduleService],
  controllers: [TasksController],
})
export class TasksModule {}
