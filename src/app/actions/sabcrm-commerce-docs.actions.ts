'use server';

/**
 * SabCRM Commerce — doc-surface shared plumbing (rollout spec WI-12).
 *
 * The full-surface verbs the kit rollout needs that the back-compat
 * dialog module (`sabcrm-commerce.actions.ts`) never grew:
 *
 *   1. PICKERS — `DocEntityOption[]`-shaped searches for storefronts,
 *      POS sessions (with an open-only variant for the register) and
 *      POS transactions, plus the register's lifted-limit item search.
 *      CUSTOMER pickers are NOT duplicated here — reuse
 *      `searchSabcrmFinanceParties` / `resolveSabcrmFinanceParties` /
 *      `getSabcrmFinancePartyContact` from
 *      `sabcrm-finance-invoices.actions.ts` (records-engine
 *      companies/people — the same party model).
 *   2. GET — sessions / transactions / refunds / holds by id (detail
 *      pages + edit seeds) and per-transaction refund lists.
 *   3. UPDATE — the PATCH verbs the spec flags as missing everywhere:
 *      storefronts, coupons, gift cards, shipping zones, POS refund
 *      status (vocab-guarded — the wire is free-form).
 *   4. REFUND — `refundSabcrmPosTransaction` over the crate's
 *      `POST /transactions/{id}/refund`.
 *
 * The commerce list envelope (`SabcrmCommerceList<T>`) already returns
 * `hasMore` with 0-indexed pages — per-entity paged fetchers call the
 * existing client `list` methods directly (no extra normalizer needed;
 * remember to send `page - 1` for a 1-indexed UI page).
 *
 * Register composition actions (`createSabcrmPosTransaction`,
 * `createSabcrmPosHold`, `recallSabcrmPosHold`) are WI-22 work — the
 * rust-client methods they need (`transactions.create`, `holds.create`,
 * `holds.recall`, …) are already in
 * `src/lib/rust-client/sabcrm-commerce.ts`.
 *
 * Gate pipeline copied verbatim from `sabcrm-commerce.actions.ts`
 * (session → project membership → RBAC → plan), failing closed.
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
  CrmPosSessionDoc,
  CrmPosTransactionDoc,
  CrmPosHoldDoc,
  CrmPosRefundDoc,
  CrmStorefrontDoc,
  CrmStoreShippingZoneDoc,
  CrmCouponDoc,
  CrmGiftCardDoc,
  SabcrmPosTransactionRefundInput,
  SabcrmPosTransactionRefundResponse,
} from '@/lib/rust-client/sabcrm-commerce';
import type { CrmStorefrontUpdateInput } from '@/lib/rust-client/crm-store';
import type { CrmStoreShippingZoneUpdateInput } from '@/lib/rust-client/crm-store';
import type { CrmCouponUpdateInput } from '@/lib/rust-client/crm-coupons';
import type { CrmGiftCardUpdateInput } from '@/lib/rust-client/crm-gift-cards';
import { sabcrmSupplyItemsApi } from '@/lib/rust-client/sabcrm-supply';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmItemOption } from './sabcrm-finance-invoices.actions.types';
import { SABCRM_POS_REFUND_TRANSITIONS } from './sabcrm-commerce-docs.actions.types';
import type { SabcrmPosRefundUiStatus } from './sabcrm-commerce-docs.actions.types';

// ---------------------------------------------------------------------------
// Constants + gate (mirrors sabcrm-commerce.actions.ts verbatim)
// ---------------------------------------------------------------------------

const MODULE_KEY = 'sabcrm';
const COMMERCE_BASE = '/sabcrm/commerce';

/** Picker page size (rollout spec convention). */
const PICKER_LIMIT = 10;

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

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

/** `YYYY-MM-DD` display key from an ISO instant ('' when absent). */
function dayKey(iso: string | undefined | null): string {
  return (iso ?? '').slice(0, 10);
}

