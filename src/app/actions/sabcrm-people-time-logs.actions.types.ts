/**
 * SabCRM People — Time Logs action types (client-safe).
 *
 * Shared vocabulary between `sabcrm-people-time-logs.actions.ts` and
 * the `/sabcrm/people/time-logs` timesheet surface (WI-34, with the
 * WI-13 `tenantProjectId` exception handled inside the actions).
 * No server imports.
 */

import type {
  CrmTimeLogDoc,
  CrmTimeLogEntityKind,
  CrmTimeLogStatus,
} from '@/lib/rust-client/crm-time-logs';
import type { DocStatusDef } from '@/app/sabcrm/finance/_components/doc-surface/types';

export type { CrmTimeLogDoc, CrmTimeLogEntityKind, CrmTimeLogStatus };

/* ─── Status vocabulary ─────────────────────────────────────────── */

export const TIME_LOG_STATUSES: (DocStatusDef & {
  value: CrmTimeLogStatus;
})[] = [
  { value: 'running', label: 'Running', tone: 'info' },
  { value: 'stopped', label: 'Stopped', tone: 'neutral' },
  { value: 'approved', label: 'Approved', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const TIME_LOG_ENTITY_KINDS: {
  value: CrmTimeLogEntityKind;
  label: string;
}[] = [
  { value: 'task', label: 'Task' },
  { value: 'project_task', label: 'Project task' },
  { value: 'issue', label: 'Issue' },
  { value: 'ticket', label: 'Ticket' },
];

/** "h:mm" display for a minutes total. */
export function formatDurationMinutes(minutes: number): string {
  const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  const h = Math.floor(safe / 60);
  const m = Math.round(safe % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/* ─── List ──────────────────────────────────────────────────────── */

export interface SabcrmTimeLogListFilters {
  page: number;
  q?: string;
  status: CrmTimeLogStatus | '';
  /** Inclusive `YYYY-MM-DD` bounds on `startedAt` (page post-filter —
   *  the engine list has no date params). */
  from?: string;
  to?: string;
}

export interface SabcrmTimeLogListRow {
  id: string;
  /** Resolved `userLogId` label; null = no employee linked. */
  employeeLabel: string | null;
  /** Resolved work-item label (project/task/issue) or kind fallback. */
  workItemLabel: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  /** "h:mm". */
  durationLabel: string;
  isBillable: boolean;
  hourlyRate: number | null;
  /** duration × rate (0 when not billable / no rate). */
  amount: number;
  status: CrmTimeLogStatus;
  description: string | null;
  currency: string;
}

export interface SabcrmTimeLogListPage {
  rows: SabcrmTimeLogListRow[];
  hasMore: boolean;
}

/* ─── KPIs ──────────────────────────────────────────────────────── */

export interface SabcrmTimeLogKpis {
  /** Minutes tracked across the latest page window (≤100 logs). */
  totalMinutes: number;
  billableMinutes: number;
  billableAmount: number;
  runningCount: number;
  pendingApprovalCount: number;
  currency: string;
}

/* ─── Form input (full DTO field set) ───────────────────────────── */

export interface SabcrmTimeLogInput {
  /** Employee logging the time (picked — never typed). */
  userLogId?: string;
  /** WORK project FK (picked from CRM records). */
  projectId?: string;
  taskId?: string;
  issueId?: string;
  entityKind?: CrmTimeLogEntityKind | '';
  entityId?: string;
  /** RFC3339 / `datetime-local` value. */
  startedAt?: string;
  endedAt?: string;
  durationMinutes?: number;
  description?: string;
  isBillable?: boolean;
  hourlyRate?: number;
  status?: CrmTimeLogStatus;
}

/** Edit-drawer seed: the doc + cached picker labels. */
export interface SabcrmTimeLogView {
  doc: CrmTimeLogDoc;
  employeeLabel: string | null;
  projectLabel: string | null;
  taskLabel: string | null;
  issueLabel: string | null;
}

/** Start-timer dialog payload. */
export interface SabcrmStartTimerInput {
  userLogId?: string;
  description?: string;
  projectId?: string;
  taskId?: string;
  isBillable?: boolean;
  hourlyRate?: number;
}
