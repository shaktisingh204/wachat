import 'server-only';

/**
 * SabCRM Commerce client — wraps the project-scoped re-mounts of the
 * legacy CRM POS + online-store crates under `/v1/sabcrm/commerce/*`
 * (each crate's `project_router` mount in `sabnode-api`):
 *
 * - `crm-pos`        → `/v1/sabcrm/commerce/pos/*` (sessions,
 *   transactions, holds, refunds);
 * - `crm-store`      → `/v1/sabcrm/commerce/store/*` (storefronts,
 *   products, pricing-rules, shipping-zones, orders, abandoned-carts);
 * - `crm-coupons`    → `/v1/sabcrm/commerce/coupons`;
 * - `crm-gift-cards` → `/v1/sabcrm/commerce/gift-cards`.
 *
 * Same handlers, same Mongo collections as the legacy `/v1/crm/*`
 * mounts (note: `crm-pos` / `crm-store` have NO legacy mount — the
 * commerce mounts are their only HTTP surface), but every request must
 * carry the active SabCRM `projectId` (query string for
 * GET/PATCH/DELETE and lifecycle POSTs, body for collection POSTs) —
 * the Rust side rejects requests without it. Membership of the project
 * is validated by the gated server actions in
 * `src/app/actions/sabcrm-commerce.actions.ts` BEFORE calling this
 * client; never call it with an unvalidated projectId.
 *
 * Wire shapes are identical to the legacy clients, so document/input
 * types are re-used from `crm-pos.ts` / `crm-store.ts` /
 * `crm-coupons.ts` / `crm-gift-cards.ts` (all camelCase, mirroring the
 * `serde(rename_all = "camelCase")` Rust DTOs). Every list endpoint
 * here is crm-common style: `{ items, page, limit, hasMore }`,
 * 0-indexed pages.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */

import { rustFetch } from './fetcher';
import type {
  CrmPosSessionDoc,
  CrmPosSessionOpenInput,
  CrmPosTransactionDoc,
  CrmPosHoldDoc,
  CrmPosRefundDoc,
  CrmPosLineItem,
  CrmPosPaymentMethod,
  CrmPosPaymentSplit,
  CrmPosPaymentSplitMethod,
  CrmPosRefundedLineItem,
} from './crm-pos';
import type {
  CrmStorefrontDoc,
  CrmStorefrontCreateInput,
  CrmStorefrontUpdateInput,
  CrmStoreOrderDoc,
  CrmStoreShippingZoneDoc,
  CrmStoreShippingZoneCreateInput,
  CrmStoreShippingZoneUpdateInput,
} from './crm-store';
import type {
  CrmCouponDoc,
  CrmCouponCreateInput,
  CrmCouponUpdateInput,
} from './crm-coupons';
import type {
  CrmGiftCardDoc,
  CrmGiftCardCreateInput,
  CrmGiftCardUpdateInput,
} from './crm-gift-cards';

/* ─── Re-exported wire types (same Rust DTOs as the legacy clients) ── */

export type {
  CrmPosSessionDoc,
  CrmPosTransactionDoc,
  CrmPosHoldDoc,
  CrmPosRefundDoc,
  CrmStorefrontDoc,
  CrmStoreOrderDoc,
  CrmStoreShippingZoneDoc,
  CrmCouponDoc,
  CrmGiftCardDoc,
};

/** crm-common-style list envelope shared by every commerce list. */
export interface SabcrmCommerceList<T> {
  items: T[];
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Generic list params accepted by every commerce list endpoint. The
 * wire accepts arbitrary filter keys (`status`, `sessionId`,
 * `paymentStatus`, …) — unknown keys are ignored by the Rust DTOs.
 */
export interface SabcrmCommerceListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  [key: string]: string | number | undefined;
}

/* ─── POS wire inputs (mirror `crm-pos/src/dto.rs`, camelCase) ──────── */

/**
 * `PosLineItemInput` — `total` optional; the handler recomputes line +
 * document totals from `quantity × rate (+ taxRate)` regardless, so
 * callers keep their preview math client-side and never send totals.
 */
