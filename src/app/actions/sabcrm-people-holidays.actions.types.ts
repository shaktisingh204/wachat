/**
 * SabCRM People — Holidays action types.
 *
 * Shared between `sabcrm-people-holidays.actions.ts` ('use server'
 * modules may only export async functions) and the
 * `/sabcrm/people/holidays` surface. Mirrors the
 * `sabcrm-people-employees.actions.types.ts` convention.
 */

import type { CrmHolidayType } from '@/lib/rust-client/sabcrm-people-holidays';

/* ─── List page ───────────────────────────────────────────────── */

export interface SabcrmHolidayListFilters {
  page: number;
  limit?: number;
  /** In-page refinement over name / locations (engine has no q). */
  q?: string;
  /** Classification filter (the kit's status select). */
  holidayType: CrmHolidayType | '';
  /**
   * Calendar-year filter — derived from the date-range `from` bound;
   * `from`/`to` additionally refine in-page (the crate filters by
   * `year` only).
   */
  from?: string;
  to?: string;
}

/** Display-ready holiday row. */
export interface SabcrmHolidayListRow {
  id: string;
  date?: string;
  name: string;
  holidayType: CrmHolidayType;
  recurring: boolean;
  /** Joined display text ("mumbai, pune"); empty = project-wide. */
  locations: string;
  locationsList: string[];
  notes: string;
}

export interface SabcrmHolidayListPage {
  rows: SabcrmHolidayListRow[];
  page: number;
  hasMore: boolean;
}

/* ─── Form values ─────────────────────────────────────────────── */

/**
 * What the holiday form submits — full
 * `crm_holidays::dto::CreateHolidayInput` surface (`date` as
 * `YYYY-MM-DD`, coerced to RFC3339 server-side).
 */
export interface SabcrmHolidayFormValues {
  date: string;
  name: string;
  holidayType?: CrmHolidayType | '';
  recurring?: boolean;
  applicableLocations?: string[];
  notes?: string;
}
