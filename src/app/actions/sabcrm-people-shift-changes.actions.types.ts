/**
 * SabCRM People — Shift Change Requests surface action types.
 *
 * Shared between `sabcrm-people-shift-changes.actions.ts` ('use server'
 * modules may only export async functions) and the
 * `/sabcrm/people/shift-changes` clients.
 *
 * The ENGINE wire for this entity is snake_case (`employee_id`,
 * `current_shift_id`, …) — the actions translate to/from these
 * camelCase view types so the React side stays uniform. The entity
 * caches `employee_name` / `*_shift_name` at write time, so rows are
 * display-ready without per-row resolution.
 */

import type { CrmShiftChangeStatus } from '@/lib/rust-client/sabcrm-people-shift-changes';

export type { CrmShiftChangeStatus } from '@/lib/rust-client/sabcrm-people-shift-changes';

/** One option in an entity picker (employee / shift). */
export interface SabcrmShiftChangeEntityOption {
  id: string;
  label: string;
  meta?: string;
}

export interface SabcrmShiftChangeListFilters {
  page: number;
  limit?: number;
  q?: string;
  status?: CrmShiftChangeStatus | '';
  employeeId?: string;
  /** Inclusive `YYYY-MM-DD` bounds on `effective_date`. */
  from?: string;
  to?: string;
}

/** Display-ready request row — full field coverage (camelCase view). */
export interface SabcrmShiftChangeRow {
  id: string;
  employeeId: string;
  /** Cached at write-time; falls back to roster resolution. */
  employeeName: string | null;
  currentShiftId: string;
  currentShiftName: string | null;
  requestedShiftId: string;
  requestedShiftName: string | null;
  effectiveDate: string;
  reason: string | null;
  status: CrmShiftChangeStatus;
  approverId: string | null;
  /** Resolved approver label when the id matches a roster employee. */
  approverLabel: string | null;
  approvedAt: string | null;
  responseNotes: string | null;
  createdAt: string | null;
}

export interface SabcrmShiftChangeListPage {
  rows: SabcrmShiftChangeRow[];
  page: number;
  hasMore: boolean;
}

/**
 * Full create payload. Labels are cached onto the document (the picker
 * provides them) so listings never need a join.
 */
export interface SabcrmShiftChangeInput {
  employeeId: string;
  employeeName?: string;
  currentShiftId: string;
  currentShiftName?: string;
  requestedShiftId: string;
  requestedShiftName?: string;
  /** `YYYY-MM-DD`. */
  effectiveDate: string;
  reason?: string;
}

export type SabcrmShiftChangePatch = Partial<SabcrmShiftChangeInput>;

/** Approve / reject decision (PATCH `status` + stamps). */
export type SabcrmShiftChangeDecision = 'approved' | 'rejected';

export interface SabcrmShiftChangeKpis {
  pending: number;
  approvedThisMonth: number;
  rejected: number;
  /** True when computed over a capped sample (first 100 requests). */
  sampled: boolean;
}
