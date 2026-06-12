/**
 * SabCRM Finance — debit-note surface config (client-safe).
 *
 * The debit-note entity's doc-surface vocabulary: status defs + tones,
 * the happy-path flow for the StatusFlow rail, the reason / refund-mode
 * Select vocabularies and route helpers. Vendor-side mirror of the
 * credit-note config — `crm_purchases_types::debit_note` exactly
 * (finance-rollout spec §3.5).
 */

import type {
  DebitNoteReason,
  DebitNoteRefundMode,
  DebitNoteStatus,
} from '@/lib/rust-client/crm-debit-notes';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmDebitNoteListFilters } from '@/app/actions/sabcrm-finance-debit-notes.actions.types';

export const DEBIT_NOTE_STATUSES: (DocStatusDef & {
  value: DebitNoteStatus;
})[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'issued', label: 'Issued', tone: 'info' },
  { value: 'refunded', label: 'Refunded', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const DEBIT_NOTE_FLOW: DebitNoteStatus[] = [
  'draft',
  'issued',
  'refunded',
];

/** Reason vocabulary — snake_case wire values per the crate enum. */
export const DEBIT_NOTE_REASONS: {
  value: DebitNoteReason;
  label: string;
}[] = [
  { value: 'return', label: 'Goods returned' },
  { value: 'discount', label: 'Vendor discount' },
  { value: 'price_adjust', label: 'Price adjustment' },
  { value: 'cancel', label: 'Order cancelled' },
  { value: 'other', label: 'Other' },
];

export function debitNoteReasonLabel(
  value: DebitNoteReason | undefined,
): string {
  if (!value) return '—';
  return DEBIT_NOTE_REASONS.find((r) => r.value === value)?.label ?? value;
}

/**
 * Refund-mode vocabulary — lowercase wire values. Semantics flip on the
 * vendor side: `credit` is a balance held AGAINST the vendor.
 */
export const DEBIT_NOTE_REFUND_MODES: {
  value: DebitNoteRefundMode;
  label: string;
}[] = [
  { value: 'cash', label: 'Cash refund' },
  { value: 'credit', label: 'Credit held with vendor' },
  { value: 'replacement', label: 'Replacement' },
];

export function debitNoteRefundModeLabel(
  value: DebitNoteRefundMode | undefined,
): string {
  if (!value) return '—';
  return (
    DEBIT_NOTE_REFUND_MODES.find((m) => m.value === value)?.label ?? value
  );
}

/**
 * Kit list filters → debit-note action filters. The kit's `partyId` is
 * the VENDOR filter here (the toolbar picker searches supply vendors).
 */
export function toDebitNoteFilters(
  f: DocListFilters,
): SabcrmDebitNoteListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as DebitNoteStatus | '') || '',
    vendorId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const DEBIT_NOTES_PATH = '/sabcrm/finance/debit-notes';

export function debitNoteDetailHref(id: string): string {
  return `${DEBIT_NOTES_PATH}/${encodeURIComponent(id)}`;
}
