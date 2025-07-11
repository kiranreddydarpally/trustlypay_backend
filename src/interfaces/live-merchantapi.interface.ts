// live_merchantapi
export interface ILiveMerchantApi {
  id: number;
  api_key: string;
  api_secret: string;
  api_expiry: Date;
  request_hashkey: string;
  request_salt_key: string;
  response_salt_key: string;
  encryption_request_key: string;
  encryption_response_key: string;
  response_hashkey: string;
  created_date: Date;
  created_merchant: number;
}
