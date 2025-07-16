// merchant_payout_charges
export interface IMerchantPayoutCharges {
  id: number;
  merchant_id: number;
  min_range: string;
  max_range: string;
  volume_count: string;
  IMPS: string;
  NEFT: string;
  RTGS: string;
  UPI: string;
  PAYTM: string;
  AMAZON: string;
  udf1: number;
  udf2: number;
  udf3: number;
  udf4: number;
  type: merchantPayoutChargesTypeEnum;
  created_merchant: string;
  created_date: Date;
}

enum merchantPayoutChargesTypeEnum {
  'flat' = 'flat',
  'percentage' = 'percentage',
}
