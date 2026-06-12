/**
 * SabCRM Finance — expense-claim surface config (client-safe).
 *
 * Status defs + tones (mirrors `crm-expense-claims`' lowercase
 * vocabulary), the approval happy path for the StatusFlow rail, and the
 * kit-filters mapping (spec §3.12).
 */

import type { CrmExpenseClaimStatus } from '@/lib/rust-client/crm-expense-claims';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmExpenseListFilters } from '@/app/actions/sabcrm-finance-expenses.actions.types';

export const EXPENSE_STATUSES: (DocStatusDef & {
  value: CrmExpenseClaimStatus;
})[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'submitted', label: 'Submitted', tone: 'info' },
  { value: 'approved', label: 'Approved', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
  { value: 'reimbursed', label: 'Reimbursed', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (rejected/cancelled = pills). */
export const EXPENSE_FLOW: CrmExpenseClaimStatus[] = [
  'draft',
  'submitted',
  'approved',
  'reimbursed',
];

/**
 * Kit list filters → expense action filters. The kit's `partyId` slot
 * is repurposed as the EMPLOYEE filter (the toolbar picker searches
 * people). Both the list fetcher and the CSV exporter MUST go through
 * this mapping.
 */
export function toExpenseFilters(f: DocListFilters): SabcrmExpenseListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmExpenseClaimStatus | '') || '',
    employeeId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const EXPENSES_PATH = '/sabcrm/finance/expenses';

export function expenseDetailHref(id: string): string {
  return `${EXPENSES_PATH}/${encodeURIComponent(id)}`;
}

/** Route to a CRM person record (employee links). */
export function employeeRecordHref(id: string): string | null {
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) return null;
  return `/sabcrm/people/${encodeURIComponent(id)}`;
}