/** Compact INR-style money for picker metas. */
function fmtMoney(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// 1. Pickers (DocEntityOption shaped)
// ---------------------------------------------------------------------------

/**
 * Storefront picker (orders/shipping `partyFilter`, shipping-zone
 * forms). `label = name`, `meta = slug`.
 */
export async function searchSabcrmStorefronts(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommerceStoreApi.storefronts.list(
      g.ctx.projectId,
      // crm-common pagination is 0-indexed — omit `page` for page one.
      { q: q.trim() || undefined, limit: PICKER_LIMIT },
    );
    return {
      ok: true,
      data: res.items
        .filter((s) => s._id)
        .map((s) => ({
          id: String(s._id),
          label: s.name || 'Unnamed storefront',
          meta: s.slug || undefined,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search storefronts.');
  }
}

/**
 * POS-session picker. `label = "terminalId · openedAt"`, `meta =
 * status`. Pass `opts.openOnly` for the register's session select.
 */
export async function searchSabcrmPosSessions(
  q: string,
  opts?: { openOnly?: boolean },
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommercePosApi.sessions.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: PICKER_LIMIT,
      status: opts?.openOnly ? 'open' : undefined,
    });
    return {
      ok: true,
      data: res.items
        .filter((s) => s._id)
        .map((s) => ({
          id: String(s._id),
          label: [s.terminalId, dayKey(s.openedAt)]
            .filter(Boolean)
            .join(' · '),
          meta: s.status,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search POS sessions.');
  }
}

/**
 * POS-transaction picker (refund/hold references).
 * `label = transactionNumber`, `meta = "date · total"`.
 */
export async function searchSabcrmPosTransactions(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommercePosApi.transactions.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: PICKER_LIMIT,
    });
    return {
      ok: true,
      data: res.items
        .filter((t) => t._id)
        .map((t) => ({
          id: String(t._id),
          label: t.transactionNumber || 'Unnumbered transaction',
          meta: [dayKey(t.createdAt), fmtMoney(t.total)]
            .filter(Boolean)
            .join(' · '),
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search POS transactions.');
  }
}

/**
 * Register item search (spec §5.2 — `searchSabcrmFinanceItems` with the
 * limit lifted to 50 for the register's grid + barcode search). Same
 * supply catalog, same `SabcrmItemOption` shape.
 */
export async function searchSabcrmRegisterItems(
  q: string,
  limit = 50,
  projectId?: string,
): Promise<ActionResult<SabcrmItemOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const items = await sabcrmSupplyItemsApi.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: Math.min(Math.max(Math.floor(limit) || 50, 1), 100),
    });
    return {
      ok: true,
      data: items
        .filter((it) => it._id)
        .map((it) => ({
          id: String(it._id),
          name: it.name,
          sku: it.sku || undefined,
          description: it.description || undefined,
          sellingPrice: Number.isFinite(it.sellingPrice) ? it.sellingPrice : 0,
          taxRate: it.taxRate,
          hsnSac: it.hsnSac,
          currency: it.currency,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search items.');
  }
}

// ---------------------------------------------------------------------------
// 2. Get (detail pages + edit seeds)
// ---------------------------------------------------------------------------

/** Loads one POS session (WI-18 detail). */
export async function getSabcrmPosSession(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmPosSessionDoc>> {
  if (!id) return { ok: false, error: 'Session id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommercePosApi.sessions.getById(
      g.ctx.projectId,
      id,
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the POS session.');
  }
}

/** Loads one POS transaction (WI-19 detail). */
export async function getSabcrmPosTransaction(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmPosTransactionDoc>> {
  if (!id) return { ok: false, error: 'Transaction id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommercePosApi.transactions.getById(
      g.ctx.projectId,
      id,
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the POS transaction.');
  }
}

/** Loads one POS refund (WI-20 detail). */
export async function getSabcrmPosRefund(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmPosRefundDoc>> {
  if (!id) return { ok: false, error: 'Refund id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommercePosApi.refunds.getById(g.ctx.projectId, id);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the POS refund.');
  }
}

/** Loads one POS hold (WI-21 row expand + register `?holdId` prefill). */
export async function getSabcrmPosHold(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmPosHoldDoc>> {
  if (!id) return { ok: false, error: 'Hold id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommercePosApi.holds.getById(g.ctx.projectId, id);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the POS hold.');
  }
}

/** All refunds minted against one transaction (WI-19 detail rail). */
export async function listSabcrmPosTransactionRefunds(
  transactionId: string,
  projectId?: string,
): Promise<ActionResult<CrmPosRefundDoc[]>> {
  if (!transactionId) {
    return { ok: false, error: 'Transaction id is required.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.transactions.listRefunds(
      g.ctx.projectId,
      transactionId,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to load the transaction refunds.');
  }
}

// ---------------------------------------------------------------------------
// 3. Update (the PATCH verbs the spec flags as missing)
// ---------------------------------------------------------------------------

/** Patches a storefront with the full `CrmStorefrontUpdateInput` (WI-14). */
export async function updateSabcrmStorefront(
  id: string,
  patch: CrmStorefrontUpdateInput,
  projectId?: string,
): Promise<ActionResult<CrmStorefrontDoc>> {
  if (!id) return { ok: false, error: 'Storefront id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommerceStoreApi.storefronts.update(
      g.ctx.projectId,
      id,
      patch,
    );
    revalidatePath(`${COMMERCE_BASE}/storefronts`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the storefront.');
  }
}

/** Patches a coupon with the full `CrmCouponUpdateInput` (WI-15). */
export async function updateSabcrmCoupon(
  id: string,
  patch: CrmCouponUpdateInput,
  projectId?: string,
): Promise<ActionResult<CrmCouponDoc>> {
  if (!id) return { ok: false, error: 'Coupon id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommerceCouponsApi.update(
      g.ctx.projectId,
      id,
      patch,
    );
    revalidatePath(`${COMMERCE_BASE}/coupons`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the coupon.');
  }
}

/** Patches a gift card (incl. balance adjustments — WI-16). */
export async function updateSabcrmGiftCard(
  id: string,
  patch: CrmGiftCardUpdateInput,
  projectId?: string,
): Promise<ActionResult<CrmGiftCardDoc>> {
  if (!id) return { ok: false, error: 'Gift card id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommerceGiftCardsApi.update(
      g.ctx.projectId,
      id,
      patch,
    );
    revalidatePath(`${COMMERCE_BASE}/gift-cards`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the gift card.');
  }
}

/** Patches a shipping zone (full methods grid — WI-17). */
export async function updateSabcrmShippingZone(
  id: string,
  patch: CrmStoreShippingZoneUpdateInput,
  projectId?: string,
): Promise<ActionResult<CrmStoreShippingZoneDoc>> {
  if (!id) return { ok: false, error: 'Shipping zone id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmCommerceStoreApi.shippingZones.update(
      g.ctx.projectId,
      id,
      patch,
    );
    revalidatePath(`${COMMERCE_BASE}/shipping`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the shipping zone.');
  }
}

// ---------------------------------------------------------------------------
// 4. POS refunds (mint + status)
// ---------------------------------------------------------------------------

/**
 * Refunds (part of) a POS transaction (WI-19 line-pick dialog).
 * Mints a refund document and flips the source transaction to
 * `refunded` in one crate call; refund totals are server-computed.
 */
export async function refundSabcrmPosTransaction(
  id: string,
  input: SabcrmPosTransactionRefundInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPosTransactionRefundResponse>> {
  if (!id) return { ok: false, error: 'Transaction id is required.' };
  if (!input?.reason?.trim()) {
    return { ok: false, error: 'A refund reason is required.' };
  }
  if (!input.refundedLineItems?.length) {
    return { ok: false, error: 'Pick at least one line to refund.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.transactions.refund(
      g.ctx.projectId,
      id,
      { ...input, reason: input.reason.trim() },
    );
    revalidatePath(`${COMMERCE_BASE}/pos-transactions`);
    revalidatePath(`${COMMERCE_BASE}/pos-refunds`);
    return { ok: true, data: res };
  } catch (e) {
    return fail(e, 'Failed to refund the transaction.');
  }
}

/**
 * Moves a POS refund along its workflow (WI-20). The crate's
 * `UpdateRefundInput.status` is free-form —
 * `SABCRM_POS_REFUND_TRANSITIONS` is the only guard.
 */
export async function updateSabcrmPosRefundStatus(
  id: string,
  next: SabcrmPosRefundUiStatus,
  reason?: string,
  projectId?: string,
): Promise<ActionResult<CrmPosRefundDoc>> {
  if (!id) return { ok: false, error: 'Refund id is required.' };
  if (!(next in SABCRM_POS_REFUND_TRANSITIONS)) {
    return { ok: false, error: 'Invalid refund status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const current = await sabcrmCommercePosApi.refunds.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'pending') as SabcrmPosRefundUiStatus;
    if (!SABCRM_POS_REFUND_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a refund from "${from}" to "${next}".`,
      };
    }
    const doc = await sabcrmCommercePosApi.refunds.update(g.ctx.projectId, id, {
      status: next,
      reason: reason?.trim() || undefined,
    });
    revalidatePath(`${COMMERCE_BASE}/pos-refunds`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the refund status.');
  }
}
