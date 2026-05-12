import 'server-only';

/**
 * CRM Payout client — wraps `/v1/crm/payouts`.
 *
 * Counterpart of the Rust crate `crm-payouts`. The Rust handlers return
 * the full `PayoutReceipt` document on every endpoint; this module
 * narrows the shape into a TS-friendly `CrmPayoutDoc` and provides
 * camelCase access for the UI layer.
 *
 * Payouts record outgoing payments to vendors — the buy-side mirror of
 * the customer-side payment receipt (`/v1/crm/payment-receipts`).
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_purchases_types::payout_receipt ───── */

/** Payment rail used to disburse funds. Lowercase on the wire. */
export type CrmPayoutMode =
  | 'cash'
  | 'cheque'
  | 'upi'
  | 'neft'
  | 'rtgs'
  | 'imps'
  | 'card'
  | 'wallet';

/** Workflow status. Lowercase on the wire. */
export type CrmPayoutStatus = 'sent' | 'cleared' | 'failed';

/** One row of the payout → bill allocation table. */
export interface CrmBillApplication {
  billId: string;
  amount: number;
}

export interface CrmPayoutDoc {
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

  paymentNo: string;
  date: string;

  vendorId: string;
  mode: CrmPayoutMode;
  bankAccountId: string;

  chequeNo?: string;
  chequeDate?: string;
  txnId?: string;
  reference?: string;

  amount: number;
  currency: string;
  exchangeRate?: number;

  applyTo?: CrmBillApplication[];
  excessAsAdvance?: boolean;

  tdsDeducted?: number;

  notes?: string;
  attachments?: unknown[];

  status?: CrmPayoutStatus;
  lineage?: { kind: string; id: string }[];

  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPayoutListParams {
  page?: number;
  limit?: number;
  q?: string;
  vendorId?: string;
  status?: CrmPayoutStatus | string;
}

export interface CrmPayoutCreateInput {
  projectId?: string;
  paymentNo: string;
  date: string;
  vendorId: string;
  mode: CrmPayoutMode;
  bankAccountId: string;
  amount: number;
  currency: string;

  chequeNo?: string;
  chequeDate?: string;
  txnId?: string;
  reference?: string;

  applyTo?: CrmBillApplication[];
  excessAsAdvance?: boolean;

  tdsDeducted?: number;

  notes?: string;

  /** Optional lineage parent kind. Only `'bill'` is honoured. */
  fromKind?: 'bill';
  fromId?: string;
}

/**
 * Patch shape. Per the Rust DTO every field is optional; only those
 * explicitly sent are modified on the document.
 */
export type CrmPayoutUpdateInput = {
  paymentNo?: string;
  date?: string;
  vendorId?: string;
  mode?: CrmPayoutMode;
  bankAccountId?: string;
  chequeNo?: string;
  chequeDate?: string;
  txnId?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  applyTo?: CrmBillApplication[];
  excessAsAdvance?: boolean;
  tdsDeducted?: number;
  notes?: string;
  status?: CrmPayoutStatus;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmPayoutListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.vendorId) qs.set('vendorId', p.vendorId);
  if (p.status) qs.set('status', String(p.status));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPayoutsApi = {
  list: (params?: CrmPayoutListParams) =>
    rustFetch<CrmPayoutDoc[]>(`/v1/crm/payouts${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmPayoutDoc>(`/v1/crm/payouts/${encodeURIComponent(id)}`),
  create: (input: CrmPayoutCreateInput) =>
    rustFetch<CrmPayoutDoc>('/v1/crm/payouts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmPayoutUpdateInput) =>
    rustFetch<CrmPayoutDoc>(`/v1/crm/payouts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/payouts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
