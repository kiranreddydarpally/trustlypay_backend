import { Inject, Injectable } from '@nestjs/common';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { Knex } from 'src/knex/knex.interface';
import { tableNames } from 'src/enums/table-names.enum';

@Injectable()
export class DashboardPayoutService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async getPayoutMerchantsTxnSummary() {
    const result = await this.knex(tableNames.merchant)
      .leftJoin(
        tableNames.payout_transactions,
        'merchant.id',
        'payout_transactions.merchant_id',
      )
      .select(
        'merchant.name',
        'merchant.merchant_gid',
        this.knex.raw(
          `COUNT(CASE WHEN payout_transactions.status = 'success' THEN 1 END) AS success_count`,
        ),
        this.knex.raw(
          `COUNT(CASE WHEN payout_transactions.status = 'failed' THEN 1 END) AS failed_count`,
        ),
        this.knex.raw(
          `COUNT(CASE WHEN payout_transactions.status = 'pending' THEN 1 END) AS pending_count`,
        ),
        this.knex.raw(
          `SUM(CASE WHEN payout_transactions.status = 'success' THEN payout_transactions.amount ELSE 0 END) AS success_amount`,
        ),
        this.knex.raw(
          `SUM(CASE WHEN payout_transactions.status = 'failed' THEN payout_transactions.amount ELSE 0 END) AS failed_amount`,
        ),
        this.knex.raw(
          `SUM(CASE WHEN payout_transactions.status = 'pending' THEN payout_transactions.amount ELSE 0 END) AS pending_amount`,
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
