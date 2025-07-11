// live_order
export interface ILiveOrder {
  id: bigint;
  order_gid: string;
  order_amount: number;
  order_attempts: number;
  order_receipt: string;
  order_status: string;
  created_date: Date;
  created_merchant: number;
}
