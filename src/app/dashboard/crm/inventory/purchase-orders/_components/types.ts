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
