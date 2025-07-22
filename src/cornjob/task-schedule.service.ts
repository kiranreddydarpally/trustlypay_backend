import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { Knex } from 'knex';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { tableNames } from 'src/enums/table-names.enum';
import { IPayoutTransactions } from 'src/interfaces/payout-transactions';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class TaskScheduleService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    @Inject(KNEX_CONNECTION) private readonly _knex: Knex,
    private readonly httpService: HttpService,
  ) {}
  async payoutStatusCheckSchedule(): Promise<any> {
    console.log('hey this kiran ');
    this.logger.log('Apexio status API - start');
    let get_transaction_live: IPayoutTransactions[] = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.payout_transactions)
      .where({
        status: 'pending',
        vendor: '1',
      });
    this.logger.log(
      'get_transaction_live ' + JSON.stringify(get_transaction_live),
    );
    get_transaction_live = [get_transaction_live[0]];
    for (const variable of get_transaction_live) {
      const formatted = dayjs()
        .tz('Asia/Kolkata')
        .format('YYYY-MM-DDTHH:mm:ss.SSSZ');
      const body = {
        username: 'AX0047',
        password: 'TrustPay@',
      };
      const authHeaders = {
        'Content-Type': 'application/json',
      };
      this.logger.log('Apexio-payout transfer request ' + JSON.stringify(body));
      const authUrl = 'https://api.apexio.co.in/auth/merchant/login';
      const apexAuthResponse = await firstValueFrom(
        this.httpService.post(authUrl, body, { headers: authHeaders }),
      );
      const authorization = apexAuthResponse?.['data']?.['data']?.['token'];

      this.logger.log(
        'Apexio-payout status check transaction ID ' + variable.transfer_id,
      );
      const url = `https://api.apexio.co.in/transaction/check/payoutStatus/${variable.transfer_id}`;
      // const url = `https://api.apexio.co.in/transaction/check/payoutStatus/TPmrzYCYai0aiA`;
      this.logger.log('authorization ' + authorization);
      this.logger.log('formatted ' + formatted);

      const headers = {
        'Content-Type': 'application/json',
        'apx-timestamp': formatted,
        Authorization: `Bearer ${authorization}`,
      };
      const payoutStatusResponse = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );
      this.logger.log(
        'payoutStatusResponse ' + JSON.stringify(payoutStatusResponse.data),
      );
    }
  }
}
