/**
 * SabCRM Finance — sales-order-surface action types.
 *
 * Shared between `sabcrm-finance-sales-orders.actions.ts` ('use server'
 * modules may only export async functions) and the sales-order clients.
 * Mirrors the `sabcrm-finance-invoices.actions.types.ts` convention.
 */

import type {
  CrmSalesOrderDeliveryMethod,
  CrmSalesOrderStatus,
} from '@/lib/rust-client/crm-sales-orders';
import type {
  DocLineInput,
  DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { SabcrmPartyObjectSlug } from './sabcrm-finance-invoices.actions.types';

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status (spec §3.2). */
export const SABCRM_SALES_ORDER_TRANSITIONS: Record<
  CrmSalesOrderStatus,
  CrmSalesOrderStatus[]
> = {
  open: ['partial', 'fulfilled', 'closed', 'cancelled'],
  partial: ['fulfilled', 'closed'],
  fulfilled: ['closed'],
  closed: [],
  cancelled: ['open'],
};

/** Delivery-method vocabulary (snake_case wire values, spec §3.2). */
export const SABCRM_SO_DELIVERY_METHODS: {
  value: CrmSalesOrderDeliveryMethod;
  label: string;
}[] = [
  { value: 'courier', label: 'Courier' },
  { value: 'transporter', label: 'Transporter' },
  { value: 'in_house', label: 'In-house delivery' },
  { value: 'pickup', label: 'Customer pickup' },
  { value: 'digital', label: 'Digital delivery' },
];

/* ─── Create / update (full form payloads) ────────────────────── */

/**
 * The full sales-order-form payload. Totals are NOT part of the input —
 * the action recomputes them from `lines` + `totalsModifiers`.
 */
export interface SabcrmSalesOrderFullInput {
  soNo: string;
  /** REAL picked party (records-engine record id). Required. */
  clientId: string;
  currency: string;
  /** `YYYY-MM-DD`. */
  date: string;
  lines: DocLineInput[];
  /** Header modifiers folded into the recomputed wire `totals`. */
  totalsModifiers?: DocTotalsModifiersInput;
  /** Parent quotation (picked via `searchSabcrmFinanceQuotationRefs`). */
  quotationRef?: string;
  /** Customer purchase-order number / date. */
  poNo?: string;
  /** `YYYY-MM-DD`. */
  poDate?: string;
  /** `YYYY-MM-DD`. */
  expectedShipmentDate?: string;
  deliveryMethod?: CrmSalesOrderDeliveryMethod;
  paymentTerms?: string;
  /** FX rate vs the tenant base currency — finite, > 0. */
  exchangeRate?: number;
  customerNotes?: string;
  /** Internal-only notes (rail, never on the customer paper). */
  internalNotes?: string;
  /** Optional lineage parent (quotation → SO). */
  fromKind?: 'quotation' | 'deal' | 'lead';
  fromId?: string;
}

/**
 * Full-form patch. NB: the Rust `UpdateSalesOrderInput` cannot change
 * `soNo` or `clientId` — the edit surface locks those fields.
 */
export type SabcrmSalesOrderFullPatch = Partial<
  Omit<SabcrmSalesOrderFullInput, 'soNo' | 'clientId' | 'fromKind' | 'fromId'>
>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmSalesOrderListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmSalesOrderStatus | '';
  clientId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the order date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (party already resolved to a label). */
export interface SabcrmSalesOrderListRow {
  id: string;
  soNo: string;
  poNo: string | null;
  partyId: string;
  /** Resolved customer label, or null when the record no longer exists. */
  partyLabel: string | null;
  partyObjectSlug: SabcrmPartyObjectSlug | null;
  date: string;
  expectedShipmentDate: string | null;
  currency: string;
  total: number;
  status: CrmSalesOrderStatus;
}

export interface SabcrmSalesOrderListPage {
  rows: SabcrmSalesOrderListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmSalesOrderKpis {
  /** Dominant currency among scanned orders (formats the strip). */
  currency: string;
  /** Σ totals.total over open + partial orders. */
  openValue: number;
  /** Orders awaiting fulfillment (open + partial). */
  awaitingCount: number;
  /** Orders fulfilled with activity in the current month. */
  fulfilledThisMonth: number;
  /** Open/partial orders expected to ship within the next 7 days. */
  dueToShipCount: number;
  /** Orders scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Detail ──────────────────────────────────────────────────── */

/** Per-line fulfillment summary for the detail rail card. */
export interface SabcrmSalesOrderFulfillmentLine {
  description: string;
  qty: number;
  qtyPending?: number;
  qtyDelivered?: number;
  qtyInvoiced?: number;
}

/** Result payload of the convert actions (route target for the toast). */
export interface SabcrmSalesOrderConvertResult {
  id: string;
  number: string;
  href: string;
}
