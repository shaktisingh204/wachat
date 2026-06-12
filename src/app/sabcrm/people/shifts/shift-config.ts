/**
 * SabCRM People — shift surface config (client-safe).
 *
 * Status vocabulary + filter mapping + route helpers for
 * `/sabcrm/people/shifts` (spec WI-28). Mirrors
 * `crm_shifts::CrmShift.status` exactly (`active` | `archived`).
 */

import type { CrmShiftStatus } from '@/app/actions/sabcrm-people-shifts.actions.types';
import type {
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';
import type { SabcrmShiftListFilters } from '@/app/actions/sabcrm-people-shifts.actions.types';

export const SHIFT_STATUSES: (DocStatusDef & { value: CrmShiftStatus })[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const SHIFTS_PATH = '/sabcrm/people/shifts';

/** Working-day codes in render order (matches the engine's free codes). */
export const SHIFT_DAY_CODES = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;

/**
 * Kit list filters → shift action filters. The kit's `partyId` is
 * repurposed as the DEPARTMENT filter on this surface (the toolbar
 * picker searches departments). Date range is not applicable —
 * shifts are timeless catalog rows.
 */
export function toShiftFilters(f: DocListFilters): SabcrmShiftListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmShiftStatus | '') || '',
    departmentId: f.partyId || undefined,
  };
}

/** Deep link that opens the edit drawer for a row. */
export function shiftOpenHref(id: string): string {
  return `${SHIFTS_PATH}?open=${encodeURIComponent(id)}`;
}
