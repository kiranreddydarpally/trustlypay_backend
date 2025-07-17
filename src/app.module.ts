import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { KnexModule } from './knex/knex.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './winston-logger.config';
import { PayinModule } from './payin/payin.module';
import { TasksModule } from './cornjob/tasks.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    KnexModule,
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    WinstonModule.forRoot(winstonConfig),
    PayinModule,
    TasksModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
