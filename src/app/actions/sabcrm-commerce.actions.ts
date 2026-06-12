'use server';

/**
 * SabCRM Commerce — POS + online-store server actions.
 *
 * Thin, gated wrappers over the project-scoped re-mounts of the legacy
 * CRM commerce Rust crates (`/v1/sabcrm/commerce/*`, clients in
 * `@/lib/rust-client/sabcrm-commerce`): POS sessions / transactions /
 * holds / refunds (`crm-pos`), storefronts / orders / shipping zones
 * (`crm-store`), coupons (`crm-coupons`), and gift cards
 * (`crm-gift-cards`). Same crates, same Mongo collections, but
 * tenant-scoped by `projectId` instead of `userId`.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-finance.actions.ts` / `sabcrm-supply.actions.ts` (gate recipe
 * verbatim):
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown
 * value is normalised into `{ ok: false, error }` so the UI degrades
 * gracefully.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmCommercePosApi,
  sabcrmCommerceStoreApi,
  sabcrmCommerceCouponsApi,
  sabcrmCommerceGiftCardsApi,
} from '@/lib/rust-client/sabcrm-commerce';
import type {
  SabcrmCommerceListParams,
  CrmPosSessionDoc,
  CrmPosTransactionDoc,
  CrmPosHoldDoc,
  CrmPosRefundDoc,
  CrmStorefrontDoc,
  CrmStoreOrderDoc,
  CrmStoreShippingZoneDoc,
  CrmCouponDoc,
  CrmGiftCardDoc,
} from '@/lib/rust-client/sabcrm-commerce';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmCommercePosSessionFormInput,
  SabcrmCommerceStorefrontFormInput,
  SabcrmCommerceCouponFormInput,
  SabcrmCommerceGiftCardFormInput,
  SabcrmCommerceShippingZoneFormInput,
} from './sabcrm-commerce.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the Commerce UI re-fetches. */
const COMMERCE_BASE = '/sabcrm/commerce';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-finance.actions.ts` verbatim, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user.
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** Coerce a `YYYY-MM-DD` / ISO date string into a full RFC3339 instant. */
function toIso(raw: string): string | undefined {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Coerce a dialog string/number into a finite number (or fallback). */
function num(raw: string | number | undefined, fallback = 0): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// POS sessions (`crm-pos` → /v1/sabcrm/commerce/pos/sessions)
// ---------------------------------------------------------------------------

/** Lists the project's POS register sessions. */
export async function listSabcrmPosSessions(
  params?: SabcrmCommerceListParams,
  projectId?: string,
): Promise<ActionResult<CrmPosSessionDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.sessions.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list POS sessions.');
  }
}

/** Opens a POS register session from the "Open session" dialog payload. */
export async function openSabcrmPosSession(
  input: SabcrmCommercePosSessionFormInput,
  projectId?: string,
): Promise<ActionResult<CrmPosSessionDoc>> {
  if (!input?.terminalId?.trim()) {
    return { ok: false, error: 'A terminal id is required.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmCommercePosApi.sessions.open(g.ctx.projectId, {
      terminalId: input.terminalId.trim(),
      openingCash: num(input.openingCash),
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath(`${COMMERCE_BASE}/pos-sessions`);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to open POS session.');
  }
}

/** Closes an open POS session, recording the counted closing cash. */
export async function closeSabcrmPosSession(
  id: string,
  closingCash: number,
  projectId?: string,
): Promise<ActionResult<CrmPosSessionDoc>> {
  if (!id) return { ok: false, error: 'Session id is required.' };
  if (!Number.isFinite(closingCash)) {
    return { ok: false, error: 'Closing cash must be a number.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommercePosApi.sessions.close(
      g.ctx.projectId,
      id,
      closingCash,
    );
    revalidatePath(`${COMMERCE_BASE}/pos-sessions`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to close POS session.');
  }
}

/** Reconciles a closed POS session (cash count signed off). */
export async function reconcileSabcrmPosSession(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmPosSessionDoc>> {
  if (!id) return { ok: false, error: 'Session id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommercePosApi.sessions.reconcile(
      g.ctx.projectId,
      id,
    );
    revalidatePath(`${COMMERCE_BASE}/pos-sessions`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to reconcile POS session.');
  }
}

/** Archives a POS session (soft delete — history preserved). */
export async function archiveSabcrmPosSession(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Session id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.sessions.archive(
      g.ctx.projectId,
      id,
    );
    revalidatePath(`${COMMERCE_BASE}/pos-sessions`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to archive POS session.');
  }
}

// ---------------------------------------------------------------------------
// POS transactions (`crm-pos` → /v1/sabcrm/commerce/pos/transactions)
// ---------------------------------------------------------------------------

/** Lists the project's POS sales transactions. */
export async function listSabcrmPosTransactions(
  params?: SabcrmCommerceListParams,
  projectId?: string,
): Promise<ActionResult<CrmPosTransactionDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.transactions.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list POS transactions.');
  }
}

/** Voids a completed POS transaction. */
export async function voidSabcrmPosTransaction(
  id: string,
  reason?: string,
  projectId?: string,
): Promise<ActionResult<CrmPosTransactionDoc>> {
  if (!id) return { ok: false, error: 'Transaction id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommercePosApi.transactions.void(
      g.ctx.projectId,
      id,
      reason?.trim() || undefined,
    );
    revalidatePath(`${COMMERCE_BASE}/pos-transactions`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to void POS transaction.');
  }
}

// ---------------------------------------------------------------------------
// POS holds (`crm-pos` → /v1/sabcrm/commerce/pos/holds)
// ---------------------------------------------------------------------------

/** Lists the project's parked (held) POS tickets. */
export async function listSabcrmPosHolds(
  params?: SabcrmCommerceListParams,
  projectId?: string,
): Promise<ActionResult<CrmPosHoldDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.holds.list(g.ctx.projectId, params);
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list POS holds.');
  }
}

/** Voids a held POS ticket (soft delete). */
export async function voidSabcrmPosHold(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Hold id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.holds.void(g.ctx.projectId, id);
    revalidatePath(`${COMMERCE_BASE}/pos-holds`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to void POS hold.');
  }
}

// ---------------------------------------------------------------------------
// POS refunds (`crm-pos` → /v1/sabcrm/commerce/pos/refunds)
// ---------------------------------------------------------------------------

/** Lists the project's POS refunds. */
export async function listSabcrmPosRefunds(
  params?: SabcrmCommerceListParams,
  projectId?: string,
): Promise<ActionResult<CrmPosRefundDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.refunds.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list POS refunds.');
  }
}

/** Archives a POS refund record (soft delete). */
export async function archiveSabcrmPosRefund(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Refund id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.refunds.archive(
      g.ctx.projectId,
      id,
    );
    revalidatePath(`${COMMERCE_BASE}/pos-refunds`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to archive POS refund.');
  }
}

// ---------------------------------------------------------------------------
// Storefronts (`crm-store` → /v1/sabcrm/commerce/store/storefronts)
// ---------------------------------------------------------------------------

/** Lists the project's storefronts. */
export async function listSabcrmStorefronts(
  params?: SabcrmCommerceListParams,
  projectId?: string,
): Promise<ActionResult<CrmStorefrontDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceStoreApi.storefronts.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list storefronts.');
  }
}

/** Creates a storefront from the "New storefront" dialog payload. */
export async function createSabcrmStorefront(
  input: SabcrmCommerceStorefrontFormInput,
  projectId?: string,
): Promise<ActionResult<CrmStorefrontDoc>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  if (!input?.slug?.trim()) return { ok: false, error: 'A slug is required.' };
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmCommerceStoreApi.storefronts.create(
      g.ctx.projectId,
      {
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        currency: input.currency?.trim()
          ? input.currency.trim().toUpperCase()
          : 'INR',
        domain: input.domain?.trim() || undefined,
      },
    );
    revalidatePath(`${COMMERCE_BASE}/storefronts`);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create storefront.');
  }
}

/** Publishes a draft storefront (status → "published"). */
export async function publishSabcrmStorefront(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmStorefrontDoc>> {
  if (!id) return { ok: false, error: 'Storefront id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommerceStoreApi.storefronts.update(
      g.ctx.projectId,
      id,
      { status: 'published' },
    );
    revalidatePath(`${COMMERCE_BASE}/storefronts`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to publish storefront.');
  }
}

/** Archives a storefront (soft delete). */
export async function archiveSabcrmStorefront(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Storefront id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceStoreApi.storefronts.archive(
      g.ctx.projectId,
      id,
    );
    revalidatePath(`${COMMERCE_BASE}/storefronts`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to archive storefront.');
  }
}

// ---------------------------------------------------------------------------
// Orders (`crm-store` → /v1/sabcrm/commerce/store/orders)
// ---------------------------------------------------------------------------

/** Lists the project's online-store orders. */
export async function listSabcrmStoreOrders(
  params?: SabcrmCommerceListParams,
  projectId?: string,
): Promise<ActionResult<CrmStoreOrderDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceStoreApi.orders.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list orders.');
  }
}

/** Fetches one order (detail page). */
export async function getSabcrmStoreOrder(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmStoreOrderDoc>> {
  if (!id) return { ok: false, error: 'Order id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommerceStoreApi.orders.getById(
      g.ctx.projectId,
      id,
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load order.');
  }
}

/** Marks an order paid (optionally recording a payment reference). */
export async function markSabcrmStoreOrderPaid(
  id: string,
  paymentRef?: string,
  projectId?: string,
): Promise<ActionResult<CrmStoreOrderDoc>> {
  if (!id) return { ok: false, error: 'Order id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommerceStoreApi.orders.markPaid(
      g.ctx.projectId,
      id,
      paymentRef?.trim() || undefined,
    );
    revalidatePath(`${COMMERCE_BASE}/orders`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to mark order paid.');
  }
}

/** Marks an order fulfilled (or partially fulfilled). */
export async function markSabcrmStoreOrderFulfilled(
  id: string,
  status?: 'fulfilled' | 'partial',
  projectId?: string,
): Promise<ActionResult<CrmStoreOrderDoc>> {
  if (!id) return { ok: false, error: 'Order id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommerceStoreApi.orders.markFulfilled(
      g.ctx.projectId,
      id,
      status,
    );
    revalidatePath(`${COMMERCE_BASE}/orders`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to mark order fulfilled.');
  }
}

/** Cancels an order (fulfillment → "cancelled"; orders never hard-delete). */
export async function cancelSabcrmStoreOrder(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Order id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceStoreApi.orders.cancel(
      g.ctx.projectId,
      id,
    );
    revalidatePath(`${COMMERCE_BASE}/orders`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to cancel order.');
  }
}

// ---------------------------------------------------------------------------
// Shipping zones (`crm-store` → /v1/sabcrm/commerce/store/shipping-zones)
// ---------------------------------------------------------------------------

/** Lists the project's shipping zones. */
export async function listSabcrmShippingZones(
  params?: SabcrmCommerceListParams,
  projectId?: string,
): Promise<ActionResult<CrmStoreShippingZoneDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceStoreApi.shippingZones.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list shipping zones.');
  }
}

/** Creates a shipping zone with one starter method from the dialog payload. */
export async function createSabcrmShippingZone(
  input: SabcrmCommerceShippingZoneFormInput,
  projectId?: string,
): Promise<ActionResult<CrmStoreShippingZoneDoc>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  if (!input?.storefrontId?.trim()) {
    return { ok: false, error: 'A storefront is required.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  const kind = input.methodKind?.trim() || 'flat';
  if (!['flat', 'weight_based', 'free_above'].includes(kind)) {
    return { ok: false, error: 'Invalid shipping method kind.' };
  }
  const countries = (input.countries ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  try {
    const created = await sabcrmCommerceStoreApi.shippingZones.create(
      g.ctx.projectId,
      {
        storefrontId: input.storefrontId.trim(),
        name: input.name.trim(),
        countries,
        methods: [
          {
            name: 'Standard',
            kind: kind as 'flat' | 'weight_based' | 'free_above',
            rate: num(input.methodRate),
            freeAboveSubtotal:
              kind === 'free_above' ? num(input.methodRate) : undefined,
          },
        ],
      },
    );
    revalidatePath(`${COMMERCE_BASE}/shipping`);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create shipping zone.');
  }
}

/** Archives a shipping zone (soft delete). */
export async function archiveSabcrmShippingZone(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Shipping zone id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceStoreApi.shippingZones.archive(
      g.ctx.projectId,
      id,
    );
    revalidatePath(`${COMMERCE_BASE}/shipping`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to archive shipping zone.');
  }
}

// ---------------------------------------------------------------------------
// Coupons (`crm-coupons` → /v1/sabcrm/commerce/coupons)
// ---------------------------------------------------------------------------

/** Lists the project's coupons. */
export async function listSabcrmCoupons(
  params?: SabcrmCommerceListParams,
  projectId?: string,
): Promise<ActionResult<CrmCouponDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceCouponsApi.list(g.ctx.projectId, params);
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list coupons.');
  }
}

/** Creates a coupon from the "New coupon" dialog payload. */
export async function createSabcrmCoupon(
  input: SabcrmCommerceCouponFormInput,
  projectId?: string,
): Promise<ActionResult<CrmCouponDoc>> {
  if (!input?.code?.trim()) return { ok: false, error: 'A code is required.' };
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmCommerceCouponsApi.create(g.ctx.projectId, {
      code: input.code.trim(),
      type: input.type === 'fixed' ? 'fixed' : 'percent',
      value: num(input.value),
      minCart: input.minCart !== undefined ? num(input.minCart) : undefined,
      maxUses:
        input.maxUses !== undefined && String(input.maxUses).trim() !== ''
          ? Math.trunc(num(input.maxUses))
          : undefined,
      validTo: input.validTo ? toIso(input.validTo) : undefined,
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath(`${COMMERCE_BASE}/coupons`);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create coupon.');
  }
}

/** Activates a draft coupon (status → "active"). */
export async function activateSabcrmCoupon(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmCouponDoc>> {
  if (!id) return { ok: false, error: 'Coupon id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommerceCouponsApi.update(g.ctx.projectId, id, {
      status: 'active',
    });
    revalidatePath(`${COMMERCE_BASE}/coupons`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to activate coupon.');
  }
}

/** Archives a coupon (soft delete). */
export async function archiveSabcrmCoupon(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Coupon id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceCouponsApi.archive(g.ctx.projectId, id);
    revalidatePath(`${COMMERCE_BASE}/coupons`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to archive coupon.');
  }
}

// ---------------------------------------------------------------------------
// Gift cards (`crm-gift-cards` → /v1/sabcrm/commerce/gift-cards)
// ---------------------------------------------------------------------------

/** Lists the project's gift cards. */
export async function listSabcrmGiftCards(
  params?: SabcrmCommerceListParams,
  projectId?: string,
): Promise<ActionResult<CrmGiftCardDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceGiftCardsApi.list(g.ctx.projectId, params);
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list gift cards.');
  }
}

/** Issues a gift card from the "New gift card" dialog payload. */
export async function createSabcrmGiftCard(
  input: SabcrmCommerceGiftCardFormInput,
  projectId?: string,
): Promise<ActionResult<CrmGiftCardDoc>> {
  const value = num(input?.value);
  if (!(value > 0)) {
    return { ok: false, error: 'Value must be greater than zero.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmCommerceGiftCardsApi.create(g.ctx.projectId, {
      code: input.code?.trim() || undefined,
      value,
      issuedTo: input.issuedTo?.trim() || undefined,
      issuedToEmail: input.issuedToEmail?.trim() || undefined,
      expiryDate: input.expiryDate ? toIso(input.expiryDate) : undefined,
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath(`${COMMERCE_BASE}/gift-cards`);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create gift card.');
  }
}

/** Archives a gift card (soft delete). */
export async function archiveSabcrmGiftCard(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Gift card id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommerceGiftCardsApi.archive(g.ctx.projectId, id);
    revalidatePath(`${COMMERCE_BASE}/gift-cards`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to archive gift card.');
  }
}