export interface SabcrmPosLineItemInput {
  itemId?: string | null;
  name: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  total?: number;
}

/** `CreateTransactionInput` sans `projectId` (the client injects it). */
export interface SabcrmPosTransactionCreateInput {
  sessionId: string;
  customerId?: string;
  lineItems: SabcrmPosLineItemInput[];
  paymentMethod: CrmPosPaymentMethod;
  paymentSplits?: CrmPosPaymentSplit[];
}

/** `RefundTransactionInput` — refund totals are server-computed. */
export interface SabcrmPosTransactionRefundInput {
  reason: string;
  refundedLineItems: CrmPosRefundedLineItem[];
  refundMethod: CrmPosPaymentSplitMethod;
}

/** `RefundTransactionResponse` — the flipped txn + the minted refund. */
export interface SabcrmPosTransactionRefundResponse {
  transaction: CrmPosTransactionDoc;
  refund: CrmPosRefundDoc;
}

/** `CreateHoldInput` sans `projectId`. */
export interface SabcrmPosHoldCreateInput {
  sessionId: string;
  customerId?: string;
  lineItems: SabcrmPosLineItemInput[];
  holdReason?: string;
}

/**
 * `RecallHoldInput` — the Rust recall ONLY flips `held → recalled`
 * (+ links the minted transaction); payment happens via
 * `transactions.create` first (see the rollout spec §5.2 — the legacy
 * one-shot recall semantic is composed in the server action).
 */
export interface SabcrmPosHoldRecallInput {
  recalledTransactionId?: string;
}

/** `RecallHoldResponse {hold, lineItems}`. */
export interface SabcrmPosHoldRecallResponse {
  hold: CrmPosHoldDoc;
  lineItems: CrmPosLineItem[];
}

/** `UpdateRefundInput` — free-form on the wire; UI vocab guards it. */
export interface SabcrmPosRefundUpdateInput {
  status?: string;
  reason?: string;
}

const POS = '/v1/sabcrm/commerce/pos';
const STORE = '/v1/sabcrm/commerce/store';
const COUPONS = '/v1/sabcrm/commerce/coupons';
const GIFT_CARDS = '/v1/sabcrm/commerce/gift-cards';

/** Encode query params, dropping undefined/null/empty values. */
function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/* ─── POS (`crm-pos` → /v1/sabcrm/commerce/pos) ─────────────────────── */

