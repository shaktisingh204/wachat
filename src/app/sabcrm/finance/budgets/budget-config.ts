/**
 * SabCRM Finance — budget surface config (client-safe).
 *
 * Status defs + tones (mirrors `crm-budgets`' lowercase vocabulary),
 * the approval happy path for the StatusFlow rail, and the kit-filters
 * mapping (spec §3.16).
 */

import type { CrmBudgetStatus } from '@/lib/rust-client/crm-budgets';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmBudgetListFilters } from '@/app/actions/sabcrm-finance-budgets.actions.types';

export const BUDGET_STATUSES: (DocStatusDef & { value: CrmBudgetStatus })[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'approved', label: 'Approved', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
  { value: 'locked', label: 'Locked', tone: 'info' },
];

/** Happy path for the StatusFlow rail (rejected renders as a pill). */
export const BUDGET_FLOW: CrmBudgetStatus[] = ['draft', 'approved', 'locked'];

/** Kit list filters → budget action filters. */
export function toBudgetFilters(f: DocListFilters): SabcrmBudgetListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmBudgetStatus | '') || '',
    from: f.from,
    to: f.to,
  };
}

export const BUDGETS_PATH = '/sabcrm/finance/budgets';

export function budgetDetailHref(id: string): string {
  return `${BUDGETS_PATH}/${encodeURIComponent(id)}`;
}
