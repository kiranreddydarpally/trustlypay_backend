import { Body, Controller, Post, Req, Res, Get } from '@nestjs/common';
import { PayinService } from './payin.service';
import { PayinDto } from './dto/payin.dto';
import { Request as ExpressRequest, Response } from 'express';

@Controller('payin')
export class PayinController {
  constructor(private readonly payinService: PayinService) {}
  @Post('gateway')
  payIn(
    @Body() payinDto: PayinDto,
    @Req() req: ExpressRequest,
    @Res() res: Response,
  ) {
    return this.payinService.payIn(payinDto, req, res);
  }

  @Get('generate-token')
  generateTokenIFNotExist(): Promise<string> {
    return this.payinService.generateTokenIFNotExist();
  }
}
