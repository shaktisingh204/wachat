/**
 * SabCRM Finance — TDS-records surface action types.
 *
 * Shared between `sabcrm-finance-tds.actions.ts` ('use server' modules
 * may only export async functions) and the `/sabcrm/finance/tds`
 * doc-surface client. Mirrors the
 * `sabcrm-finance-invoices.actions.types.ts` convention; the wire
 * shape is `crm-tds::CrmTdsRecord` (crm-common style, 0-indexed list
 * pagination — the actions translate the kit's 1-based pages).
 */

import type {
  CrmTdsQuarter,
  CrmTdsStatus,
} from '@/lib/rust-client/crm-tds';

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status. */
export const SABCRM_TDS_TRANSITIONS: Record<CrmTdsStatus, CrmTdsStatus[]> = {
  pending: ['deposited'],
  deposited: ['filed'],
  filed: [],
  archived: [],
};

export const SABCRM_TDS_QUARTERS: { value: CrmTdsQuarter; label: string }[] = [
  { value: 'Q1', label: 'Q1 (Apr–Jun)' },
  { value: 'Q2', label: 'Q2 (Jul–Sep)' },
  { value: 'Q3', label: 'Q3 (Oct–Dec)' },
  { value: 'Q4', label: 'Q4 (Jan–Mar)' },
];

/* ─── List page ───────────────────────────────────────────────── */

/** Filters the list page sends to the fetcher (kit page is 1-based). */
export interface SabcrmTdsListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** '' = all statuses (mapped to the crate's `all`). */
  status?: CrmTdsStatus | '';
  /** e.g. `"2026-27"` ('' = all). */
  financialYear?: string;
  /** `Q1..Q4` ('' = all). */
  quarter?: CrmTdsQuarter | '';
  /** People-record id (the kit's party slot is the deductee filter). */
  employeeId?: string;
  /**
   * Inclusive `YYYY-MM-DD` bounds applied to `depositDate ?? createdAt`
   * (in-page refinement; the crate has no date filter).
   */
  from?: string;
  to?: string;
}

/** A display-ready list row — every authorable field surfaces. */
export interface SabcrmTdsListRow {
  id: string;
  employeeId: string;
  employeeName: string;
  financialYear: string;
  quarter: string;
  tdsAmount: number;
  grossAmount: number;
  certificateNumber: string;
  depositChallanNumber: string;
  depositDate: string | null;
  status: CrmTdsStatus;
  notes: string;
  createdAt?: string;
}

export interface SabcrmTdsListPage {
  rows: SabcrmTdsListRow[];
  page: number;
  hasMore: boolean;
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmTdsKpis {
  /** Records scanned. */
  count: number;
  /** Σ tdsAmount over `pending` records (awaiting deposit). */
  pendingAmount: number;
  pendingCount: number;
  /** Σ tdsAmount deposited in the CURRENT FY quarter. */
  depositedThisQuarter: number;
  /** Records with status `filed`. */
  filedCount: number;
  /** Σ tdsAmount over the CURRENT financial year (all statuses). */
  fyTotal: number;
  /** The FY the strip is scoped to (e.g. `"2026-27"`). */
  financialYear: string;
  /** The current quarter (e.g. `"Q1"`). */
  quarter: string;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Create / update (full form payloads) ────────────────────── */

export interface SabcrmTdsFullInput {
  /** Optional people-record id (picker); free-text name is canonical. */
  employeeId?: string;
  employeeName: string;
  /** e.g. `"2026-27"`. */
  financialYear: string;
  quarter: CrmTdsQuarter;
  tdsAmount: number;
  grossAmount?: number;
  certificateNumber?: string;
  depositChallanNumber?: string;
  /** `YYYY-MM-DD`. */
  depositDate?: string;
  /** Create default is `pending`. */
  status?: CrmTdsStatus;
  notes?: string;
}

/** Full-form patch — same shape, everything optional (no status). */
export type SabcrmTdsFullPatch = Partial<Omit<SabcrmTdsFullInput, 'status'>>;
