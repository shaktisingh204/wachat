import 'server-only';

/**
 * CRM Item/Product client — wraps `/v1/crm/items` on the Rust BFF.
 *
 * Built via the generic `makeCrmClient` factory. Tightly-typed against the
 * Rust `CrmProduct` DTO (`rust/crates/crm-items/src/types.rs`).
 *
 * Counterpart to the legacy direct-Mongo server actions in
 * `src/app/actions/crm-products.actions.ts`. When `USE_RUST_CRM === 'true'`
 * those actions delegate here.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

/* ─── Nested wire shapes — mirror crm-items::types ───────────────────── */

export interface CrmItemInventoryRow {
    warehouseId: string;
    stock: number;
    reorderPoint?: number;
}

export interface CrmItemDimensions {
    length?: number;
    breadth?: number;
    height?: number;
    volume?: number;
}

export interface CrmItemWeight {
    gross?: number;
    net?: number;
}

/* ─── Wire types — mirror crm-items::types::CrmProduct ────────────────── */

export interface CrmItemDoc {
    _id?: string;
    userId: string;

    name: string;
    sku: string;

    description?: string;
    categoryId?: string;
    brandId?: string;
    unitId?: string;

    /* pricing */
    costPrice: number;
    sellingPrice: number;
    taxRate?: number;
    currency: string;
    hsnSac?: string;
    itemType?: 'goods' | 'service' | string;

    /* inventory */
    isTrackInventory: boolean;
    inventory?: CrmItemInventoryRow[];
    totalStock: number;

    /* physical */
    dimensions?: CrmItemDimensions;
    weight?: CrmItemWeight;

    /* variants / batches (opaque on the wire — same as TS `any[]`) */
    variants?: unknown[];
    batches?: unknown[];
    batchTracking?: boolean;

    /* images */
    images?: string[];

    createdAt: string;
    updatedAt?: string;
}

/**
 * Subset of `CrmItemDoc` accepted by `POST /v1/crm/items`. Mirrors
 * `crm-items::dto::CreateItemInput` exactly.
 */
export interface CrmItemCreateInput {
    name: string;
    sku: string;

    description?: string;
    categoryId?: string;
    brandId?: string;
    unitId?: string;

    costPrice?: number;
    sellingPrice?: number;
    taxRate?: number;
    currency?: string;
    hsnSac?: string;
    itemType?: 'goods' | 'service' | string;

    isTrackInventory?: boolean;
    inventory?: CrmItemInventoryRow[];
    totalStock?: number;

    dimensions?: CrmItemDimensions;
    weight?: CrmItemWeight;

    variants?: unknown[];
    batches?: unknown[];
    batchTracking?: boolean;

    images?: string[];
}

/**
 * PATCH body — every field optional. Mirrors
 * `crm-items::dto::UpdateItemInput`.
 */
export type CrmItemUpdateInput = Partial<CrmItemCreateInput>;

/* ─── Public API ─────────────────────────────────────────────────────── */

export const itemApi: CrmClient<CrmItemDoc, CrmItemCreateInput> = makeCrmClient<
    CrmItemDoc,
    CrmItemCreateInput
>('/v1/crm/items');
