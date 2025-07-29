import { Inject, Injectable } from '@nestjs/common';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { Knex } from 'src/knex/knex.interface';
import { tableNames } from 'src/enums/table-names.enum';

@Injectable()
export class DashboardPayinService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

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
        success_percentage: `${percentage}%`,
      };
    });
  }
}
