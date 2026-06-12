/**
 * SabCRM Finance — payment-account surface config (client-safe).
 *
 * Status defs + tones, account-type vocabulary, the kit-filters mapper
 * and route helpers (finance-rollout spec §3.9). No flow rail — the
 * account is a registry record, not a workflow document.
 */

import type {
  CrmPaymentAccountStatus,
  CrmPaymentAccountType,
} from '@/lib/rust-client/crm-payment-accounts';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmPaymentAccountListFilters } from '@/app/actions/sabcrm-finance-payment-accounts.actions.types';

export const ACCOUNT_STATUSES: (DocStatusDef & {
  value: CrmPaymentAccountStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'inactive', label: 'Inactive', tone: 'neutral' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const ACCOUNT_TYPES: { value: CrmPaymentAccountType; label: string }[] =
  [
    { value: 'bank', label: 'Bank' },
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'wallet', label: 'Wallet' },
    { value: 'employee', label: 'Employee' },
  ];

export function accountTypeLabel(value: string | undefined): string {
  if (!value) return '—';
  return ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? value;
}

/**
 * Kit list filters → account action filters. The kit's party filter is
 * unused on this surface.
 */
export function toAccountFilters(
  f: DocListFilters,
): SabcrmPaymentAccountListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmPaymentAccountStatus | '') || '',
    from: f.from,
    to: f.to,
  };
}

export const ACCOUNTS_PATH = '/sabcrm/finance/payment-accounts';
