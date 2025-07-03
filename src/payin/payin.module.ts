import { Module } from '@nestjs/common';
import { PayinController } from './payin.controller';
import { PayinService } from './payin.service';

@Module({
  providers: [PayinService],
  controllers: [PayinController],
})
export class PayinModule {}
