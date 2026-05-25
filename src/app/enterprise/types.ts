export interface InquiryRequest {
  organization: string;
  email: string;
  volume: string;
  useCase: string;
}

export interface InquiryPayload {
  organization: string;
  email: string;
  volume: string;
  message: string;
}

export interface EnterpriseResponse {
  status: number;
  status_text: string;
  transaction_id: string;
  timestamp: string;
  payload?: InquiryPayload;
  error?: string;
}

export interface InquiryRecord {
  id: string;
  organization: string;
  email: string;
  volume: string;
  useCase: string;
  status: 'pending' | 'approved' | 'rejected' | 'error';
  createdAt: string;
}
