import { Inject, Injectable } from '@nestjs/common';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { Knex } from 'src/knex/knex.interface';
import { tableNames } from 'src/enums/table-names.enum';
import { PayinDetailedTxnsFilterDto } from './dto/Payin-Detailed-Txns-Filter-dto';
import dayjs from 'dayjs';

@Injectable()
export class DashboardPayinService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}
  async getPayinDetailedTransactionSummary(
    payinDetailedTxnsFilterDto: PayinDetailedTxnsFilterDto,
  ) {
    const {
      fromDate,
      toDate,
      pageNumber = 1,
      pageSize = 10,
      transactionId,
      utr,
      udf1,
      transactionStatus,
      merchantId,
    } = payinDetailedTxnsFilterDto;

    const start = dayjs(fromDate)
      .tz('Asia/Kolkata')
      .format('YYYY-MM-DD HH:mm:ss');
    const end = dayjs(toDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    const skip = (pageNumber - 1) * pageSize;

    const query = this.knex(tableNames.live_payment)
      .select(
        'live_payment.transaction_date',
        'live_payment.created_date',
        'live_payment.transaction_username',
        'live_payment.transaction_amount',
        'live_payment.transaction_gid',
        'live_payment.transaction_status',
        'live_payment.bank_ref_no',
        'live_payment.udf1',
        'm.name as merchant_name',
      )
      .leftJoin('merchant as m', 'live_payment.created_merchant', 'm.id')
      .whereBetween('live_payment.created_date', [start, end]);

    if (transactionId) {
      query.andWhereILike('live_payment.transaction_gid', `%${transactionId}%`);
    }

    if (utr) {
      query.andWhereILike('live_payment.bank_ref_no', `%${utr}%`);
    }

    if (udf1) {
      query.andWhereILike('live_payment.udf1', `%${udf1}%`);
    }

    if (transactionStatus) {
      query.andWhere('live_payment.transaction_status', transactionStatus);
    }

    if (merchantId) {
      query.andWhere('live_payment.created_merchant', merchantId);
    }

    query.limit(pageSize).offset(skip);

    console.log(query.toString());
    return await query;
  }

  async getPayinMerchantsTxnSummary() {
    const result = await this.knex(tableNames.merchant)
      .leftJoin(
        tableNames.live_payment,
        'merchant.id',
        'live_payment.created_merchant',
      )
      .select(
        'merchant.name',
        'merchant.merchant_gid',
        this.knex.raw(
          `COUNT(CASE WHEN live_payment.transaction_status = 'success' THEN 1 END) AS success_count`,
        ),
        this.knex.raw(
          `COUNT(CASE WHEN live_payment.transaction_status = 'failed' THEN 1 END) AS failed_count`,
        ),
        this.knex.raw(
          `COUNT(CASE WHEN live_payment.transaction_status = 'pending' THEN 1 END) AS pending_count`,
        ),
        this.knex.raw(
          `SUM(CASE WHEN live_payment.transaction_status = 'success' THEN live_payment.transaction_amount ELSE 0 END) AS success_amount`,
        ),
        this.knex.raw(
          `SUM(CASE WHEN live_payment.transaction_status = 'failed' THEN live_payment.transaction_amount ELSE 0 END) AS failed_amount`,
        ),
        this.knex.raw(
          `SUM(CASE WHEN live_payment.transaction_status = 'pending' THEN live_payment.transaction_amount ELSE 0 END) AS pending_amount`,
        ),
      )
      .groupBy('merchant.id', 'merchant.name', 'merchant.merchant_gid');

    return result.map((row: any) => {
      const success = Number(row.success_count || 0);
      const failed = Number(row.failed_count || 0);
      const pending = Number(row.pending_count || 0);
      const total = success + failed + pending;

      const percentage =
        total > 0 ? ((success / total) * 100).toFixed(2) : '0.00';

      return {
        name: row.name,
        merchant_gid: row.merchant_gid,
        success_count: success,
        failed_count: failed,
        pending_count: pending,
        success_amount: Number(row.success_amount || 0),
        failed_amount: Number(row.failed_amount || 0),
        pending_amount: Number(row.pending_amount || 0),
        success_percentage: `${percentage}%`,
      };
    });
  }
}
