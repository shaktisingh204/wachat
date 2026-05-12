import 'server-only';

/**
 * CRM Payment Receipt client — wraps `/v1/crm/payment-receipts`.
 *
 * Counterpart of the Rust crate `crm-payment-receipts`. The Rust
 * handlers return the full `PaymentReceipt` document on every endpoint;
 * this module narrows the shape into a TS-friendly `CrmPaymentReceiptDoc`
 * and provides camelCase access for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_sales_types::payment_receipt ──────── */

/** How the money came in. Lowercase on the wire. */
export type CrmPaymentMode =
  | 'cash'
  | 'cheque'
  | 'upi'
  | 'neft'
  | 'rtgs'
  | 'imps'
  | 'card'
  | 'wallet';

/** Workflow status. Lowercase on the wire. */
export type CrmReceiptStatus = 'received' | 'cleared' | 'bounced';

/** One row of the receipt → invoice allocation table. */
export interface CrmInvoiceApplication {
  invoiceId: string;
  amount: number;
}

export interface CrmPaymentReceiptDoc {
  _id: string;
  identity?: {
    id?: string;
    projectId?: string;
    userId?: string;
    tenantId?: string;
  };
  audit?: {
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    updatedBy?: string;
  };
  assignment?: {
    assignedTo?: string;
    assignedBy?: string;
    assignedAt?: string;
  };

  receiptNo: string;
  date: string;

  clientId: string;
  mode: CrmPaymentMode;
  bankAccountId: string;

  chequeNo?: string;
  chequeDate?: string;
  txnId?: string;
  reference?: string;

  amount: number;
  currency: string;
  exchangeRate?: number;

  applyTo?: CrmInvoiceApplication[];
  excessAsAdvance?: boolean;

  tdsDeducted?: number;
  bankCharges?: number;

  notes?: string;
  attachments?: unknown[];

  status?: CrmReceiptStatus;
  lineage?: { kind: string; id: string }[];

  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPaymentReceiptListParams {
  page?: number;
  limit?: number;
  q?: string;
  clientId?: string;
  status?: CrmReceiptStatus | string;
}

export interface CrmPaymentReceiptCreateInput {
  projectId?: string;
  receiptNo: string;
  date: string;
  clientId: string;
  mode: CrmPaymentMode;
  bankAccountId: string;
  amount: number;
  currency: string;

  chequeNo?: string;
  chequeDate?: string;
  txnId?: string;
  reference?: string;

  applyTo?: CrmInvoiceApplication[];
  excessAsAdvance?: boolean;

  tdsDeducted?: number;
  bankCharges?: number;

  notes?: string;

  /** Optional lineage parent kind. Whitelisted on the Rust side. */
  fromKind?: 'invoice' | 'proforma';
  fromId?: string;
}

/**
 * Patch shape. Per the Rust DTO, the financial fields (`amount`,
 * `applyTo`, `mode`, `clientId`, `currency`) are intentionally NOT
 * patchable — use a void+recreate flow for amount changes.
 */
export type CrmPaymentReceiptUpdateInput = {
  receiptNo?: string;
  date?: string;
  bankAccountId?: string;
  chequeNo?: string;
  chequeDate?: string;
  txnId?: string;
  reference?: string;
  tdsDeducted?: number;
  bankCharges?: number;
  notes?: string;
  status?: CrmReceiptStatus;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmPaymentReceiptListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.clientId) qs.set('clientId', p.clientId);
  if (p.status) qs.set('status', String(p.status));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPaymentReceiptsApi = {
  list: (params?: CrmPaymentReceiptListParams) =>
    rustFetch<CrmPaymentReceiptDoc[]>(
      `/v1/crm/payment-receipts${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPaymentReceiptDoc>(
      `/v1/crm/payment-receipts/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPaymentReceiptCreateInput) =>
    rustFetch<CrmPaymentReceiptDoc>('/v1/crm/payment-receipts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmPaymentReceiptUpdateInput) =>
    rustFetch<CrmPaymentReceiptDoc>(
      `/v1/crm/payment-receipts/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/payment-receipts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
