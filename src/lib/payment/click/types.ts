export interface ClickPrepareRequest {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  amount: string;
  action: "0";
  error: string;
  error_note: string;
  sign_time: string;
  sign_string: string;
  click_paydoc_id: string;
}

export interface ClickCompleteRequest {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  merchant_prepare_id: string;
  amount: string;
  action: "1";
  error: string;
  error_note: string;
  sign_time: string;
  sign_string: string;
  click_paydoc_id: string;
}

export interface ClickPrepareResponse {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id: string;
  error: number;
  error_note: string;
}

export interface ClickCompleteResponse {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_confirm_id: string;
  error: number;
  error_note: string;
}

export interface ClickErrorResponse {
  error: number;
  error_note: string;
}
