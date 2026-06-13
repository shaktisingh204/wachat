/**
 * SabCRM People — time-log surface config (client-safe).
 *
 * Route helpers + kit-filter mapping for `/sabcrm/people/time-logs`
 * (people-suite WI-34, with the WI-13 `tenantProjectId` exception
 * handled by the rust client). The status / entity-kind vocabularies
 * live in the shared action types — re-exported here so the surface
 * imports one module. No server imports.
 */

import type { CrmTimeLogStatus } from '@/app/actions/sabcrm-people-time-logs.actions.types';
import type { DocListFilters } from '../../finance/_components/doc-surface/types';
import type { SabcrmTimeLogListFilters } from '@/app/actions/sabcrm-people-time-logs.actions.types';

export {
  TIME_LOG_ENTITY_KINDS,
  TIME_LOG_STATUSES,
  formatDurationMinutes,
} from '@/app/actions/sabcrm-people-time-logs.actions.types';

export const TIME_LOGS_PATH = '/sabcrm/people/time-logs';

/** Deep link that opens the full-field edit drawer for a row. */
export function timeLogOpenHref(id: string): string {
  return `${TIME_LOGS_PATH}?open=${encodeURIComponent(id)}`;
}

/**
 * Kit list filters → time-log action filters. The kit's `partyId` is
 * repurposed as the EMPLOYEE filter (applied action-side — the engine
 * list has no employee param); the date range bounds `startedAt`.
 */
export function toTimeLogFilters(
  f: DocListFilters,
): SabcrmTimeLogListFilters & { employeeId?: string } {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmTimeLogStatus | '') || '',
    employeeId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

/** "13 Jun 2026, 10:30" style display for a timestamp. */
export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** ISO instant → `datetime-local` input value (local clock). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
