/**
 * SabCRM Supply — action input/output types.
 *
 * Lives beside `sabcrm-supply.actions.ts` because `'use server'` modules
 * may only export async functions; shared types go here (mirrors the
 * `sabcrm-finance.actions.types.ts` convention).
 *
 * Each interface is the deliberately small "New <thing>" dialog payload;
 * the action expands it into the entity's full Rust create DTO (single
 * line item where the crate requires `items[]`, totals derived from
 * `amount`).
 */

/** "New item" dialog payload (`crm-items`). */
export interface SabcrmSupplyItemFormInput {
  /** Display name. Required. */
  name: string;
  /** Stock-keeping unit — tenant-unique. Required. */
  sku: string;
  /** Sale price. Optional, defaults 0. */
  sellingPrice?: number;
  /** Purchase cost. Optional, defaults 0. */
  costPrice?: number;
  /** ISO-4217 code. Defaults to INR. */
  currency?: string;
  /** `"goods"` | `"service"`. Optional. */
  itemType?: string;
}

/** "New warehouse" dialog payload (`crm-warehouses`). */
export interface SabcrmSupplyWarehouseFormInput {
  name: string;
  code?: string;
  /** `"main" | "branch" | "franchise" | "3pl" | "virtual"`. */
  type?: string;
  city?: string;
}

/** "New stock adjustment" dialog payload (`crm-stock-adjustments`). */
export interface SabcrmSupplyStockAdjustmentFormInput {
  /** Why the stock moved (e.g. "Damage", "Inventory Count"). Required. */
  reason: string;
  /** Signed quantity — positive adds, negative removes. Required. */
  quantity: number;
  /** Warehouse id (24-char hex) — picked from the project's warehouses. */
  warehouseId: string;
  /** Item/product id (24-char hex) — picked from the project's items. */
  productId: string;
  /** Adjustment date (ISO). Defaults to now. */
  date?: string;
  notes?: string;
}

/** "New purchase order" dialog payload (`crm-purchase-orders`). */
export interface SabcrmSupplyPurchaseOrderFormInput {
  /** Document number, e.g. `PO-2026-0001`. Required. */
  poNo: string;
  /** Order date (ISO). Required. */
  date: string;
  /** Supplying vendor id — picked from the project's vendors. Required. */
  vendorId: string;
  /** Order total — expanded into a single line item + totals. Required. */
  amount: number;
  /** ISO-4217 code. Defaults to INR. */
  currency?: string;
}

/** "New GRN" dialog payload (`crm-grns`). */
export interface SabcrmSupplyGrnFormInput {
  /** Document number, e.g. `GRN-2026-0001`. Required. */
  grnNo: string;
  /** Receipt date (ISO). Required. */
  date: string;
  /** Supplying vendor id — picked from the project's vendors. Required. */
  vendorId: string;
  /** Receiving warehouse id — picked from the project's warehouses. Required. */
  warehouseId: string;
  /** Received item id — picked from the project's items. Required. */
  itemId: string;
  /** Quantity received (= ordered = accepted in the minimal dialog). */
  qty: number;
}

/** "New vendor" dialog payload (`crm-vendors`). */
export interface SabcrmSupplyVendorFormInput {
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  /** Free-form, e.g. "Goods Supplier" / "Service Provider". */
  vendorType?: string;
}

/** "New RFQ" dialog payload (`crm-rfqs`). */
export interface SabcrmSupplyRfqFormInput {
  /** Short request title. Required. */
  title: string;
  /** Requested item id — picked from the project's items. Required. */
  itemId: string;
  /** Requested quantity. Required, > 0. */
  qty: number;
  /** Needed-by date (ISO). Optional. */
  requiredBy?: string;
  /** Bid-submission deadline (ISO). Optional. */
  deadline?: string;
}

/** "New vendor bid" dialog payload (`crm-vendor-bids`). */
export interface SabcrmSupplyVendorBidFormInput {
  /** Parent RFQ id — picked from the project's open RFQs. Required. */
  rfqId: string;
  /** Bidding vendor id — picked from the project's vendors. Required. */
  vendorId: string;
  /** Quoted total — expanded into a single line item + totals. Required. */
  amount: number;
  /** ISO-4217 code. Defaults to INR. */
  currency?: string;
}

/** "New BOM" dialog payload (`crm-bom`). */
export interface SabcrmSupplyBomFormInput {
  /** Document number, e.g. `BOM-001`. Required. */
  bomNo: string;
  /** What the BOM produces. Required. */
  finishedGoodName: string;
  /** Output quantity per run. Required, > 0. */
  outputQty: number;
  /** Output unit (pcs, kg, …). Required. */
  unit: string;
}

/** "New production order" dialog payload (`crm-production-orders`). */
export interface SabcrmSupplyProductionOrderFormInput {
  /** What is being produced. Required. */
  finishedGoodName: string;
  /** Planned output quantity. Required, > 0. */
  plannedQty: number;
  /** Output unit (pcs, kg, …). Required. */
  unit: string;
  /** Planned start (ISO). Optional. */
  plannedStart?: string;
}
