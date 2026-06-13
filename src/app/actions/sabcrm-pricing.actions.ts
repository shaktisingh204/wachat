'use server';

/**
 * SabCRM — CPQ pricing server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/pricing.server`. The `gate` / `fail`
 * helpers are the verbatim pattern from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * Gating:
 *   - reads  (`computeQuotePricingTw`, `listPriceBooksTw`, `listDiscountApprovalsTw`)
 *     → `view`;
 *   - writes / config (`savePriceBookTw`, `deletePriceBookTw`,
 *     `requestDiscountApprovalTw`, `decideDiscountApprovalTw`) → `edit`
 *     (NO `manage` action exists, so config gates on `edit`).
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listPriceBooks,
  upsertPriceBook,
  deletePriceBook,
  computeQuotePricing,
  requestDiscountApproval,
  decideDiscountApproval,
  listDiscountApprovals,
  type PriceBook,
  type PriceBookInput,
  type QuoteForPricing,
  type QuotePricingResult,
  type DiscountApproval,
  type DiscountApprovalDecision,
  type DiscountApprovalStatus,
  type RequestDiscountApprovalInput,
} from '@/lib/sabcrm/pricing.server';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

/** session → project membership → RBAC → plan (mirrors sabcrm-scoring.actions.ts). */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

  if (!(await canServer(MODULE_KEY, action, requested))) {
    return { ok: false, error: 'Permission denied.' };
  }
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }
  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) return { ok: false, error: e.message || fallback };
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/* -------------------------------------------------------------------------- */
/* Price-book CRUD (config — gated `edit`, except the list read on `view`)      */
/* -------------------------------------------------------------------------- */

/** List every price book in the active project. Gated on `view`. */
export async function listPriceBooksTw(
  projectId?: string,
): Promise<ActionResult<PriceBook[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listPriceBooks(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load price books.');
  }
}

/** Create or update a price book. Gated on `edit`. */
export async function savePriceBookTw(
  input: PriceBookInput,
  projectId?: string,
): Promise<ActionResult<PriceBook>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await upsertPriceBook(g.ctx.projectId, input) };
  } catch (e) {
    return fail(e, 'Failed to save price book.');
  }
}

/** Delete a price book by id. Gated on `edit`. */
export async function deletePriceBookTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A price book id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deletePriceBook(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Price book not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete price book.');
  }
}

/* -------------------------------------------------------------------------- */
/* Quote pricing (read — gated `view`)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Price a quote against the project price book and return the waterfall +
 * totals + trace + the discount-approval verdict. Gated on `view` (it is a
 * read/compute, never persists). The quotation form calls this for its live
 * preview AND on submit so client + server can never disagree.
 */
export async function computeQuotePricingTw(
  quote: QuoteForPricing,
  projectId?: string,
): Promise<ActionResult<QuotePricingResult>> {
  if (!quote || !Array.isArray(quote.lines)) {
    return { ok: false, error: 'A quote with line items is required.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await computeQuotePricing(g.ctx.projectId, quote) };
  } catch (e) {
    return fail(e, 'Failed to price quote.');
  }
}

/* -------------------------------------------------------------------------- */
/* Discount-approval flow (gated `edit`; the list read on `view`)               */
/* -------------------------------------------------------------------------- */

/** List discount-approval requests (optionally by status). Gated on `view`. */
export async function listDiscountApprovalsTw(
  status?: DiscountApprovalStatus,
  projectId?: string,
): Promise<ActionResult<DiscountApproval[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await listDiscountApprovals(g.ctx.projectId, status),
    };
  } catch (e) {
    return fail(e, 'Failed to load discount approvals.');
  }
}

/**
 * Raise a discount-approval request for a quote. Re-prices server-side; a
 * request is only persisted when the discount actually breaches the threshold
 * (`request === null` ⇒ the rep may proceed without approval). Gated on `edit`.
 */
export async function requestDiscountApprovalTw(
  input: RequestDiscountApprovalInput,
  projectId?: string,
): Promise<
  ActionResult<{
    approval: DiscountApprovalDecision;
    request: DiscountApproval | null;
  }>
> {
  if (!input?.quote || !Array.isArray(input.quote.lines)) {
    return { ok: false, error: 'A quote with line items is required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await requestDiscountApproval(g.ctx.projectId, g.ctx.userId, input),
    };
  } catch (e) {
    return fail(e, 'Failed to request discount approval.');
  }
}

/** Approve or reject a pending discount request. Gated on `edit`. */
export async function decideDiscountApprovalTw(
  id: string,
  decision: 'approved' | 'rejected',
  note?: string,
  projectId?: string,
): Promise<ActionResult<DiscountApproval>> {
  if (!id) return { ok: false, error: 'A request id is required.' };
  if (decision !== 'approved' && decision !== 'rejected') {
    return { ok: false, error: 'Invalid decision.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const decided = await decideDiscountApproval(
      g.ctx.projectId,
      g.ctx.userId,
      id,
      decision,
      note,
    );
    if (!decided) {
      return { ok: false, error: 'Request not found or already decided.' };
    }
    return { ok: true, data: decided };
  } catch (e) {
    return fail(e, 'Failed to decide discount approval.');
  }
}
