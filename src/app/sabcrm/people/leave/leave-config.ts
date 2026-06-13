/**
 * SabCRM People — leave surface config (client-safe).
 *
 * Status vocabulary + happy-path flow + filter mapping + route helpers
 * for the tabbed `/sabcrm/people/leave` surface (spec WI-26 —
 * Applications | Types). Mirrors `crm_leaves::LeaveApplication.status`
 * exactly (`pending` | `approved` | `rejected` | `cancelled`).
 */

import type {
  CrmLeaveStatus,
  SabcrmLeaveListFilters,
} from '@/app/actions/sabcrm-people-leave.actions.types';
import type {
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';

export const LEAVE_STATUSES: (DocStatusDef & { value: CrmLeaveStatus })[] = [
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'approved', label: 'Approved', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (rejected/cancelled render off-path). */
export const LEAVE_FLOW: CrmLeaveStatus[] = ['pending', 'approved'];

export const LEAVE_PATH = '/sabcrm/people/leave';

export type LeaveTab = 'applications' | 'types';

/**
 * Kit list filters → application action filters. The kit's `partyId`
 * is repurposed as the EMPLOYEE filter on this surface; the date range
 * bounds the leave `from` day (inclusive).
 */
export function toLeaveApplicationFilters(
  f: DocListFilters,
): SabcrmLeaveListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmLeaveStatus | '') || '',
    employeeId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

/** Deep link that opens the application drawer for a row. */
export function leaveApplicationOpenHref(id: string): string {
  return `${LEAVE_PATH}?tab=applications&open=${encodeURIComponent(id)}`;
}

/** Deep link that opens the leave-type editor for a catalog row. */
export function leaveTypeOpenHref(id: string): string {
  return `${LEAVE_PATH}?tab=types&type=${encodeURIComponent(id)}`;
}
