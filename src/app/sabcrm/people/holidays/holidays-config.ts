/**
 * SabCRM People — holidays surface config (client-safe).
 *
 * The holiday entity's doc-surface vocabulary: the classification
 * vocabulary (mirroring `hrm_payroll_types::holiday::HolidayType`
 * lowercase wire values exactly — it doubles as the kit's status
 * select on this surface), kit-filter mapping and route helpers.
 * Spec: `docs/sabcrm/rnd/people-suite.md` WI-27.
 */

import type { CrmHolidayType } from '@/lib/rust-client/crm-holidays';
import type {
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';
import type { SabcrmHolidayListFilters } from '@/app/actions/sabcrm-people-holidays.actions.types';

/**
 * Holiday classifications, presented through the kit's status slot
 * (the toolbar select + the typed status column) — holidays have no
 * lifecycle of their own.
 */
export const HOLIDAY_TYPES: (DocStatusDef & { value: CrmHolidayType })[] = [
  { value: 'national', label: 'National', tone: 'success' },
  { value: 'regional', label: 'Regional', tone: 'info' },
  { value: 'religious', label: 'Religious', tone: 'warning' },
  { value: 'optional', label: 'Optional', tone: 'neutral' },
  { value: 'restricted', label: 'Restricted', tone: 'danger' },
];

export function holidayTypeLabel(
  value: CrmHolidayType | '' | undefined,
): string {
  if (!value) return '';
  return HOLIDAY_TYPES.find((t) => t.value === value)?.label ?? value;
}

/**
 * Kit list filters → holiday action filters. The kit's status select is
 * repurposed as the TYPE filter; the date range drives the engine's
 * `year` filter (derived from `from`) plus in-page day refinement.
 * There is no party on this surface.
 */
export function toHolidayFilters(f: DocListFilters): SabcrmHolidayListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    holidayType: (f.status as CrmHolidayType | '') || '',
    from: f.from,
    to: f.to,
  };
}

export const PEOPLE_HOLIDAYS_PATH = '/sabcrm/people/holidays';

/** Row navigation — `?open=<id>` deep-links the edit drawer. */
export function holidayOpenHref(id: string): string {
  return `${PEOPLE_HOLIDAYS_PATH}?open=${encodeURIComponent(id)}`;
}
