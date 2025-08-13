import { Inject, Injectable } from '@nestjs/common';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { Knex } from 'src/knex/knex.interface';
import { tableNames } from 'src/enums/table-names.enum';
import dayjs from 'dayjs';
import { OverViewFilterDto } from './dto/over-view-filter.dto';

@Injectable()
export class DashboardService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async getPayinTransactionSummary(filter: OverViewFilterDto) {
    const { fromDate, toDate, merchantId } = filter;
    const start = dayjs(fromDate)
      .tz('Asia/Kolkata')
      .format('YYYY-MM-DD HH:mm:ss');
    const end = dayjs(toDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    const query = this.knex(tableNames.live_payment)
      .select('transaction_status')
      .sum('transaction_amount as amount')
      .count('* as total')
      .whereBetween('created_date', [start, end])
      .groupBy('transaction_status');

    if (merchantId) {
      query.andWhere('created_merchant', merchantId);
    }

    const result = await query;

    let success = { status: 'success', totalAmount: 0, totalCount: 0 };
    let failed = { status: 'failed', totalAmount: 0, totalCount: 0 };
    let pending = { status: 'pending', totalAmount: 0, totalCount: 0 };

    let totalAmount = 0;
    let totalCount = 0;

    for (const row of result) {
      const status = row.transaction_status?.toLowerCase();
      const amount = Number(row.amount);
      const count = Number(row.total);

      if (status === 'success') {
        success.totalAmount = amount;
        success.totalCount = count;
      } else if (status === 'failed') {
        failed.totalAmount = amount;
        failed.totalCount = count;
      } else if (status === 'pending') {
        pending.totalAmount = amount;
        pending.totalCount = count;
      }

      totalAmount += amount;
      totalCount += count;
    }

    const all = { status: 'total volume', totalAmount, totalCount };

    return [failed, success, pending, all];
  }

  async getPayoutTransactionSummary(overViewFilterDto: OverViewFilterDto) {
    const { fromDate, toDate, merchantId } = overViewFilterDto;

    const start = dayjs(fromDate)
      .tz('Asia/Kolkata')
      .format('YYYY-MM-DD HH:mm:ss');
    const end = dayjs(toDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    const query = this.knex(tableNames.payout_transactions)
      .select('status')
      .sum('amount as amount')
      .count('* as total')
      .whereBetween('created_at', [start, end])
      .groupBy('status');

    if (merchantId) {
      query.andWhere('merchant_id', merchantId);
    }
    const result = await query;

    let success = { status: 'success', totalAmount: 0, totalCount: 0 };
    let failed = { status: 'failed', totalAmount: 0, totalCount: 0 };
    let pending = { status: 'pending', totalAmount: 0, totalCount: 0 };

    let totalAmount = 0;
    let totalCount = 0;

    for (const row of result) {
      const status = row.status?.toLowerCase();
      const amount = Number(row.amount);
      const count = Number(row.total);

      if (status === 'success') {
        success.totalAmount = amount;
        success.totalCount = count;
      } else if (status === 'failed') {
        failed.totalAmount = amount;
        failed.totalCount = count;
      } else if (status === 'pending') {
        pending.totalAmount = amount;
        pending.totalCount = count;
      }

      totalAmount += amount;
      totalCount += count;
    }

    const all = { status: 'total volume', totalAmount, totalCount };

    return [failed, success, pending, all];
  }

  async getMerchantRoutingDetails() {
    const result = await this.knex(tableNames.merchant)
      .join(
        tableNames.merchant_vendor_bank,
        'merchant.id',
        'merchant_vendor_bank.merchant_id',
      )
      .join(
        tableNames.vendor_bank,
        'merchant_vendor_bank.upi_vendor_bank_id',
        'vendor_bank.id',
      )
      .select(
        'merchant.merchant_gid',
        'merchant.merchant_status',
        'merchant.name',
        'vendor_bank.bank_name',
      );

    return result;
  }
}
