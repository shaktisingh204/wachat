/**
 * SabCRM People — shift-rotation surface config (client-safe).
 *
 * Status vocabulary + filter mapping + route helpers for
 * `/sabcrm/people/shift-rotations` (spec WI-29). Mirrors
 * `crm_shift_rotations::CrmShiftRotation.status` exactly
 * (`active` | `paused` | `completed` | `archived`).
 */

import type {
  CrmShiftRotationStatus,
  SabcrmRotationListFilters,
  SabcrmRotationTargetKind,
} from '@/app/actions/sabcrm-people-shift-rotations.actions.types';
import type {
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';

export const ROTATION_STATUSES: (DocStatusDef & {
  value: CrmShiftRotationStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'paused', label: 'Paused', tone: 'warning' },
  { value: 'completed', label: 'Completed', tone: 'info' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const ROTATIONS_PATH = '/sabcrm/people/shift-rotations';

/** Human copy per target kind (segmented picker + party cells). */
export const ROTATION_TARGET_LABELS: Record<SabcrmRotationTargetKind, string> =
  {
    employee: 'Employee',
    department: 'Department',
    team: 'Team',
  };

/**
 * Kit list filters → rotation action filters. The kit's `partyId` is
 * repurposed as the EMPLOYEE filter on this surface (the toolbar
 * picker searches the roster). The engine's list query has no date
 * bounds, so the kit range is dropped.
 */
export function toRotationFilters(
  f: DocListFilters,
): SabcrmRotationListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmShiftRotationStatus | '') || '',
    employeeId: f.partyId || undefined,
  };
}

/** Deep link that opens the edit drawer for a row. */
export function rotationOpenHref(id: string): string {
  return `${ROTATIONS_PATH}?open=${encodeURIComponent(id)}`;
}
