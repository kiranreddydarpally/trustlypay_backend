import { Injectable, Logger, LoggerService } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { TaskScheduleService } from './task-schedule.service';

@Injectable()
export class TasksService {
  private readonly logger: LoggerService = new Logger(TasksService.name);

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly taskScheduleService: TaskScheduleService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'pendingcheck',
    timeZone: 'Asia/Kolkata',
  })
  async handleCron() {
    const job = this.schedulerRegistry.getCronJob('pendingcheck');
    await this.taskScheduleService.payoutStatusCheckSchedule();
    await job.stop();
    this.logger.log('Date ' + job.lastDate());
    this.logger.log(
      'Called when the current second is 10 ' +
        JSON.stringify({
          date: job.lastDate(),
          name: 'pendingcheck',
        }),
    );
  }

  addCronJob(name: string, seconds: string) {
    const job = new CronJob(`${seconds} * * * * *`, () => {
      this.logger.warn(`time (${seconds}) for job ${name} to run!`);
    });

    this.schedulerRegistry.addCronJob(name, job);
    job.start();

    this.logger.warn(
      `job ${name} added for each minute at ${seconds} seconds!`,
    );
  }
}
