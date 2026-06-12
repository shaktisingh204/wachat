/**
 * SabCRM People — Shift Rotations surface action types.
 *
 * Shared between `sabcrm-people-shift-rotations.actions.ts` ('use
 * server' modules may only export async functions) and the
 * `/sabcrm/people/shift-rotations` clients. Rows are display-ready:
 * the rotation target (employee | department | team) and the pattern's
 * shift FKs resolve to labels server-side.
 */

import type { CrmShiftRotationStatus } from '@/lib/rust-client/sabcrm-people-shift-rotations';

export type { CrmShiftRotationStatus } from '@/lib/rust-client/sabcrm-people-shift-rotations';

/** One option in an entity picker (employee / department / shift). */
export interface SabcrmRotationEntityOption {
  id: string;
  label: string;
  meta?: string;
}

export type SabcrmRotationTargetKind = 'employee' | 'department' | 'team';

export interface SabcrmRotationListFilters {
  page: number;
  limit?: number;
  q?: string;
  status?: CrmShiftRotationStatus | '';
  employeeId?: string;
}

/** One resolved pattern day for display/edit. */
export interface SabcrmRotationPatternDay {
  /** 0-based offset inside the cycle (must be `< cycleDays`). */
  dayOffset: number;
  shiftId: string;
  /** Cached/resolved shift label. */
  shiftName: string | null;
  isOff: boolean;
}

/** Display-ready rotation row — full `CrmShiftRotation` coverage. */
export interface SabcrmRotationRow {
  id: string;
  name: string;
  description: string | null;
  targetKind: SabcrmRotationTargetKind | null;
  targetId: string | null;
  /** Resolved target label (employee/department/team name). */
  targetLabel: string | null;
  cycleDays: number;
  startDate: string;
  endDate: string | null;
  pattern: SabcrmRotationPatternDay[];
  isActive: boolean;
  status: CrmShiftRotationStatus;
  createdAt: string | null;
}

export interface SabcrmRotationListPage {
  rows: SabcrmRotationRow[];
  page: number;
  hasMore: boolean;
}

/** Full create/edit payload — every `CreateRotationInput` field. */
export interface SabcrmRotationInput {
  name: string;
  description?: string;
  /** Exactly one of the three targets must be set. */
  employeeId?: string;
  departmentId?: string;
  teamId?: string;
  pattern: {
    dayOffset: number;
    shiftId: string;
    shiftName?: string;
    isOff?: boolean;
  }[];
  cycleDays: number;
  /** `YYYY-MM-DD`. */
  startDate: string;
  /** `YYYY-MM-DD`. */
  endDate?: string;
  isActive: boolean;
  /** Patch-only — active | paused | completed | archived. */
  status?: CrmShiftRotationStatus;
}

export interface SabcrmRotationKpis {
  total: number;
  active: number;
  paused: number;
  completed: number;
  /** True when computed over a capped sample (first 100 rotations). */
  sampled: boolean;
}