export const sabcrmCommercePosApi = {
  sessions: {
    list: (projectId: string, params?: SabcrmCommerceListParams) =>
      rustFetch<SabcrmCommerceList<CrmPosSessionDoc>>(
        `${POS}/sessions${qs({ ...params, projectId })}`,
      ),
    getById: (projectId: string, id: string) =>
      rustFetch<CrmPosSessionDoc>(
        `${POS}/sessions/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    open: (projectId: string, input: CrmPosSessionOpenInput) =>
      rustFetch<{ id: string; entity: CrmPosSessionDoc }>(`${POS}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ ...input, projectId }),
      }),
    close: (projectId: string, id: string, closingCash: number) =>
      rustFetch<CrmPosSessionDoc>(
        `${POS}/sessions/${encodeURIComponent(id)}/close${qs({ projectId })}`,
        { method: 'POST', body: JSON.stringify({ closingCash }) },
      ),
    reconcile: (projectId: string, id: string) =>
      rustFetch<CrmPosSessionDoc>(
        `${POS}/sessions/${encodeURIComponent(id)}/reconcile${qs({ projectId })}`,
        { method: 'POST', body: JSON.stringify({}) },
      ),
    archive: (projectId: string, id: string) =>
      rustFetch<{ deleted: boolean }>(
        `${POS}/sessions/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'DELETE' },
      ),
  },
  transactions: {
    list: (projectId: string, params?: SabcrmCommerceListParams) =>
      rustFetch<SabcrmCommerceList<CrmPosTransactionDoc>>(
        `${POS}/transactions${qs({ ...params, projectId })}`,
      ),
    getById: (projectId: string, id: string) =>
      rustFetch<CrmPosTransactionDoc>(
        `${POS}/transactions/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    /** Checkout — totals are computed server-side from `lineItems`. */
    create: (projectId: string, input: SabcrmPosTransactionCreateInput) =>
      rustFetch<{ id: string; entity: CrmPosTransactionDoc }>(
        `${POS}/transactions`,
        { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
      ),
    void: (projectId: string, id: string, reason?: string) =>
      rustFetch<CrmPosTransactionDoc>(
        `${POS}/transactions/${encodeURIComponent(id)}/void${qs({ projectId })}`,
        { method: 'POST', body: JSON.stringify({ reason }) },
      ),
    /** Mints a refund + flips the txn to `refunded` in one call. */
    refund: (
      projectId: string,
      id: string,
      input: SabcrmPosTransactionRefundInput,
    ) =>
      rustFetch<SabcrmPosTransactionRefundResponse>(
        `${POS}/transactions/${encodeURIComponent(id)}/refund${qs({ projectId })}`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
    /** All refunds minted against one transaction (detail rail). */
    listRefunds: (projectId: string, id: string) =>
      rustFetch<SabcrmCommerceList<CrmPosRefundDoc>>(
        `${POS}/transactions/${encodeURIComponent(id)}/refunds${qs({ projectId })}`,
      ),
  },
  holds: {
    list: (projectId: string, params?: SabcrmCommerceListParams) =>
      rustFetch<SabcrmCommerceList<CrmPosHoldDoc>>(
        `${POS}/holds${qs({ ...params, projectId })}`,
      ),
    getById: (projectId: string, id: string) =>
      rustFetch<CrmPosHoldDoc>(
        `${POS}/holds/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    create: (projectId: string, input: SabcrmPosHoldCreateInput) =>
      rustFetch<{ id: string; entity: CrmPosHoldDoc }>(`${POS}/holds`, {
        method: 'POST',
        body: JSON.stringify({ ...input, projectId }),
      }),
    /**
     * Flips `held → recalled` (+ optional transaction link). Does NOT
     * take payment — compose with `transactions.create` (spec §5.2).
     */
    recall: (projectId: string, id: string, input?: SabcrmPosHoldRecallInput) =>
      rustFetch<SabcrmPosHoldRecallResponse>(
        `${POS}/holds/${encodeURIComponent(id)}/recall${qs({ projectId })}`,
        { method: 'POST', body: JSON.stringify(input ?? {}) },
      ),
    void: (projectId: string, id: string) =>
      rustFetch<{ deleted: boolean }>(
        `${POS}/holds/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'DELETE' },
      ),
  },
  refunds: {
    list: (projectId: string, params?: SabcrmCommerceListParams) =>
      rustFetch<SabcrmCommerceList<CrmPosRefundDoc>>(
        `${POS}/refunds${qs({ ...params, projectId })}`,
      ),
    getById: (projectId: string, id: string) =>
      rustFetch<CrmPosRefundDoc>(
        `${POS}/refunds/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    update: (projectId: string, id: string, patch: SabcrmPosRefundUpdateInput) =>
      rustFetch<CrmPosRefundDoc>(
        `${POS}/refunds/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    archive: (projectId: string, id: string) =>
      rustFetch<{ deleted: boolean }>(
        `${POS}/refunds/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'DELETE' },
      ),
  },
};

/* ─── Store (`crm-store` → /v1/sabcrm/commerce/store) ───────────────── */

export const sabcrmCommerceStoreApi = {
  storefronts: {
    list: (projectId: string, params?: SabcrmCommerceListParams) =>
      rustFetch<SabcrmCommerceList<CrmStorefrontDoc>>(
        `${STORE}/storefronts${qs({ ...params, projectId })}`,
      ),
    create: (projectId: string, input: CrmStorefrontCreateInput) =>
      rustFetch<{ id: string; entity: CrmStorefrontDoc }>(
        `${STORE}/storefronts`,
        { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
      ),
    update: (projectId: string, id: string, patch: CrmStorefrontUpdateInput) =>
      rustFetch<CrmStorefrontDoc>(
        `${STORE}/storefronts/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    archive: (projectId: string, id: string) =>
      rustFetch<{ deleted: boolean }>(
        `${STORE}/storefronts/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'DELETE' },
      ),
  },
  orders: {
    list: (projectId: string, params?: SabcrmCommerceListParams) =>
      rustFetch<SabcrmCommerceList<CrmStoreOrderDoc>>(
        `${STORE}/orders${qs({ ...params, projectId })}`,
      ),
    getById: (projectId: string, id: string) =>
      rustFetch<CrmStoreOrderDoc>(
        `${STORE}/orders/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    markPaid: (projectId: string, id: string, paymentRef?: string) =>
      rustFetch<CrmStoreOrderDoc>(
        `${STORE}/orders/${encodeURIComponent(id)}/mark-paid${qs({ projectId })}`,
        { method: 'POST', body: JSON.stringify({ paymentRef }) },
      ),
    markFulfilled: (
      projectId: string,
      id: string,
      status?: 'fulfilled' | 'partial',
    ) =>
      rustFetch<CrmStoreOrderDoc>(
        `${STORE}/orders/${encodeURIComponent(id)}/mark-fulfilled${qs({ projectId })}`,
        { method: 'POST', body: JSON.stringify({ status }) },
      ),
    /** Archives by flipping fulfillment to "cancelled" (never hard-deletes). */
    cancel: (projectId: string, id: string) =>
      rustFetch<{ deleted: boolean }>(
        `${STORE}/orders/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'DELETE' },
      ),
  },
  shippingZones: {
    list: (projectId: string, params?: SabcrmCommerceListParams) =>
      rustFetch<SabcrmCommerceList<CrmStoreShippingZoneDoc>>(
        `${STORE}/shipping-zones${qs({ ...params, projectId })}`,
      ),
    create: (projectId: string, input: CrmStoreShippingZoneCreateInput) =>
      rustFetch<{ id: string; entity: CrmStoreShippingZoneDoc }>(
        `${STORE}/shipping-zones`,
        { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
      ),
    update: (
      projectId: string,
      id: string,
      patch: CrmStoreShippingZoneUpdateInput,
    ) =>
      rustFetch<CrmStoreShippingZoneDoc>(
        `${STORE}/shipping-zones/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    archive: (projectId: string, id: string) =>
      rustFetch<{ deleted: boolean }>(
        `${STORE}/shipping-zones/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'DELETE' },
      ),
  },
};

/* ─── Coupons (`crm-coupons` → /v1/sabcrm/commerce/coupons) ─────────── */

export const sabcrmCommerceCouponsApi = {
  list: (projectId: string, params?: SabcrmCommerceListParams) =>
    rustFetch<SabcrmCommerceList<CrmCouponDoc>>(
      `${COUPONS}${qs({ ...params, projectId })}`,
    ),
  create: (projectId: string, input: CrmCouponCreateInput) =>
    rustFetch<{ id: string; entity: CrmCouponDoc }>(COUPONS, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (projectId: string, id: string, patch: CrmCouponUpdateInput) =>
    rustFetch<CrmCouponDoc>(
      `${COUPONS}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  archive: (projectId: string, id: string) =>
    rustFetch<{ deleted: boolean }>(
      `${COUPONS}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Gift cards (`crm-gift-cards` → /v1/sabcrm/commerce/gift-cards) ── */

export const sabcrmCommerceGiftCardsApi = {
  list: (projectId: string, params?: SabcrmCommerceListParams) =>
    rustFetch<SabcrmCommerceList<CrmGiftCardDoc>>(
      `${GIFT_CARDS}${qs({ ...params, projectId })}`,
    ),
  create: (projectId: string, input: CrmGiftCardCreateInput) =>
    rustFetch<{ id: string; entity: CrmGiftCardDoc }>(GIFT_CARDS, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (projectId: string, id: string, patch: CrmGiftCardUpdateInput) =>
    rustFetch<CrmGiftCardDoc>(
      `${GIFT_CARDS}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  archive: (projectId: string, id: string) =>
    rustFetch<{ deleted: boolean }>(
      `${GIFT_CARDS}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};
