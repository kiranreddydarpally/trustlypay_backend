import { Module } from '@nestjs/common';
import { PayinController } from './payin.controller';
import { PayinService } from './payin.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  providers: [PayinService],
  controllers: [PayinController],
  imports: [HttpModule],
  exports: [PayinService],
})
export class PayinModule {}
