/**
 * SabCRM Finance — credit-note surface config (client-safe).
 *
 * The credit-note entity's doc-surface vocabulary: status defs + tones,
 * the happy-path flow for the StatusFlow rail, the reason / refund-mode
 * Select vocabularies and route helpers. Mirrors
 * `crm_sales_types::credit_note` exactly (finance-rollout spec §3.4).
 */

import type {
  CreditNoteReason,
  CreditNoteStatus,
  RefundMode,
} from '@/lib/rust-client/crm-credit-notes';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmCreditNoteListFilters } from '@/app/actions/sabcrm-finance-credit-notes.actions.types';

export const CREDIT_NOTE_STATUSES: (DocStatusDef & {
  value: CreditNoteStatus;
})[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'issued', label: 'Issued', tone: 'info' },
  { value: 'refunded', label: 'Refunded', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const CREDIT_NOTE_FLOW: CreditNoteStatus[] = [
  'draft',
  'issued',
  'refunded',
];

/** Reason vocabulary — snake_case wire values per the crate enum. */
export const CREDIT_NOTE_REASONS: {
  value: CreditNoteReason;
  label: string;
}[] = [
  { value: 'return', label: 'Goods returned' },
  { value: 'discount', label: 'Post-sale discount' },
  { value: 'price_adjust', label: 'Price adjustment' },
  { value: 'cancel', label: 'Order cancelled' },
  { value: 'other', label: 'Other' },
];

export function creditNoteReasonLabel(
  value: CreditNoteReason | undefined,
): string {
  if (!value) return '—';
  return CREDIT_NOTE_REASONS.find((r) => r.value === value)?.label ?? value;
}

/** Refund-mode vocabulary — lowercase wire values per the crate enum. */
export const CREDIT_NOTE_REFUND_MODES: {
  value: RefundMode;
  label: string;
}[] = [
  { value: 'cash', label: 'Cash refund' },
  { value: 'credit', label: 'Credit on account' },
  { value: 'replacement', label: 'Replacement' },
];

export function creditNoteRefundModeLabel(
  value: RefundMode | undefined,
): string {
  if (!value) return '—';
  return (
    CREDIT_NOTE_REFUND_MODES.find((m) => m.value === value)?.label ?? value
  );
}

/**
 * Kit list filters → credit-note action filters. The kit's generic
 * shape uses `partyId` + a stringly `status`; the actions expect
 * `clientId` + the `CreditNoteStatus` union (the toolbar's status
 * values come from `CREDIT_NOTE_STATUSES`, so the narrowing is safe).
 */
export function toCreditNoteFilters(
  f: DocListFilters,
): SabcrmCreditNoteListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CreditNoteStatus | '') || '',
    clientId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const CREDIT_NOTES_PATH = '/sabcrm/finance/credit-notes';

export function creditNoteDetailHref(id: string): string {
  return `${CREDIT_NOTES_PATH}/${encodeURIComponent(id)}`;
}

export function partyRecordHref(
  objectSlug: string | null,
  id: string,
): string | null {
  if (!objectSlug || !id) return null;
  return `/sabcrm/${encodeURIComponent(objectSlug)}/${encodeURIComponent(id)}`;
}
