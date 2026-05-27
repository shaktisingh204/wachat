/**
 * Types extracted from public-invoice.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type PublicInvoiceDetail = {
  ok: true;
  invoice: {
    _id: string;
    invoiceNumber: string;
    invoiceDate: string | null;
    dueDate: string | null;
    poNumber?: string;
    currency: string;
    status: string;
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
    amountPaid?: number;
    balanceDue?: number;
    notes?: string;
    termsAndConditions?: string[];
    paymentInstructions?: string;
  };
  company: PublicInvoiceDetailCompany;
  client: PublicInvoiceDetailClient;
  items: PublicInvoiceDetailItem[];
  payments: PublicInvoiceDetailPayment[];
};

export type PublicInvoiceDetailResult = PublicInvoiceDetail | { ok: false; error: string };
