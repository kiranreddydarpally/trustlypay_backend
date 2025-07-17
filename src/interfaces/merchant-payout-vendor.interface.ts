//  merchant_payout_vendor
export interface IMerchantPayoutVendor {
  id: number;
  merchant_id: number;
  imps: string;
  neft: string;
  rtgs: string;
  upi: string;
  paytm: string;
  amazon: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  created_at: Date;
}
