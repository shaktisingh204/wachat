/**
 * SabCRM People — Payslips action types (client-safe).
 *
 * Shared vocabulary between `sabcrm-people-payslips.actions.ts` and the
 * `/sabcrm/people/payslips` surfaces, including the dual-shape guard
 * (people-suite WI-9 / risk R7). No server imports.
 */

import type { CrmPayslipStatus } from '@/lib/rust-client/crm-payslips';
import type {
  CrmPayslipDoc,
  SabcrmRichPayslipDoc,
  SabcrmUnifiedPayslipDoc,
} from '@/lib/rust-client/sabcrm-people-payslips';
import type { DocStatusDef } from '@/app/sabcrm/finance/_components/doc-surface/types';

/* ─── Dual-shape guard ──────────────────────────────────────────── */

/**
 * Branch the unified payslip union on `runId` presence (only the rich
 * render-ready shape carries it). Mirrors the engine's
 * `decode_unified` exactly — getting this wrong is risk R7.
 */
export function isRichSabcrmPayslip(
  p: SabcrmUnifiedPayslipDoc,
): p is SabcrmRichPayslipDoc {
  return typeof (p as SabcrmRichPayslipDoc).runId === 'string';
}

/* ─── Status vocabulary ─────────────────────────────────────────── */

/**
 * Synthetic status the LIST rows use for rich payslips (the rich shape
 * stores `locked`/`sent` flags, not a status). Filtering by it is
 * handled action-side (rows where `kind === 'rich'`); the flat
 * statuses pass through to the engine `status` filter.
 */
export const PAYSLIP_RICH_STATUS = 'generated';

export const PAYSLIP_STATUSES: DocStatusDef[] = [
  { value: PAYSLIP_RICH_STATUS, label: 'Generated', tone: 'info' },
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'issued', label: 'Issued', tone: 'info' },
  { value: 'paid', label: 'Paid', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Happy path for the rich payslip detail rail. */
export const PAYSLIP_RICH_FLOW = [PAYSLIP_RICH_STATUS, 'sent'] as const;

export const PAYSLIP_RICH_DETAIL_STATUSES: DocStatusDef[] = [
  { value: PAYSLIP_RICH_STATUS, label: 'Generated', tone: 'info' },
  { value: 'sent', label: 'Sent', tone: 'success' },
];

/** Flat payslip detail vocabulary (legacy CRUD shape). */
export const PAYSLIP_FLAT_FLOW: CrmPayslipStatus[] = [
  'draft',
  'issued',
  'paid',
];

/* ─── List ──────────────────────────────────────────────────────── */

export interface SabcrmPayslipListFilters {
  page: number;
  q?: string;
  /** One of `PAYSLIP_STATUSES` values or '' for all. */
  status: string;
  /** Employee filter (kit `partyId` repurposed). */
  employeeId?: string;
  /** Deep-link filter: payslips generated from one payroll run. */
  runId?: string;
  /** Inclusive `YYYY-MM-DD` bounds on the period (page post-filter). */
  from?: string;
  to?: string;
}

export interface SabcrmPayslipListRow {
  id: string;
  kind: 'rich' | 'flat';
  /** "April 2026" (rich `header.periodLabel`) or the flat payPeriod date. */
  periodLabel: string;
  employeeId: string;
  employeeLabel: string | null;
  gross: number;
  deductions: number;
  net: number;
  sent: boolean;
  locked: boolean;
  /** Flat wire status, or `PAYSLIP_RICH_STATUS` for rich rows. */
  status: string;
  currency: string;
  runId: string | null;
}

export interface SabcrmPayslipListPage {
  rows: SabcrmPayslipListRow[];
  hasMore: boolean;
}

/* ─── Detail ────────────────────────────────────────────────────── */

export interface SabcrmPayslipDetail {
  /** Deflated unified document (branch with `isRichSabcrmPayslip`). */
  payslip: SabcrmUnifiedPayslipDoc;
  /** Resolved label for flat payslips (rich carry their snapshot). */
  employeeLabel: string | null;
}

/** Convenience aliases re-exported for the surface components. */
export type { CrmPayslipDoc, SabcrmRichPayslipDoc, SabcrmUnifiedPayslipDoc };
