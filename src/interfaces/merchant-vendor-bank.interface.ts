// merchant_vendor_bank
export interface IMerchantVendorBank {
  id: number;
  merchant_id: number;
  cc_card: number;
  dc_card: number;
  net: number;
  upi: number;
  qrcode: number;
  wallet: number;
  business_type_id: number;
  created_date: Date;
  created_user: number;
}
