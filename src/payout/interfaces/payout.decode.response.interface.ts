export interface IPayoutDecodeResponse {
  clientId: string;
  name: string;
  email: string;
  phone: string;
  amount: string;
  transferMode: string; // IMPS,NEFT,RTGS & UPI
  account_no: string;
  ifsc_code: string;
  acc_holder_name: string;
  bank_name: string;
  upi: string;
  purpose: string;
  udf1: string;
}
