/**
 * CRM Reports — TS DTOs mirroring `rust/crates/crm-reports-types`
 * (`ReportDefinition` / `ReportRequest` / `ReportResult`).
 *
 * Names + casing match the Rust serde shapes (camelCase root keys,
 * snake_case `ReportKind` variants) so a saved doc round-trips between
 * the Rust scheduler and the TS engine without translation.
 *
 * Plan reference: `crm_function_plan.md` §7 + `CRM_REBUILD_PLAN.md` §6.8.
 */

import type { ObjectId } from 'mongodb';

/* ─── Catalogue ──────────────────────────────────────────────────────── */

/**
 * Mirrors `ReportKind` in
 * `rust/crates/crm-reports-types/src/report.rs`. Snake-case on the wire.
 * Keep this list in lock-step with the Rust enum — both sides switch on
 * these literals.
 */
export type ReportKind =
    /* GST / India statutory */
    | 'gstr1'
    | 'gstr2b'
    | 'gstr3b'
    /* AR / AP / cash */
    | 'invoice_aging'
    | 'payment_report'
    | 'expense_report'
    | 'income_report'
    | 'profit_and_loss'
    | 'tax_report'
    /* sales analytics */
    | 'top_clients'
    | 'top_products'
    | 'sales_deals'
    | 'sales_summary'
    | 'leads_conversion'
    | 'lead_funnel'
    /* people / HRM */
    | 'birthday_anniversary'
    | 'agent_performance'
    /* projects / tasks / tickets */
    | 'project_status'
    | 'late_report'
    | 'overdue_tasks'
    | 'task_report'
    | 'task_completion'
    | 'ticket_report'
    /* attendance / leave */
    | 'attendance_report'
    | 'leave_report'
    | 'leave_balance_report'
    /* accounting books / payroll registers */
    | 'balance_sheet'
    | 'trial_balance'
    | 'day_book'
    | 'cash_flow'
    | 'pf_register'
    | 'esi_register'
    | 'pt_register'
    | 'tds_register'
    | 'form_24q'
    | 'form_12ba'
    | 'form_16'
    | 'bank_disbursement'
    | 'payroll_summary';

export const REPORT_KINDS: readonly ReportKind[] = [
    'gstr1',
    'gstr2b',
    'gstr3b',
    'invoice_aging',
    'payment_report',
    'expense_report',
    'income_report',
    'profit_and_loss',
    'tax_report',
    'top_clients',
    'top_products',
    'sales_deals',
    'sales_summary',
    'leads_conversion',
    'lead_funnel',
    'birthday_anniversary',
    'agent_performance',
    'project_status',
    'late_report',
    'overdue_tasks',
    'task_report',
    'task_completion',
    'ticket_report',
    'attendance_report',
    'leave_report',
    'leave_balance_report',
    'balance_sheet',
    'trial_balance',
    'day_book',
    'cash_flow',
    'pf_register',
    'esi_register',
    'pt_register',
    'tds_register',
    'form_24q',
    'form_12ba',
    'form_16',
    'bank_disbursement',
    'payroll_summary',
];

/* ─── Common envelope ────────────────────────────────────────────────── */

export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'json';

export interface ReportFilter {
    from?: Date | string;
    to?: Date | string;
    /** "day" | "week" | "month" | "agent" | "client" | "branch" */
    groupBy?: string;
    branchId?: string;
    projectId?: string;
    ownerId?: string;
    /** Opaque per-kind filter bag (e.g. `{ fyYear: '2024-25' }`). */
    custom?: Record<string, unknown>;
}

export type ReportCadence = 'one_time' | 'cron';

export interface ReportSchedule {
    cadence: ReportCadence;
    /** Standard 5-field cron expression. Only meaningful when cadence='cron'. */
    cron?: string;
    /** IANA tz, e.g. "Asia/Kolkata". Defaults to the project tz when unset. */
    timezone?: string;
    /** Maintained by the scheduler, not the user. */
    nextRun?: Date | string;
    active: boolean;
}

/**
 * Where a finished render goes. Mirrors the Rust tagged enum:
 *   { kind: 'user'|'email'|'webhook', value: string }
 */
export type ReportRecipient =
    | { kind: 'user'; value: string }
    | { kind: 'email'; value: string }
    | { kind: 'webhook'; value: string };

/**
 * Convenience grouping for the planner's `delivery` envelope. Multiple
 * channels can be configured on a single definition; the engine fans
 * out at run-time.
 */
export interface ReportDelivery {
    email?: { to: string[]; subject?: string };
    webhook?: { url: string; headers?: Record<string, string> };
}

/* ─── Saved definition + run ─────────────────────────────────────────── */

export interface ReportDefinition {
    _id?: string | ObjectId;
    /** Tenant owner. */
    userId: string | ObjectId;
    /** Optional project scope; null/undefined = tenant-wide. */
    projectId?: string | ObjectId | null;

    kind: ReportKind;
    name: string;
    description?: string;

    filters?: ReportFilter;
    format?: ReportFormat;
    schedule?: ReportSchedule | null;
    recipients?: ReportRecipient[];
    delivery?: ReportDelivery | null;

    /** Last successful render. */
    lastRunAt?: Date | string | null;

    createdAt?: Date | string;
    updatedAt?: Date | string;
    createdBy?: string | ObjectId | null;
    updatedBy?: string | ObjectId | null;
}

/**
 * Result of one engine invocation. The engine produces columns + rows
 * (the tabular shape every handler returns), an optional summary blob,
 * and either an artifact reference (when persisted) or an inline error.
 */
export interface ReportRunResult {
    columns: string[];
    rows: unknown[][];
    summary?: Record<string, number | string | null>;
    /** Soft error — handler not implemented yet, or input invalid. */
    error?: string;
    /** Echoed for callers that don't already know the kind. */
    kind?: ReportKind;
}

export type ReportRunStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface ReportRun {
    _id?: string | ObjectId;
    definitionId: string | ObjectId;
    userId: string | ObjectId;
    kind: ReportKind;
    status: ReportRunStatus;
    /** UTC ms at which the run started. */
    startedAt: Date | string;
    /** UTC ms at which the run finished (success OR failure). */
    finishedAt?: Date | string | null;
    /** Captured output. Trimmed to the first N rows when persisted. */
    result?: ReportRunResult;
    /** Top-level failure (a thrown error, not a handler-soft-error). */
    error?: string | null;
    /** Source of the trigger — useful for debugging schedule storms. */
    trigger: 'manual' | 'cron' | 'webhook' | 'api';
    /** Set after delivery dispatch. */
    delivered?: {
        email?: { ok: boolean; recipients: string[]; error?: string };
        webhook?: { ok: boolean; status?: number; error?: string };
    };
    rowCount?: number;
}

/* ─── Engine input options ───────────────────────────────────────────── */

export interface ReportRunOptions {
    /** Resolves to the tenant id when the engine runs outside a request. */
    tenantUserId?: string;
    /** Snapshot date for "as of" reports (defaults to now). */
    asOf?: Date;
}
