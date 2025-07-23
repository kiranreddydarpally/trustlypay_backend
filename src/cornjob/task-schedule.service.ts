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
import { IMerchantPayoutCharges } from 'src/interfaces/merchant-payout-charges.interface';
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
    this.logger.log('----- payoutStatusCheckSchedule -----');
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
      // const url = `https://api.apexio.co.in/transaction/check/payoutStatus/TP7pIM79IQTADLt`;
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
      // const payoutStatusResponse = {
      //   data: {
      //     meta: {
      //       responseCode: 'APX_000',
      //       message: 'SUCCESS',
      //     },
      //     payOutStatusData: {
      //       apxTrasnactionId: '000',
      //       merchantRefereenceId: 'TPDhLFl0tUUjlHA',
      //       modifiedAt: null,
      //       status: 'FAILED',
      //       serviceCharge: 0,
      //       bankReferenceNo: 'XXXX',
      //       remark: 'SUCCESS',
      //     },
      //     errors: null,
      //   },
      // };
      this.logger.log(
        'payoutStatusResponse ' + JSON.stringify(payoutStatusResponse.data),
      );
      if (!payoutStatusResponse?.data) {
        this.logger.log('Getting error in payout status check');
        continue;
      }
      if (payoutStatusResponse?.data?.['meta']?.['message'] === 'FAILED') {
        this.logger.log(
          'payoutstatusa api response error ' +
            payoutStatusResponse?.data?.['meta']?.['message'],
        );
        continue;
      }
      let statusDescription = '';
      let status = '';
      if (
        payoutStatusResponse?.data['payOutStatusData']?.['status'] === 'SUCCESS'
      ) {
        statusDescription = 'Transaction Status Success';
        status = 'SUCCESS';
      } else if (
        payoutStatusResponse?.data['payOutStatusData']?.['status'] === 'PENDING'
      ) {
        statusDescription = 'Transaction Status Pending';
        status = 'PENDING';
      } else if (
        ['FAILURE', 'FAILED'].includes(
          payoutStatusResponse?.data['payOutStatusData']?.['status'],
        )
      ) {
        statusDescription = 'Transaction Status Failed';
        status = 'FAILED';
        const getPercentage: IMerchantPayoutCharges = await this._knex
          .withSchema(process.env.DB_SCHEMA || 'public')
          .table(tableNames.merchant_payout_charges)
          .where({ merchant_id: variable.merchant_id, type: 'percentage' })
          .first();
        const getFlat: IMerchantPayoutCharges = await this._knex
          .withSchema(process.env.DB_SCHEMA || 'public')
          .table(tableNames.merchant_payout_charges)
          .where({ merchant_id: variable.merchant_id, type: 'flat' })
          .first();

        let totalCharge = 0;
        let taxCharges = 0;

        if (getPercentage) {
          if (getFlat) {
            if (Number(getFlat.volume_count) < Number(variable.amount)) {
              totalCharge =
                (Number(getPercentage.IMPS) / 100) * Number(variable.amount);
              taxCharges = (18 / 100) * totalCharge;
            } else {
              totalCharge = Number(getFlat.IMPS);
              taxCharges = (18 / 100) * totalCharge;
            }
          }
        }
        const amountTax = Number(variable.amount) + totalCharge + taxCharges;
        const trx = await this._knex.transaction();
        const balance = await trx
          .withSchema(process.env.DB_SCHEMA || 'public')
          .table(tableNames.payout_balance)
          .where({ merchant_id: variable.merchant_id })
          .forUpdate()
          .first();

        const creditBalance = await trx
          .withSchema(process.env.DB_SCHEMA || 'public')
          .table(tableNames.payout_balance)
          .where({ merchant_id: variable.merchant_id })
          .increment('balance', amountTax)
          .returning('*')
          .then((rows) => rows[0]);
        await trx.commit();

        this.logger.log('balance ' + JSON.stringify(balance));
        this.logger.log('creditBalance ' + JSON.stringify(creditBalance));

        const refundDetails = {
          merchant_id: variable.merchant_id,
          transaction_id: variable.transfer_id,
          opening_balance: balance.balance,
          amount: amountTax,
          closing_balance: balance.balance + amountTax,
          type: 'refund',
          created_date: dayjs()
            .tz('Asia/Kolkata')
            .format('YYYY-MM-DD HH:mm:ss'),
        };
        await this._knex
          .withSchema(process.env.DB_SCHEMA || 'public')
          .into(tableNames.payout_balance_refund)
          .insert(refundDetails);

        this.logger.log(
          'Apexio status API - amount ' + amountTax + ' refund successfully',
        );
      } else {
        statusDescription = 'Transaction Status Pending';
        status = 'PENDING';
      }
      const transactionDetails = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.payout_transactions)
        .where({
          transfer_id:
            payoutStatusResponse?.data?.['payOutStatusData']?.[
              'merchantRefereenceId'
            ] ?? '',
        })
        .first();

      if (transactionDetails) {
        await this._knex
          .withSchema(process.env.DB_SCHEMA || 'public')
          .table(tableNames.payout_transactions)
          .where({
            transfer_id:
              payoutStatusResponse?.data?.['payOutStatusData']?.[
                'merchantRefereenceId'
              ],
          })
          .update({
            status: status,
            transfer_desc: statusDescription,
            utr: payoutStatusResponse?.data?.['payOutStatusData']?.[
              'bankReferenceNo'
            ],
          });
      }
      this.logger.log('Apexio status API - Updated successfully');
    }
    this.logger.log('Apexio status API - End');
    return 'Payout Status';
  }
}
