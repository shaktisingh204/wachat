export interface ContractSign {
  signer_name: string;
  signer_email?: string;
  signed_at: string | Date;
  signature_data_url: string;
}

export interface ContractDetails {
  subject?: string;
  name?: string;
  start_date?: string | Date;
  end_date?: string | Date;
  value?: number;
  currency?: string;
  description?: string;
  signed?: boolean;
}
