import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'src/knex/knex.interface';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';

@Injectable()
export class DashboardService {
  constructor(@Inject(KNEX_CONNECTION) private readonly _knex: Knex) {}

  async getTransactionSummary(filter: FilterTransactionsDto) {
    const { fromDate, toDate, merchantId } = filter;

    const query = this._knex('live_payment_bkp')
      .select('live_payment_bkp.transaction_status')
      .sum('live_payment_bkp.transaction_amount as amount')
      .count('* as total')
      .whereBetween('live_payment_bkp.created_date', [fromDate, toDate])
      .groupBy('live_payment_bkp.transaction_status');

    const parsedMerchantId = Number(merchantId);
    if (!isNaN(parsedMerchantId)) {
      query.andWhere('live_payment_bkp.created_merchant', parsedMerchantId);
    }

    const rawResult = await query;

    const statusMap = {
      success: { status: 'success', totalAmount: 0, totalCount: 0 },
      failed: { status: 'failed', totalAmount: 0, totalCount: 0 },
      pending: { status: 'pending', totalAmount: 0, totalCount: 0 },
    };

    let totalVolume = 0;
    let totalCount = 0;

    for (const row of rawResult) {
      const status = row.transaction_status?.toLowerCase()?.trim();
      const amount = Number(row.amount);
      const count = Number(row.total);

      if (status in statusMap) {
        statusMap[status].totalAmount = amount;
        statusMap[status].totalCount = count;

        totalVolume += amount;
        totalCount += count;
      }
    }

    const totalSummary = {
      status: 'all',
      amount: totalVolume,
      total: totalCount,
    };

    return [...Object.values(statusMap), totalSummary];
  }
}
