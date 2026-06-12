/**
 * SabCRM People — Shifts surface action types.
 *
 * Shared between `sabcrm-people-shifts.actions.ts` ('use server'
 * modules may only export async functions) and the
 * `/sabcrm/people/shifts` clients. Rows are display-ready: department
 * FKs resolve to labels server-side.
 */

import type { CrmShiftStatus } from '@/lib/rust-client/sabcrm-people-shifts';

export type { CrmShiftStatus } from '@/lib/rust-client/sabcrm-people-shifts';

/** One option in an entity picker (department). */
export interface SabcrmShiftEntityOption {
  id: string;
  label: string;
  meta?: string;
}

export interface SabcrmShiftListFilters {
  page: number;
  limit?: number;
  q?: string;
  status?: CrmShiftStatus | '';
  departmentId?: string;
}

/** A resolved department chip on a shift row. */
export interface SabcrmShiftDepartmentRef {
  id: string;
  label: string | null;
}

/** Display-ready shift row — full `CrmShift` field coverage. */
export interface SabcrmShiftRow {
  id: string;
  name: string;
  code: string | null;
  /** `HH:MM` 24-hour strings. */
  startTime: string;
  endTime: string;
  breakMinutes: number | null;
  graceMinutes: number | null;
  isNightShift: boolean;
  /** Day codes (`Mon`…`Sun`). */
  workingDays: string[];
  color: string | null;
  description: string | null;
  isDefault: boolean;
  departments: SabcrmShiftDepartmentRef[];
  isActive: boolean;
  status: CrmShiftStatus;
  createdAt: string | null;
}

export interface SabcrmShiftListPage {
  rows: SabcrmShiftRow[];
  page: number;
  hasMore: boolean;
}

/** Full create/edit payload — every `CreateShiftInput` field. */
export interface SabcrmShiftInput {
  name: string;
  code?: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  graceMinutes?: number;
  isNightShift: boolean;
  workingDays: string[];
  color?: string;
  description?: string;
  isDefault: boolean;
  departmentIds: string[];
  isActive: boolean;
  /** Patch-only — `active` | `archived`. */
  status?: CrmShiftStatus;
}

export interface SabcrmShiftKpis {
  total: number;
  active: number;
  nightShifts: number;
  defaultShiftName: string | null;
  /** True when computed over a capped sample (first 100 shifts). */
  sampled: boolean;
}
