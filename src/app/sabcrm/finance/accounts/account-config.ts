/**
 * SabCRM Finance — chart-of-accounts surface config (client-safe).
 *
 * The ledger-head entity's doc-surface vocabulary: status defs +
 * tones, per-type badge tones and the kit-filters → action-filters
 * mapper. Mirrors `crm-chart-of-accounts::CrmChartOfAccount` exactly
 * (spec §3.18).
 */

import type { BadgeTone } from '@/components/sabcrm/20ui';
import type {
  CrmChartOfAccountStatus,
  CrmChartOfAccountType,
} from '@/lib/rust-client/crm-chart-of-accounts';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmChartOfAccountListFilters } from '@/app/actions/sabcrm-finance-chart-of-accounts.actions.types';

export const ACCOUNT_STATUSES: (DocStatusDef & {
  value: CrmChartOfAccountStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Per-type badge tone (statement-conventional colouring). */
export const ACCOUNT_TYPE_TONES: Record<string, BadgeTone> = {
  asset: 'info',
  liability: 'warning',
  income: 'success',
  expense: 'danger',
  equity: 'neutral',
};

export function accountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    asset: 'Asset',
    liability: 'Liability',
    income: 'Income',
    expense: 'Expense',
    equity: 'Equity',
  };
  return labels[type] ?? type;
}

/**
 * Kit list filters → chart-of-accounts action filters. The extra
 * account-type filter rides along from the toolbar's custom Select
 * (held outside the kit, read through a ref by the fetchers).
 */
export function toAccountFilters(
  f: DocListFilters,
  accountType: CrmChartOfAccountType | '',
): SabcrmChartOfAccountListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmChartOfAccountStatus | '') || '',
    accountType,
    from: f.from,
    to: f.to,
  };
}

export const ACCOUNTS_PATH = '/sabcrm/finance/accounts';
