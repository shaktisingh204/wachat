/**
 * SabFlow access-control audit log.
 *
 * Thin wrapper around the existing `sabflow_audit_log` collection
 * (via `src/lib/sabflow/persistence/audit.ts` → `recordFlowAction`)
 * that records who-did-what for share / invite / role-change events
 * on a SabFlow doc.
 *
 * Design contract:
 *   • NO new Mongo collection — every event lands in the same
 *     `sabflow_audit_log` collection the rest of SabFlow uses.
 *   • Writes are fire-and-forget safe: the underlying audit writer
 *     never throws (failures are logged + swallowed).
 *   • `docId` is recorded on BOTH `flowId` (for per-doc timeline
 *     queries) and `target` (canonical affected-resource field),
 *     matching the `recordDocAudit` convention.
 *   • The principal (the user whose access is being changed) is
 *     stored in `metadata.principalUserId`; the actor (the user
 *     performing the change) is the row's `userId`.
 *   • The optional `role` and free-form `meta` are merged into the
 *     row's `metadata` payload — no schema reshape required.
 */

import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import { listAudit, type AuditEntry, type ListAuditOptions } from '@/lib/sabflow/audit/db';

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Discrete access-control audit actions.
 *
 * Kept as a standalone union — the underlying writer already accepts
 * `AuditAction | string`, so no change to `../audit/db.ts` is needed.
 */
export type AccessAuditAction =
  | 'access.granted'
  | 'access.revoked'
  | 'access.elevated'
  | 'access.denied'
  | 'access.invite_sent'
  | 'access.invite_accepted'
  | 'access.invite_revoked'
  | 'access.share_link_created'
  | 'access.share_link_used'
  | 'access.share_link_revoked'
  | 'access.owner_transferred';

export interface RecordAccessEventInput {
  /** Workspace the doc belongs to.  Doubles as `userId` for the
   *  underlying writer when no explicit actor is available. */
  workspaceId: string;
  /** Affected doc id — written to `flowId` AND `target`. */
  docId: string;
  /** The user whose access is being granted / revoked / elevated.
   *  Stored on `metadata.principalUserId`.  Optional for events that
   *  don't have a single principal (e.g. anonymous share-link use). */
  principalUserId?: string;
  /** The user performing the action.  Falls back to `workspaceId`
   *  when omitted (matches the `recordDocAudit` fallback policy). */
  actorUserId?: string;
  /** One of the discrete access actions. */
  action: AccessAuditAction;
  /** Optional role descriptor (e.g. 'viewer', 'editor', 'owner').
   *  Stored on `metadata.role`. */
  role?: string;
  /** Free-form extra context (invite token fingerprint, share-link
   *  id, prior/next role for elevations, denial reason, etc.) —
   *  merged into the row's `metadata` payload. */
  meta?: Record<string, unknown>;
}

export interface ListAccessEventsOptions {
  limit?: number;
  skip?: number;
  /** Filter to a single access action. */
  action?: AccessAuditAction;
}

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Record a single access-control audit event.
 *
 * Resolves with `undefined` in every case — including failure — because
 * the underlying `recordFlowAction` catches + logs internally.  Callers
 * may `await` for ordering guarantees or fire-and-forget; either way an
 * audit write failure will never break the user-facing operation.
 */
export async function recordAccessEvent(input: RecordAccessEventInput): Promise<void> {
  if (!input || !input.workspaceId || !input.docId || !input.action) {
    // eslint-disable-next-line no-console
    console.warn(
      '[sabflow-access-audit] recordAccessEvent skipped: missing workspaceId/docId/action',
      {
        hasWorkspaceId: !!input?.workspaceId,
        hasDocId: !!input?.docId,
        action: input?.action,
      },
    );
    return;
  }

  const actor = input.actorUserId ?? input.workspaceId;

  // Merge structured fields into the metadata payload.  We keep
  // `principalUserId` + `role` at well-known keys so list/admin
  // readers can project them without parsing free-form `meta`.
  const metadata: Record<string, unknown> = { ...(input.meta ?? {}) };
  if (input.principalUserId !== undefined) {
    metadata.principalUserId = input.principalUserId;
  }
  if (input.role !== undefined) {
    metadata.role = input.role;
  }

  try {
    await recordFlowAction(input.action, {
      userId: actor,
      workspaceId: input.workspaceId,
      // Surface docId on both fields to match the persistence-audit
      // convention — per-doc timeline reads use `flowId`, while
      // canonical resource queries use `target`.
      flowId: input.docId,
      target: input.docId,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  } catch (err) {
    // `recordFlowAction` shouldn't ever throw — but belt-and-braces:
    // audit must never propagate to the caller.
    // eslint-disable-next-line no-console
    console.error('[sabflow-access-audit] recordAccessEvent unexpected throw:', err);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Readers
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Read access-control events for a single doc within a workspace.
 *
 * Filters the shared `sabflow_audit_log` collection down to
 * `access.*` actions for the given doc.  Designed for the admin UI's
 * per-doc access-history panel.
 *
 * Returns `{ entries, total }` so the UI can render pagination
 * controls alongside the rows.
 *
 * Implementation detail: we delegate to `listAudit` (which keys off
 * `userId`) using `workspaceId` as the `userId` filter — this matches
 * how `recordAccessEvent` writes the row when no explicit actor is
 * passed.  For rows written with a distinct actor, the underlying
 * `flowId` index still serves the lookup; we post-filter to the
 * `access.*` namespace + the requested workspace.
 */
export async function listAccessEvents(
  workspaceId: string,
  docId: string,
  opts: ListAccessEventsOptions = {},
): Promise<{ entries: AuditEntry[]; total: number }> {
  if (!workspaceId || !docId) {
    return { entries: [], total: 0 };
  }

  // Borrow `listAudit`'s pagination contract.  When a specific
  // `action` is requested we forward it; otherwise we pull a wider
  // slice and post-filter to the `access.*` namespace so we don't
  // need a new query path on the underlying collection.
  const baseOpts: ListAuditOptions = {
    limit: opts.limit,
    skip: opts.skip,
    flowId: docId,
    action: opts.action,
  };

  const { entries, total } = await listAudit(workspaceId, baseOpts);

  // When no specific action filter was supplied, narrow to the
  // `access.*` namespace in-memory.  `total` reflects the underlying
  // (per-doc) count — admin UI callers that need a strict
  // access-only total should pass an explicit `action`.
  const filtered = opts.action
    ? entries
    : entries.filter(
        (e) => typeof e.action === 'string' && e.action.startsWith('access.'),
      );

  return { entries: filtered, total };
}
