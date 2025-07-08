import { Injectable, Logger, LoggerService } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Injectable()
export class TasksService {
  private readonly logger: LoggerService = new Logger(TasksService.name);

  constructor(private schedulerRegistry: SchedulerRegistry) {}

  @Cron(CronExpression.EVERY_12_HOURS, {
    name: 'pendingcheck',
    timeZone: 'Asia/Kolkata',
  })
  handleCron() {
    const job = this.schedulerRegistry.getCronJob('pendingcheck');

    job.stop();
    this.logger.log(job.lastDate());
    this.logger.log('Called when the current second is 10', {
      date: job.lastDate(),
      name: 'pendingcheck',
    });
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
