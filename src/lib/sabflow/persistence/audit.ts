/**
 * SabFlow doc-persistence audit shim.
 *
 * Thin wrapper around `src/lib/sabflow/audit/middleware.ts` (which in
 * turn calls into `src/lib/sabflow/audit/db.ts`) — exposes a tightly
 * typed entry point for the doc-store CRUD path so every read / write /
 * snapshot / delete / share / unshare lands in the same
 * `sabflow_audit_log` Mongo collection the rest of SabFlow uses.
 *
 * Design contract:
 *   • Audit writes MUST NEVER throw — failures are logged + swallowed
 *     inside the underlying `recordFlowAction` helper.
 *   • Schema is NOT reshaped here — `docId` is recorded via the
 *     existing `target` field; the action string is namespaced under
 *     `doc.*` so it slots cleanly into the existing `AuditAction`
 *     freeform-string fallback.
 *   • This file is the ONLY persistence-layer audit surface — callers
 *     in `src/lib/sabflow/persistence/*` should import from here and
 *     not reach into `../audit/*` directly.
 */

import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Discrete audit actions emitted by the SabFlow doc persistence layer.
 *
 * Kept as a standalone union (rather than extending `AuditAction` in
 * `../audit/db.ts`) so the existing schema isn't reshaped — the
 * underlying writer already accepts `AuditAction | string`.
 */
export type DocAuditAction =
  | 'doc.read'
  | 'doc.write'
  | 'doc.snapshot'
  | 'doc.delete'
  | 'doc.share'
  | 'doc.unshare';

export interface RecordDocAuditInput {
  /** Workspace the doc belongs to.  Doubles as `userId` for the writer
   *  when no explicit actor is available (single-tenant fallback). */
  workspaceId: string;
  /** Affected doc id — stored in the audit row's `target` column. */
  docId: string;
  /** The actor performing the action.  Falls back to `workspaceId`. */
  userId?: string;
  /** One of the discrete doc actions. */
  action: DocAuditAction;
  /** Optional structured payload (diff size, snapshot id, share token
   *  fingerprint, etc.) — written verbatim to `metadata`. */
  meta?: Record<string, unknown>;
}

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Record a single doc-level audit entry.
 *
 * Resolves with `undefined` in every case — including failure — because
 * the underlying `recordFlowAction` catches + logs internally.  Callers
 * may `await` for ordering guarantees or fire-and-forget; either way
 * an audit write failure will never break the user-facing operation.
 */
export async function recordDocAudit(input: RecordDocAuditInput): Promise<void> {
  // Defensive guard: `recordFlowAction` already warns on missing
  // userId/workspaceId, but bail early so we don't even pay for the
  // call when the caller has neither.
  if (!input || !input.workspaceId || !input.docId || !input.action) {
    // Match the audit module's policy: log + swallow.
    // eslint-disable-next-line no-console
    console.warn(
      '[sabflow-persistence-audit] recordDocAudit skipped: missing workspaceId/docId/action',
      { hasWorkspaceId: !!input?.workspaceId, hasDocId: !!input?.docId, action: input?.action },
    );
    return;
  }

  const actor = input.userId ?? input.workspaceId;

  try {
    await recordFlowAction(input.action, {
      userId: actor,
      workspaceId: input.workspaceId,
      // SabFlow doc ids ARE flow-scoped in practice — surface them on
      // both `flowId` (for per-flow timeline queries) and `target`
      // (the canonical affected-resource field) so existing audit
      // readers light up without any schema change.
      flowId: input.docId,
      target: input.docId,
      metadata: input.meta,
    });
  } catch (err) {
    // `recordFlowAction` shouldn't ever throw — but belt-and-braces:
    // audit must never propagate.
    // eslint-disable-next-line no-console
    console.error('[sabflow-persistence-audit] recordDocAudit unexpected throw:', err);
  }
}
