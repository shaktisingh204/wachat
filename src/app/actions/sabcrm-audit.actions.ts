'use server';

/**
 * SabCRM — audit / change-log server actions.
 *
 * Thin, gated wrappers over the Rust audit engine
 * ({@link sabcrmAuditApi} in `@/lib/rust-client/sabcrm-audit`). These power the
 * per-record activity / change log: an append-only stream of create / update /
 * delete (and arbitrary) actions taken within a project, each stamped with the
 * acting user and a server-set timestamp.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-views.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI degrades gracefully.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmAuditApi } from '@/lib/rust-client/sabcrm-audit';
import type { SabcrmRustAuditEntry } from '@/lib/rust-client/sabcrm-audit';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  ListAuditTwOpts,
  LogAuditTwInput,
} from './sabcrm-audit.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

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
 * helper in `sabcrm-views.actions.ts` verbatim, including the cross-tenant
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

// ---------------------------------------------------------------------------
// Audit — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists a project's audit entries (newest first) through the Rust engine. */
export async function listAuditTw(
  opts?: ListAuditTwOpts,
  projectId?: string,
): Promise<ActionResult<SabcrmRustAuditEntry[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmAuditApi.list(g.ctx.projectId, opts);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list audit entries.');
  }
}

/** Appends an audit entry stamped with the caller's actorId. */
export async function logAuditTw(
  input: LogAuditTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustAuditEntry>> {
  if (!input?.action?.trim()) {
    return { ok: false, error: 'An action is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const entry = await sabcrmAuditApi.log(g.ctx.projectId, input);
    return { ok: true, data: entry };
  } catch (e) {
    return fail(e, 'Failed to log audit entry.');
  }
}
