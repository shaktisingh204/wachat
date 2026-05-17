/**
 * Audit-log convenience helper.
 *
 * `recordFlowAction(action, ctx)` is the fire-and-forget entry point
 * for route handlers / server actions that need to record who did what.
 * It pulls the actor's id, ip address, and user agent from whatever
 * caller context shape is available, then writes the audit row in the
 * background so the caller never blocks on Mongo.
 *
 * Errors are swallowed and logged — audit writes must never break a
 * user-facing mutation.
 */

import type { NextRequest } from 'next/server';
import { recordAudit, type AuditAction } from './db';

/* ──────────────────────────────────────────────────────────────────────────
   Caller context shapes
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Flexible context shape — accepts either:
 *   • a `NextRequest` (we pull the headers ourselves), or
 *   • a pre-resolved `{ userId, ipAddress?, userAgent?, headers? }`,
 * plus optional flow / target / metadata fields.
 */
export interface FlowActionContext {
  /** The actor — required.  Falls back to `workspaceId` if omitted. */
  userId?: string;
  /** Single-tenant alias for `userId` — used when the caller only has a workspace id. */
  workspaceId?: string;
  /** The flow this action refers to (if any). */
  flowId?: string;
  /** Affected resource id — flow id, credential id, env-var key, etc. */
  target?: string;
  /** Arbitrary structured payload (diff summary, old/new values, etc.). */
  metadata?: Record<string, unknown>;
  /** Caller-supplied request — used to pull IP + user agent. */
  request?: NextRequest | Request;
  /** Pre-resolved IP, used when no request is available (e.g. server actions). */
  ipAddress?: string;
  /** Pre-resolved user agent, used when no request is available. */
  userAgent?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Internal helpers
   ────────────────────────────────────────────────────────────────────────── */

function extractIp(req: NextRequest | Request | undefined): string | undefined {
  if (!req) return undefined;
  const h = req.headers;
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip') ?? undefined;
}

function extractUserAgent(req: NextRequest | Request | undefined): string | undefined {
  if (!req) return undefined;
  return req.headers.get('user-agent') ?? undefined;
}

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Fire-and-forget audit writer.
 *
 * The Promise returned is the in-flight write — most callers will
 * intentionally NOT `await` it so the user-facing response isn't held up
 * by Mongo latency.  Errors are caught + logged internally.
 */
export function recordFlowAction(
  action: AuditAction | string,
  ctx: FlowActionContext,
): Promise<void> {
  const userId = ctx.userId ?? ctx.workspaceId;
  if (!userId) {
    console.warn('[sabflow-audit] recordFlowAction skipped: no userId/workspaceId in context');
    return Promise.resolve();
  }

  const ipAddress = ctx.ipAddress ?? extractIp(ctx.request);
  const userAgent = ctx.userAgent ?? extractUserAgent(ctx.request);

  const task = recordAudit({
    userId,
    workspaceId: ctx.workspaceId ?? userId,
    flowId: ctx.flowId,
    action,
    target: ctx.target,
    metadata: ctx.metadata,
    ipAddress,
    userAgent,
  })
    .then(() => undefined)
    .catch((err) => {
      // Never let an audit failure surface to the caller.
      console.error('[sabflow-audit] recordFlowAction failed:', err);
    });

  return task;
}
