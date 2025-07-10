export interface IApexResponse {
  data: {
    meta: {
      response_code: 'APX_000' | 'APX_001';
      message: 'INITIATED' | 'BadRequest';
    };
    data: {
      apx_payment_id: string;
      merchant_reference_id: string;
      amount: number;
      currency: 'INR';
      created_at: number;
      status: 'INITIATED';
      service_charge: null;
      service: 'upi';
      service_details: {
        upi: {
          channel: 'UPI_INTENT';
        };
      };
      payload: {
        url: string;
      };
    } | null;
    errors: Array<{
      error_code: 'ERR001';
      error_message: "'apx-signature' is invalid";
    }> | null;
  };
}
