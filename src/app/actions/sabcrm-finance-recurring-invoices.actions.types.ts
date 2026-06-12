/**
 * SabCRM Finance — recurring-invoice surface action types.
 *
 * Shared between `sabcrm-finance-recurring-invoices.actions.ts` ('use
 * server' modules may only export async functions) and the
 * `/sabcrm/finance/recurring-invoices` doc-surface client
 * (finance-rollout spec §3.11 — DocListPage + Dialog form, pause /
 * resume actions, no detail route v1).
 */

import type {
  CrmRecurringInvoiceFrequency,
  CrmRecurringInvoiceStatus,
} from '@/lib/rust-client/crm-recurring-invoices';
import type { SabcrmPartyObjectSlug } from './sabcrm-finance-invoices.actions.types';

/* ─── Create / update (full dialog payloads) ──────────────────── */

export interface SabcrmRecurringInvoiceFullInput {
  title?: string;
  /** "Invoice to clone" — a REAL picked invoice id. */
  invoiceTemplateId?: string;
  /** REAL picked customer (records-engine record id). Required — this
   *  surface never mints placeholder ids. */
  customerId: string;
  frequency: CrmRecurringInvoiceFrequency;
  /** `YYYY-MM-DD`. Required. */
  startDate: string;
  /** `YYYY-MM-DD`. */
  endDate?: string;
  status?: CrmRecurringInvoiceStatus;
  notes?: string;
}

export type SabcrmRecurringInvoiceFullPatch =
  Partial<SabcrmRecurringInvoiceFullInput>;

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status. */
export const SABCRM_RECURRING_TRANSITIONS: Record<
  CrmRecurringInvoiceStatus,
  CrmRecurringInvoiceStatus[]
> = {
  active: ['paused', 'stopped'],
  paused: ['active', 'stopped'],
  stopped: [],
  completed: [],
  archived: [],
};

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmRecurringInvoiceListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmRecurringInvoiceStatus | '';
  /** Inclusive `YYYY-MM-DD` bounds applied to `startDate` in-page. */
  from?: string;
  to?: string;
}

/**
 * A display-ready list row (customer resolved to a label). Carries the
 * full editable field set so the row-click edit dialog seeds without a
 * second fetch.
 */
export interface SabcrmRecurringInvoiceListRow {
  id: string;
  title: string;
  customerId: string;
  /** Resolved customer label, or null when the record no longer exists. */
  customerLabel: string | null;
  customerObjectSlug: SabcrmPartyObjectSlug | null;
  invoiceTemplateId: string | null;
  /** Resolved template-invoice number, or null. */
  invoiceTemplateLabel: string | null;
  frequency: string;
  startDate: string;
  endDate: string;
  nextRunAt: string;
  lastRunAt: string;
  totalRuns: number;
  status: CrmRecurringInvoiceStatus;
  notes: string;
}

export interface SabcrmRecurringInvoiceListPage {
  rows: SabcrmRecurringInvoiceListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmRecurringInvoiceKpis {
  activeCount: number;
  /** Active schedules whose nextRunAt falls within the next 7 days. */
  dueIn7Days: number;
  pausedCount: number;
  /** Σ totalRuns — lifetime generated invoices across schedules. */
  lifetimeRuns: number;
  /** Schedules scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}
