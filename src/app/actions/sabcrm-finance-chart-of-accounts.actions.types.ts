/**
 * SabCRM Finance — chart-of-accounts surface action types.
 *
 * Shared between `sabcrm-finance-chart-of-accounts.actions.ts` ('use
 * server' modules may only export async functions) and the
 * `/sabcrm/finance/accounts` doc-surface client. Mirrors the
 * `sabcrm-finance-invoices.actions.types.ts` convention; the wire
 * shape is `crm-chart-of-accounts::CrmChartOfAccount` (crm-common
 * style, 0-indexed list pagination — the actions translate the kit's
 * 1-based pages).
 */

import type {
  CrmChartOfAccountStatus,
  CrmChartOfAccountType,
} from '@/lib/rust-client/crm-chart-of-accounts';

/* ─── Vocabulary ──────────────────────────────────────────────── */

export const SABCRM_ACCOUNT_TYPES: {
  value: CrmChartOfAccountType;
  label: string;
}[] = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'equity', label: 'Equity' },
];

/* ─── List page ───────────────────────────────────────────────── */

/** Filters the list page sends to the fetcher (kit page is 1-based). */
export interface SabcrmChartOfAccountListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** '' = all statuses (mapped to the crate's `all`). */
  status?: CrmChartOfAccountStatus | '';
  /** Account-type filter ('' = all types) — toolbar Select. */
  accountType?: CrmChartOfAccountType | '';
  /** Account-group filter (deep links). */
  accountGroupId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to `createdAt` (in-page). */
  from?: string;
  to?: string;
}

/** A display-ready list row (group + parent resolved to labels). */
export interface SabcrmChartOfAccountListRow {
  id: string;
  name: string;
  code: string;
  accountType: CrmChartOfAccountType | '';
  accountGroupId: string;
  /** Resolved group name, or null when unset / no longer existing. */
  groupLabel: string | null;
  parentId: string;
  /** Resolved parent-account name, or null. */
  parentLabel: string | null;
  openingBalance: number;
  currency: string;
  isActive: boolean;
  status: CrmChartOfAccountStatus;
  notes: string;
  createdAt?: string;
}

export interface SabcrmChartOfAccountListPage {
  rows: SabcrmChartOfAccountListRow[];
  page: number;
  hasMore: boolean;
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmChartOfAccountKpis {
  /** Accounts scanned. */
  count: number;
  activeCount: number;
  /** isActive=false or archived. */
  inactiveCount: number;
  /** Counts per account type (asset/liability/income/expense/equity). */
  byType: Record<string, number>;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Create / update (full form payloads) ────────────────────── */

export interface SabcrmChartOfAccountFullInput {
  name: string;
  code?: string;
  /** REAL account-group id (Select over the project's groups). */
  accountGroupId?: string;
  accountType?: CrmChartOfAccountType;
  /** REAL parent-account id (EntityPicker over the chart). */
  parentId?: string;
  openingBalance?: number;
  currency?: string;
  isActive?: boolean;
  notes?: string;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmChartOfAccountFullPatch =
  Partial<SabcrmChartOfAccountFullInput>;
