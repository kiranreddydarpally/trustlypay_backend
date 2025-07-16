// merchant
export interface IMerchant {
  id: number;
  merchant_gid: string;
  name: string;
  email: string;
  password: string;
  mobile_no: string;
  remember_token: string;
  merchant_business;
  app_mode: number;
  reseller_id: string;
  documents_upload: YNEnum;
  bg_verified: YNEnum;
  doc_verified: string;
  change_app_mode: YNEnum;
  create_user_enabled: YNEnum;
  charge_enabled: YNEnum;
  transaction_limit: number;
  verify_token: string;
  is_verified: YNEnum;
  is_email_verified: YNEnum;
  is_mobile_verified: YNEnum;
  is_reminders_enabled: YNEnum;
  show_modal: YNEnum;
  failed_attempts: number;
  i_agree: YNEnum;
  merchant_status: ActiveInactiveEnum;
  created_date: Date;
  last_seen_at: Date;
  reseller_date: Date;
  is_account_locked: YNEnum;
}

enum YNEnum {
  Y = 'Y',
  N = 'N',
}

enum ActiveInactiveEnum {
  active = 'active',
  inactive = 'inactive',
}
