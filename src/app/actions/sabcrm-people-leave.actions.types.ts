/**
 * SabCRM People — Leave surface action types.
 *
 * Shared between `sabcrm-people-leave.actions.ts` ('use server' modules
 * may only export async functions) and the `/sabcrm/people/leave`
 * clients. Mirrors the `sabcrm-finance-invoices.actions.types.ts`
 * convention: list rows are DISPLAY-READY (FK labels resolved
 * server-side — raw ObjectIds never reach the client as the only
 * representation of a person).
 */

import type { CrmLeaveStatus } from '@/lib/rust-client/sabcrm-people-leave';

export type { CrmLeaveStatus } from '@/lib/rust-client/sabcrm-people-leave';

/** One option in an entity picker (employee / leave type). */
export interface SabcrmLeaveEntityOption {
  id: string;
  /** Human label — NEVER a raw ObjectId. */
  label: string;
  /** Secondary line (employeeId · workEmail, code, …). */
  meta?: string;
}

/* ─── Leave types (catalog) ───────────────────────────────────── */

/** Display row for the Types tab — full nine-field catalog coverage. */
export interface SabcrmLeaveTypeRow {
  id: string;
  code: string;
  name: string;
  paid: boolean;
  accrualRule: string;
  maxBalance: number | null;
  carryForward: boolean;
  encashable: boolean;
  genderRestricted: string | null;
  minServiceMonths: number | null;
  createdAt: string | null;
}

/** Create/update payload — all nine `CreateLeaveTypeInput` fields. */
export interface SabcrmLeaveTypeInput {
  code: string;
  name: string;
  paid: boolean;
  accrualRule: string;
  maxBalance?: number;
  carryForward: boolean;
  encashable: boolean;
  genderRestricted?: string;
  minServiceMonths?: number;
}

export interface SabcrmLeaveTypeListPage {
  rows: SabcrmLeaveTypeRow[];
  page: number;
  hasMore: boolean;
}

/* ─── Applications ────────────────────────────────────────────── */

export interface SabcrmLeaveListFilters {
  page: number;
  limit?: number;
  q?: string;
  status?: CrmLeaveStatus | '';
  /** Applicant filter (flattened `assignedTo`). */
  employeeId?: string;
  /** Inclusive `YYYY-MM-DD` bounds on the leave `from` date. */
  from?: string;
  to?: string;
}

/** Display-ready application list row. */
export interface SabcrmLeaveApplicationRow {
  id: string;
  employeeId: string | null;
  /** Resolved applicant label (null when unresolvable). */
  employeeLabel: string | null;
  leaveTypeId: string;
  /** Resolved leave-type label (`code — name`). */
  leaveTypeLabel: string | null;
  from: string;
  to: string;
  days: number;
  halfDay: boolean;
  balanceSnapshot: number | null;
  reason: string | null;
  status: CrmLeaveStatus;
  attachmentCount: number;
  createdAt: string | null;
}

export interface SabcrmLeaveApplicationListPage {
  rows: SabcrmLeaveApplicationRow[];
  page: number;
  hasMore: boolean;
}

/** One resolved approver-chain step for the detail timeline. */
export interface SabcrmLeaveApproverStepView {
  approverId: string | null;
  /** Resolved label when the approver id matches a roster employee. */
  approverLabel: string | null;
  status: CrmLeaveStatus;
  decidedAt: string | null;
  comment: string | null;
}

/** SabFiles attachment pointer (mirrors `crm_core::Attachment`). */
export interface SabcrmLeaveAttachmentView {
  fileId: string;
  name: string | null;
  mimeType: string | null;
  size: number | null;
}

/** Full detail payload for the application drawer. */
export interface SabcrmLeaveApplicationDetail extends SabcrmLeaveApplicationRow {
  approverChain: SabcrmLeaveApproverStepView[];
  attachments: SabcrmLeaveAttachmentView[];
  updatedAt: string | null;
}

/** Full-form create payload. `days` is server-computed. */
export interface SabcrmLeaveApplicationInput {
  leaveTypeId: string;
  /** `YYYY-MM-DD` (inclusive). */
  from: string;
  /** `YYYY-MM-DD` (inclusive). */
  to: string;
  halfDay: boolean;
  reason?: string;
  /** Applicant override — admin applying on behalf. */
  employeeId?: string;
  attachments?: { fileId: string; name?: string; mimeType?: string; size?: number }[];
}

export type SabcrmLeaveApplicationPatch = Partial<
  Omit<SabcrmLeaveApplicationInput, 'employeeId'>
>;

/* ─── KPIs ────────────────────────────────────────────────────── */

export interface SabcrmLeaveKpis {
  pendingCount: number;
  approvedThisMonth: number;
  onLeaveToday: number;
  typeCount: number;
  /** True when computed over a capped sample (first 100 applications). */
  sampled: boolean;
}
