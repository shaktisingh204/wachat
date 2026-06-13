'use server';

/**
 * SabCRM CPQ — quote document / e-signature server actions.
 *
 * Two surfaces:
 *
 *   1. `createShareableQuoteTw` — GATED ('edit'). The gate / fail helpers are
 *      the verbatim session → project membership → RBAC `canServer` → plan
 *      block from `sabcrm-scoring.actions.ts`, including the cross-tenant
 *      defense against a client-supplied `projectId`.
 *
 *   2. `getPublicQuote` + `signQuotePublic` — PUBLIC (ungated). These back the
 *      customer-facing `/share/quote/[token]` page and CANNOT require a
 *      session (the signer is not a SabNode user). They are validated, not
 *      open: the opaque HMAC token is verified + re-validated server-side
 *      (see `quote-doc.server.ts`), a honeypot field is checked, and the
 *      signature payload shape is re-validated. Modeled on the existing
 *      public form / contract-sign actions.
 */

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  createShareableQuote,
  getPublicQuote as getPublicQuoteServer,
  recordSignature,
  type PublicQuoteView,
  type ShareableQuoteResult,
} from '@/lib/sabcrm/quote-doc.server';

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
/* GATED — create a shareable quote link                                      */
/* -------------------------------------------------------------------------- */

/**
 * Mint (or reuse) a public, HMAC-signed shareable link for a quote so it can
 * be sent to the customer for e-signature + payment. Gated on `edit` — this
 * exposes a quote to the public internet, so it tracks the config-level
 * permission (no `manage` in the vocabulary; `edit` is the highest write).
 */
export async function createShareableQuoteTw(
  quoteId: string,
  projectId?: string,
): Promise<ActionResult<ShareableQuoteResult>> {
  if (!quoteId) return { ok: false, error: 'A quote id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await createShareableQuote(g.ctx.projectId, quoteId) };
  } catch (e) {
    return fail(e, 'Failed to create the shareable quote link.');
  }
}

/* -------------------------------------------------------------------------- */
/* PUBLIC (ungated, validated) — back /share/quote/[token]                     */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a public token to the render-ready quote view. UNGATED — the token
 * IS the credential (verified + re-validated in `quote-doc.server.ts`).
 * Returns `null` for any invalid / revoked / mismatched token.
 */
export async function getPublicQuote(token: string): Promise<PublicQuoteView | null> {
  if (!token || typeof token !== 'string') return null;
  try {
    return await getPublicQuoteServer(token);
  } catch {
    return null;
  }
}

export type SignQuoteResult =
  | { ok: true; quotationNo: string; payUrl?: string }
  | { ok: false; error: string };

/** Best-effort client IP + UA from the request headers (public flow). */
async function clientMeta(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null;
    return { ip, ua: h.get('user-agent') || null };
  } catch {
    return { ip: null, ua: null };
  }
}

/**
 * Capture an e-signature for a public quote and accept it. UNGATED but
 * validated:
 *   - the `hp` honeypot must be empty (bots fill hidden fields);
 *   - the token is HMAC-verified + re-validated against the stored share row
 *     and the live quote (in `recordSignature`);
 *   - the signer name + signature data URL shape are re-validated server-side
 *     (never trust the client).
 * On success the quote is marked accepted, the signature is stored in our own
 * `sabcrm_quote_shares` collection (IP + timestamp captured), and a SabPay
 * payment link is created best-effort for the accepted amount.
 */
export async function signQuotePublic(
  token: string,
  signerName: string,
  signatureDataUrl: string,
  hp?: string,
): Promise<SignQuoteResult> {
  // Honeypot — a real human never fills this hidden field.
  if (hp && hp.trim() !== '') {
    return { ok: false, error: 'Submission rejected.' };
  }
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'This link is invalid.' };
  }
  try {
    const meta = await clientMeta();
    const result = await recordSignature(
      token,
      signerName,
      signatureDataUrl,
      meta.ip,
      meta.ua,
    );
    // Refresh the public page so it flips to the accepted/pay state.
    revalidatePath(`/share/quote/${encodeURIComponent(token)}`);
    return { ok: true, quotationNo: result.quotationNo, payUrl: result.payUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not record the signature.',
    };
  }
}
