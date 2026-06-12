/**
 * SabCRM Finance — recurring-invoice surface config (client-safe).
 *
 * Status defs + tones, the happy-path flow, frequency vocabulary and
 * the kit-filters mapper (finance-rollout spec §3.11).
 */

import type {
  CrmRecurringInvoiceFrequency,
  CrmRecurringInvoiceStatus,
} from '@/lib/rust-client/crm-recurring-invoices';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmRecurringInvoiceListFilters } from '@/app/actions/sabcrm-finance-recurring-invoices.actions.types';

export const RECURRING_STATUSES: (DocStatusDef & {
  value: CrmRecurringInvoiceStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'paused', label: 'Paused', tone: 'warning' },
  { value: 'stopped', label: 'Stopped', tone: 'neutral' },
  { value: 'completed', label: 'Completed', tone: 'info' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Happy path: active → completed (paused/stopped render as pills). */
export const RECURRING_FLOW: CrmRecurringInvoiceStatus[] = [
  'active',
  'completed',
];

export const RECURRING_FREQUENCIES: {
  value: CrmRecurringInvoiceFrequency;
  label: string;
}[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export function frequencyLabel(value: string | undefined): string {
  if (!value) return '—';
  return RECURRING_FREQUENCIES.find((f) => f.value === value)?.label ?? value;
}

/**
 * Kit list filters → schedule action filters. The kit's party filter is
 * unused (the crate has no customerId list filter — Rust gap; in-page
 * filtering would mislead).
 */
export function toRecurringFilters(
  f: DocListFilters,
): SabcrmRecurringInvoiceListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmRecurringInvoiceStatus | '') || '',
    from: f.from,
    to: f.to,
  };
}

export const RECURRING_PATH = '/sabcrm/finance/recurring-invoices';
