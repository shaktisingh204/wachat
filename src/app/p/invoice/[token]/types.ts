export interface InvoiceData {
  invoiceNumber?: string;
  invoice_number?: string;
  invoiceDate?: string | Date;
  issue_date?: string | Date;
  dueDate?: string | Date;
  due_date?: string | Date;
  total?: number;
  amountPaid?: number;
  currency?: string;
  status?: string;
}

export interface PaymentData {
  transaction_id?: string;
  gateway?: string;
  paid_at?: string | Date;
  createdAt?: string | Date;
  amount?: number;
}
