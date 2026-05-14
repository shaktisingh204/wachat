/**
 * Shared types for the canonical Invoices module client islands.
 *
 * `InvoiceListRow` is the wire-format the server-side `page.tsx` projects
 * its docs into before handing them off to the client tables / calendar.
 * IDs are stringified so the components stay serialization-safe.
 */

import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';

export interface InvoiceListRow {
  _id: string;
  invoiceNo: string;
  clientId: string | null;
  clientLabel?: string;
  salesAgentId?: string | null;
  branchId?: string | null;
  date?: string | null;
  dueDate?: string | null;
  currency: string;
  total: number;
  paid: number;
  balance: number;
  status?: CrmInvoiceStatus | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceKpiSnapshot {
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
  paidThisMonthCount: number;
  paidThisMonthAmount: number;
  draftCount: number;
  avgDaysToPay: number | null;
}

export type InvoicePresetKey =
  | 'all'
  | 'my-overdue'
  | 'due-this-week'
  | 'paid-30d'
  | 'draft';

export type InvoiceViewMode = 'table' | 'calendar';

export type InvoiceDensity = 'comfortable' | 'compact' | 'dense';
