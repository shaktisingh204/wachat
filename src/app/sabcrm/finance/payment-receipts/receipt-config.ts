/**
 * SabCRM Finance — payment-receipt surface config (client-safe).
 *
 * The receipt entity's doc-surface vocabulary: status defs + tones, the
 * happy-path flow, payment-mode vocabulary, the kit-filters mapper,
 * route helpers and the typed `extras` bag the DocForm round-trips
 * (finance-rollout spec §3.7). Mirrors `invoice-config.ts`.
 */

import type {
  CrmPaymentMode,
  CrmReceiptStatus,
} from '@/lib/rust-client/crm-payment-receipts';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { AllocationRow } from '../_components/doc-surface';
import type { SabcrmReceiptListFilters } from '@/app/actions/sabcrm-finance-payment-receipts.actions.types';

export const RECEIPT_STATUSES: (DocStatusDef & { value: CrmReceiptStatus })[] =
  [
    { value: 'received', label: 'Received', tone: 'info' },
    { value: 'cleared', label: 'Cleared', tone: 'success' },
    { value: 'bounced', label: 'Bounced', tone: 'danger' },
  ];

/** Happy path for the StatusFlow rail (bounced renders as a pill). */
export const RECEIPT_FLOW: CrmReceiptStatus[] = ['received', 'cleared'];

/** Payment-mode vocabulary — mirrors `crm_sales_types::PaymentMode`. */
export const RECEIPT_MODES: { value: CrmPaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
  { value: 'card', label: 'Card' },
  { value: 'wallet', label: 'Wallet' },
];

export function receiptModeLabel(value: string | undefined): string {
  if (!value) return '—';
  return RECEIPT_MODES.find((m) => m.value === value)?.label ?? value;
}

/** Modes that carry an electronic transaction id. */
export const TXN_ID_MODES: ReadonlySet<string> = new Set([
  'upi',
  'neft',
  'rtgs',
  'imps',
  'card',
  'wallet',
]);

/**
 * Kit list filters → receipt action filters (the toolbar's status
 * values come from `RECEIPT_STATUSES`, so the narrowing cast is safe).
 */
export function toReceiptFilters(f: DocListFilters): SabcrmReceiptListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmReceiptStatus | '') || '',
    clientId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const RECEIPTS_PATH = '/sabcrm/finance/payment-receipts';

export function receiptDetailHref(id: string): string {
  return `${RECEIPTS_PATH}/${encodeURIComponent(id)}`;
}

export function partyRecordHref(
  objectSlug: string | null,
  id: string,
): string | null {
  if (!objectSlug || !id) return null;
  return `/sabcrm/${encodeURIComponent(objectSlug)}/${encodeURIComponent(id)}`;
}

/* ─── Typed extras bag (DocForm round-trips it untouched) ─────── */

/** The receipt form's entity-specific state, stored in `values.extras`. */
export interface ReceiptFormExtras {
  mode: string | null;
  bankAccountId: string | null;
  /** Kept as the raw input string for controlled-number ergonomics. */
  amount: string;
  exchangeRate: string;
  chequeNo: string;
  /** `YYYY-MM-DD`. */
  chequeDate: string;
  txnId: string;
  reference: string;
  tdsDeducted: string;
  bankCharges: string;
  excessAsAdvance: boolean;
  allocations: AllocationRow[];
}

export function emptyReceiptExtras(): ReceiptFormExtras {
  return {
    mode: 'upi',
    bankAccountId: null,
    amount: '',
    exchangeRate: '',
    chequeNo: '',
    chequeDate: '',
    txnId: '',
    reference: '',
    tdsDeducted: '',
    bankCharges: '',
    excessAsAdvance: false,
    allocations: [],
  };
}

/** Normalises the untyped kit bag back into the receipt shape. */
export function readReceiptExtras(
  extras: Record<string, unknown> | undefined,
): ReceiptFormExtras {
  const base = emptyReceiptExtras();
  if (!extras) return base;
  const e = extras as Partial<ReceiptFormExtras>;
  return {
    mode: typeof e.mode === 'string' ? e.mode : base.mode,
    bankAccountId:
      typeof e.bankAccountId === 'string' ? e.bankAccountId : null,
    amount: typeof e.amount === 'string' ? e.amount : base.amount,
    exchangeRate:
      typeof e.exchangeRate === 'string' ? e.exchangeRate : base.exchangeRate,
    chequeNo: typeof e.chequeNo === 'string' ? e.chequeNo : base.chequeNo,
    chequeDate:
      typeof e.chequeDate === 'string' ? e.chequeDate : base.chequeDate,
    txnId: typeof e.txnId === 'string' ? e.txnId : base.txnId,
    reference: typeof e.reference === 'string' ? e.reference : base.reference,
    tdsDeducted:
      typeof e.tdsDeducted === 'string' ? e.tdsDeducted : base.tdsDeducted,
    bankCharges:
      typeof e.bankCharges === 'string' ? e.bankCharges : base.bankCharges,
    excessAsAdvance:
      typeof e.excessAsAdvance === 'boolean'
        ? e.excessAsAdvance
        : base.excessAsAdvance,
    allocations: Array.isArray(e.allocations)
      ? (e.allocations as AllocationRow[])
      : base.allocations,
  };
}
