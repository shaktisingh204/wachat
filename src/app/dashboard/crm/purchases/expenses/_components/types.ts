/**
 * Shared types for the canonical Bills (expenses) module client islands.
 *
 * `BillListRow` is the wire-format the server-side `page.tsx` projects
 * its docs into before handing them off to the client tables / calendar.
 * IDs are stringified so the components stay serialization-safe.
 *
 * Mirrors `src/app/dashboard/crm/sales/invoices/_components/types.ts`,
 * adapted for the buy-side bill entity (vendor instead of customer,
 * linked PO instead of quote, etc.).
 */

import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';

export interface BillListRow {
  _id: string;
  billNo: string;
  vendorInvoiceNo?: string;
  vendorId: string | null;
  vendorLabel?: string;
  projectId?: string | null;
  branchId?: string | null;
  billDate?: string | null;
  dueDate?: string | null;
  currency: string;
  total: number;
  paid: number;
  balance: number;
  status?: CrmBillStatus | string;
  linkedPoId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillKpiSnapshot {
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
  paidThisMonthCount: number;
  paidThisMonthAmount: number;
  draftCount: number;
  avgDaysToPay: number | null;
  /** Sum of totals.total for bills with billDate in the current month. */
  mtdSpend: number;
  /** Bills whose status is `submitted` — i.e. waiting on approval. */
  pendingApprovalCount: number;
  /** Vendor id with the largest sum(totals.total) across the sample. */
  topVendorId: string | null;
  topVendorAmount: number;
  topVendorCount: number;
}

export type BillPresetKey =
  | 'all'
  | 'my-overdue'
  | 'due-this-week'
  | 'paid-30d'
  | 'draft';

export type BillViewMode = 'table' | 'calendar';

export type BillDensity = 'comfortable' | 'compact' | 'dense';
