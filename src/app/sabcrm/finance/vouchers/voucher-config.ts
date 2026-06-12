/**
 * SabCRM Finance — voucher-books surface config (client-safe).
 *
 * The voucher-book entity's doc-surface vocabulary: status defs +
 * tones, type labels and the kit-filters → action-filters mapper.
 * Mirrors `crm-vouchers::CrmVoucherBook` exactly (spec §3.13).
 */

import type { CrmVoucherBookStatus } from '@/lib/rust-client/crm-vouchers';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type {
  SabcrmVoucherBookListFilters,
  SabcrmVoucherBookType,
} from '@/app/actions/sabcrm-finance-vouchers.actions.types';

export const VOUCHER_BOOK_STATUSES: (DocStatusDef & {
  value: CrmVoucherBookStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Display label for a stored book type. */
export function voucherTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    journal: 'Journal',
    payment: 'Payment',
    receipt: 'Receipt',
    contra: 'Contra',
    purchase: 'Purchase',
    sales: 'Sales',
  };
  return labels[type] ?? type;
}

export function resetFrequencyLabel(value: string): string {
  const labels: Record<string, string> = {
    none: 'Never',
    yearly: 'Yearly',
    monthly: 'Monthly',
  };
  return labels[value] ?? value;
}

/**
 * Kit list filters → voucher-book action filters. The extra book-type
 * filter rides along from the toolbar's custom Select (held outside
 * the kit, read through a ref by the fetchers).
 */
export function toVoucherBookFilters(
  f: DocListFilters,
  type: SabcrmVoucherBookType | '',
): SabcrmVoucherBookListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmVoucherBookStatus | '') || '',
    type,
    from: f.from,
    to: f.to,
  };
}

export const VOUCHERS_PATH = '/sabcrm/finance/vouchers';

/** Deep link: the book's journal entries, pre-filtered (spec §3.13). */
export function voucherBookEntriesHref(bookId: string): string {
  return `/sabcrm/finance/journal-entries?book=${encodeURIComponent(bookId)}`;
}
