/**
 * SabCRM Finance — voucher-books surface action types.
 *
 * Shared between `sabcrm-finance-vouchers.actions.ts` ('use server'
 * modules may only export async functions) and the
 * `/sabcrm/finance/vouchers` doc-surface client. Mirrors the
 * `sabcrm-finance-invoices.actions.types.ts` convention; the wire shape
 * is `crm-vouchers::CrmVoucherBook` (crm-common style, 0-indexed list
 * pagination on the Rust side — the actions translate the kit's
 * 1-indexed pages).
 */

import type { CrmVoucherBookStatus } from '@/lib/rust-client/crm-vouchers';

/* ─── Vocabulary ──────────────────────────────────────────────── */

/** Book types accepted by `crm-vouchers` (`type` wire field). */
export type SabcrmVoucherBookType =
  | 'payment'
  | 'receipt'
  | 'contra'
  | 'journal'
  | 'purchase'
  | 'sales';

export const SABCRM_VOUCHER_BOOK_TYPES: {
  value: SabcrmVoucherBookType;
  label: string;
}[] = [
  { value: 'journal', label: 'Journal' },
  { value: 'payment', label: 'Payment' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'contra', label: 'Contra' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'sales', label: 'Sales' },
];

export type SabcrmVoucherBookResetFrequency = 'none' | 'yearly' | 'monthly';

/* ─── List page ───────────────────────────────────────────────── */

/** Filters the list page sends to the fetcher (kit page is 1-based). */
export interface SabcrmVoucherBookListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** '' = all statuses (mapped to the crate's `all`). */
  status?: CrmVoucherBookStatus | '';
  /** Book type filter ('' = all types). */
  type?: SabcrmVoucherBookType | '';
  /** Inclusive `YYYY-MM-DD` bounds applied to `createdAt` (in-page). */
  from?: string;
  to?: string;
}

/** A display-ready list row — every authorable field surfaces. */
export interface SabcrmVoucherBookListRow {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  prefix: string;
  suffix: string;
  startingNumber: number;
  padding: number;
  /** `prefix + zero-padded startingNumber + suffix` preview. */
  nextNumberPreview: string;
  resetFrequency: SabcrmVoucherBookResetFrequency | '';
  approvalRequired: boolean;
  isActive: boolean;
  status: CrmVoucherBookStatus;
  createdAt?: string;
}

export interface SabcrmVoucherBookListPage {
  rows: SabcrmVoucherBookListRow[];
  page: number;
  hasMore: boolean;
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmVoucherBookKpis {
  /** Books scanned. */
  count: number;
  activeCount: number;
  archivedCount: number;
  approvalRequiredCount: number;
  defaultCount: number;
  /** Books per type (only types that occur). */
  byType: Record<string, number>;
  /** Most common type ('' when no books). */
  topType: string;
  topTypeCount: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Create / update (full form payloads) ────────────────────── */

export interface SabcrmVoucherBookFullInput {
  name: string;
  type: SabcrmVoucherBookType;
  isDefault?: boolean;
  prefix?: string;
  suffix?: string;
  /** Series start (≥ 1 integer). */
  startingNumber?: number;
  /** Zero-padding width (0–10). */
  padding?: number;
  resetFrequency?: SabcrmVoucherBookResetFrequency;
  approvalRequired?: boolean;
  isActive?: boolean;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmVoucherBookFullPatch = Partial<SabcrmVoucherBookFullInput>;
