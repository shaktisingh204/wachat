'use server';

/**
 * SabCRM Commerce — POS register actions (spec WI-22 §5.2).
 *
 * The three gated, project-scoped checkout verbs the re-homed register
 * (`/sabcrm/commerce/register`) needs — the legacy
 * `crm-pos.actions.ts` equivalents were Mongo-direct + `userId`-scoped
 * and could not be reused:
 *
 *   - `createSabcrmPosTransaction` — checkout; totals are server-
 *     computed from `lineItems` (the client never sends them);
 *   - `createSabcrmPosHold` — park the cart for later recall;
 *   - `recallSabcrmPosHold` — COMPOSED + non-atomic: the Rust recall
 *     only flips `held → recalled`, so this ① re-reads the hold and
 *     refuses unless it is still `held` (double-charge guard, spec
 *     risk #2), ② mints a transaction from the hold's line items + the
 *     chosen payment, ③ flips the hold to `recalled` linking the new
 *     transaction id. A crash between ② and ③ leaves a completed
 *     transaction with the hold still `held` — the precheck makes a
 *     retry refuse rather than double-charge; the manual void path
 *     recovers the orphaned transaction.
 *
 * `searchSabcrmRegisterItems` is NOT duplicated here — it already lives
 * in `sabcrm-commerce-docs.actions.ts` (lifted-limit item search).
 *
 * Gate pipeline copied verbatim from `sabcrm-commerce.actions.ts`:
 * checkout/hold use `create`, recall uses `edit`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmCommercePosApi } from '@/lib/rust-client/sabcrm-commerce';
import type { CrmPosTransactionDoc } from '@/lib/rust-client/sabcrm-commerce';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmRegisterCheckoutInput,
  SabcrmRegisterHoldInput,
  SabcrmRegisterLineInput,
  SabcrmRegisterRecallInput,
} from './sabcrm-commerce-register.actions.types';

/* ─── Gate (mirrors sabcrm-commerce.actions.ts verbatim) ─────────── */

const MODULE_KEY = 'sabcrm';
const COMMERCE_BASE = '/sabcrm/commerce';

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
  const projectId = requested;

  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** Normalise cart lines onto the crate wire (drop `total`, keep `quantity`). */
function toWireLines(
  lines: SabcrmRegisterLineInput[],
): { itemId?: string | null; name: string; quantity: number; rate: number; taxRate?: number }[] {
  return lines.map((l) => ({
    itemId: l.itemId ?? undefined,
    name: l.name,
    quantity: l.quantity,
    rate: l.rate,
    taxRate: l.taxRate,
  }));
}

/* ─── Checkout ───────────────────────────────────────────────────── */

/**
 * Rings up a sale at the register. Totals are computed server-side from
 * `lineItems`; the receipt number is `entity.transactionNumber`.
 */
export async function createSabcrmPosTransaction(
  input: SabcrmRegisterCheckoutInput,
  projectId?: string,
): Promise<ActionResult<{ id: string; entity: CrmPosTransactionDoc }>> {
  if (!input?.sessionId) {
    return { ok: false, error: 'A session is required.' };
  }
  if (!input.lineItems?.length) {
    return { ok: false, error: 'Add at least one item before checkout.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.transactions.create(g.ctx.projectId, {
      sessionId: input.sessionId,
      customerId: input.customerId || undefined,
      lineItems: toWireLines(input.lineItems),
      paymentMethod: input.paymentMethod,
      paymentSplits: input.paymentSplits,
    });
    revalidatePath(`${COMMERCE_BASE}/pos-transactions`);
    revalidatePath(`${COMMERCE_BASE}/pos-sessions`);
    return { ok: true, data: res };
  } catch (e) {
    return fail(e, 'Checkout failed.');
  }
}

/* ─── Hold ───────────────────────────────────────────────────────── */

/** Parks the current cart as a held ticket for later recall. */
export async function createSabcrmPosHold(
  input: SabcrmRegisterHoldInput,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!input?.sessionId) {
    return { ok: false, error: 'A session is required.' };
  }
  if (!input.lineItems?.length) {
    return { ok: false, error: 'Add at least one item before holding.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmCommercePosApi.holds.create(g.ctx.projectId, {
      sessionId: input.sessionId,
      customerId: input.customerId || undefined,
      lineItems: toWireLines(input.lineItems),
      holdReason: input.holdReason?.trim() || undefined,
    });
    revalidatePath(`${COMMERCE_BASE}/pos-holds`);
    return { ok: true, data: { id: res.id } };
  } catch (e) {
    return fail(e, 'Could not hold the ticket.');
  }
}

/* ─── Recall (composed) ──────────────────────────────────────────── */

/**
 * Recalls a held ticket and completes the sale. NON-ATOMIC + guarded:
 *
 *   1. re-read the hold; refuse unless `status === 'held'` (a second
 *      recall would otherwise double-charge — spec risk #2);
 *   2. mint a transaction from the hold's session + line items + chosen
 *      payment (totals server-computed);
 *   3. flip the hold to `recalled`, linking the new transaction id.
 *
 * If step 3 fails after step 2, the transaction is already minted; the
 * returned error names the orphaned transaction so the cashier can void
 * it or retry (the precheck in step 1 prevents the retry from charging
 * again).
 */
export async function recallSabcrmPosHold(
  input: SabcrmRegisterRecallInput,
  projectId?: string,
): Promise<ActionResult<{ id: string; entity: CrmPosTransactionDoc }>> {
  if (!input?.holdId) {
    return { ok: false, error: 'A hold is required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // 1. Double-charge guard — refuse unless the hold is still parked.
    const hold = await sabcrmCommercePosApi.holds.getById(
      g.ctx.projectId,
      input.holdId,
    );
    if (hold.status !== 'held') {
      return {
        ok: false,
        error: `This ticket is already ${hold.status} and cannot be recalled again.`,
      };
    }
    if (!hold.lineItems?.length) {
      return { ok: false, error: 'The held ticket has no items.' };
    }

    // 2. Mint the transaction from the hold's session + lines.
    const txn = await sabcrmCommercePosApi.transactions.create(g.ctx.projectId, {
      sessionId: hold.sessionId,
      customerId: hold.customerId || undefined,
      lineItems: hold.lineItems.map((li) => ({
        itemId: li.itemId ?? undefined,
        name: li.name,
        quantity: li.quantity,
        rate: li.rate,
        taxRate: li.taxRate,
      })),
      paymentMethod: input.paymentMethod,
      paymentSplits: input.paymentSplits,
    });

    // 3. Flip the hold to recalled, linking the new transaction.
    try {
      await sabcrmCommercePosApi.holds.recall(g.ctx.projectId, input.holdId, {
        recalledTransactionId: txn.id,
      });
    } catch (recallErr) {
      // The sale was charged but the hold flip failed — surface the
      // transaction number so the cashier can reconcile manually.
      const num = txn.entity.transactionNumber;
      return {
        ok: false,
        error:
          recallErr instanceof RustApiError
            ? `Charged transaction ${num}, but couldn't close the hold: ${recallErr.message}. Void ${num} or retry.`
            : `Charged transaction ${num}, but couldn't close the hold. Void ${num} or retry.`,
      };
    }

    revalidatePath(`${COMMERCE_BASE}/pos-transactions`);
    revalidatePath(`${COMMERCE_BASE}/pos-holds`);
    revalidatePath(`${COMMERCE_BASE}/pos-sessions`);
    return { ok: true, data: txn };
  } catch (e) {
    return fail(e, 'Could not recall the ticket.');
  }
}
