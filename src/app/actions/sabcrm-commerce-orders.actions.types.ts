/**
 * SabCRM Commerce — Orders surface action types (rollout spec WI-13).
 *
 * Lives beside `sabcrm-commerce-orders.actions.ts` because `'use
 * server'` modules may only export async functions. Orders are
 * read-heavy: they originate from storefront checkout, so there is no
 * create payload here — only display-ready list rows, filters and the
 * KPI strip.
 *
 * Wire enums are crate-typed (`crm-store`): paymentStatus
 * `pending|paid|failed|refunded`, fulfillmentStatus
 * `unfulfilled|partial|fulfilled|cancelled`.
 */

import type {
  CrmStoreOrderFulfillmentStatus,
  CrmStoreOrderPaymentStatus,
} from '@/lib/rust-client/crm-store';

/** Kit `DocListFilters` mapped onto the orders wire. */
export interface SabcrmStoreOrderListFilters {
  /** 1-indexed UI page (the action translates to the 0-indexed wire). */
  page?: number;
  limit?: number;
  q?: string;
  /** Payment status ('' = all). */
  status: CrmStoreOrderPaymentStatus | '';
  /** Toolbar party filter — storefront. */
  storefrontId?: string;
  /** Inclusive `YYYY-MM-DD` bounds on `placedAt` (in-page refinement). */
  from?: string;
  to?: string;
}

/** One display-ready order row — labels resolved, never an ObjectId. */
export interface SabcrmStoreOrderListRow {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  storefrontId: string;
  /** Resolved storefront name (null renders "Unknown"). */
  storefrontLabel: string | null;
  itemsCount: number;
  total: number;
  currency: string;
  paymentStatus: CrmStoreOrderPaymentStatus;
  fulfillmentStatus: CrmStoreOrderFulfillmentStatus;
  paymentMethod: string;
  paymentRef: string | null;
  linkedInvoiceId: string | null;
}

export interface SabcrmStoreOrderListPage {
  rows: SabcrmStoreOrderListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip (computed over a capped sample — `sampled` flags the cap). */
export interface SabcrmStoreOrderKpis {
  currency: string;
  count: number;
  paidTotal: number;
  pendingCount: number;
  unfulfilledCount: number;
  thisMonthCount: number;
  thisMonthTotal: number;
  sampled: boolean;
}
