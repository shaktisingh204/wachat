/**
 * Shared types for the canonical Purchase Orders module client islands.
 *
 * `PurchaseOrderListRow` is the wire-format the server-side `page.tsx`
 * projects its docs into before handing them off to the client tables /
 * calendar. IDs are stringified so the components stay serialization-safe.
 *
 * Mirror of the Invoices `_components/types.ts` per CRM_REBUILD_PLAN §1D.
 */

import type { CrmPurchaseOrderStatus } from '@/lib/rust-client/crm-purchase-orders';

export interface PurchaseOrderListRow {
  _id: string;
  poNo: string;
  vendorId: string | null;
  vendorLabel?: string;
  buyerId?: string | null;
  approverId?: string | null;
  branchId?: string | null;
  date?: string | null;
  expectedDelivery?: string | null;
  currency: string;
  total: number;
  status?: CrmPurchaseOrderStatus | string;
  createdAt?: string;
  updatedAt?: string;
}

export type PurchaseOrderPresetKey =
  | 'all'
  | 'all-open'
  | 'my-pending-approval'
  | 'overdue-delivery'
  | 'closed-30d'
  | 'drafts';

export type PurchaseOrderViewMode = 'table' | 'calendar';

export type PurchaseOrderDensity = 'comfortable' | 'compact' | 'dense';
