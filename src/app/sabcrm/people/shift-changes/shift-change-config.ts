/**
 * SabCRM People — shift-change-request surface config (client-safe).
 *
 * Status vocabulary + happy-path flow + filter mapping + route helpers
 * for `/sabcrm/people/shift-changes` (spec WI-30). Mirrors
 * `crm_shift_change_requests::CrmShiftChangeRequest.status` exactly
 * (`pending` | `approved` | `rejected` | `cancelled`).
 */

import type {
  CrmShiftChangeStatus,
  SabcrmShiftChangeListFilters,
} from '@/app/actions/sabcrm-people-shift-changes.actions.types';
import type {
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';

export const SHIFT_CHANGE_STATUSES: (DocStatusDef & {
  value: CrmShiftChangeStatus;
})[] = [
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'approved', label: 'Approved', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (rejected/cancelled render off-path). */
export const SHIFT_CHANGE_FLOW: CrmShiftChangeStatus[] = [
  'pending',
  'approved',
];

export const SHIFT_CHANGES_PATH = '/sabcrm/people/shift-changes';

/**
 * Kit list filters → shift-change action filters. The kit's `partyId`
 * is repurposed as the EMPLOYEE filter on this surface; the date range
 * bounds `effective_date` (inclusive).
 */
export function toShiftChangeFilters(
  f: DocListFilters,
): SabcrmShiftChangeListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmShiftChangeStatus | '') || '',
    employeeId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

/** Deep link that opens the request drawer for a row. */
export function shiftChangeOpenHref(id: string): string {
  return `${SHIFT_CHANGES_PATH}?open=${encodeURIComponent(id)}`;
}
