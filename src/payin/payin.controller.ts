import { Body, Controller, Post } from '@nestjs/common';
import { PayinService } from './payin.service';
import { PayinDto } from './dto/payin.dto';

@Controller('payin')
export class PayinController {
  constructor(private readonly payinService: PayinService) {}
  @Post('gateway')
  payIn(@Body() payinDto: PayinDto) {
    return this.payinService.payIn(payinDto);
  }
}
