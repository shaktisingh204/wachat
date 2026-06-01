import "server-only";

/**
 * SabCRM — audit entry helper (server-only).
 *
 * Thin wrapper around the cross-cutting {@link writeAuditEntry} from
 * `@/lib/audit-log` that encodes the SabCRM-specific entityKind convention
 * (`sabcrm:<objectSlug>`), provides a typed input surface for the three
 * mutation domains (record, object/field schema, activity), and enforces
 * the fire-and-forget contract: {@link logSabcrmAudit} never throws or
 * rejects — failures are swallowed after logging so callers can
 * unconditionally await without wrapping in try/catch.
 *
 * Usage (identical to the pattern in assignment.server.ts):
 *
 *   // fire-and-forget — do NOT await in the main control flow
 *   void logSabcrmAudit({
 *     tenantUserId: ctx.userId,
 *     projectId:    ctx.projectId,
 *     actor:        ctx.userId,
 *     domain:       'record',
 *     action:       'create',
 *     objectSlug:   'opportunities',
 *     entityId:     record._id,
 *     reason:       `Created opportunity "${label}"`,
 *   });
 *
 * Or, when you need to wait for the write before returning (e.g. from a
 * helper that is already fire-and-forget at the call site):
 *
 *   await logSabcrmAudit({ ... });   // still never throws
 */

import { writeAuditEntry, type AuditAction } from "@/lib/audit-log";

/* -------------------------------------------------------------------------- */
/* Domain constants                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Which sub-system of SabCRM the mutation belongs to.
 *
 * - `record`   — CRUD on a data record (`sabcrm_records` collection).
 * - `object`   — create / update / delete a custom-object definition
 *                (`sabcrm_objects` collection).
 * - `field`    — add / update / remove / reorder a field on an object.
 * - `relation` — define or remove a RELATION field pair.
 * - `activity` — create / update / delete a timeline entry
 *                (`sabcrm_activities` collection).
 * - `view`     — save / delete / set-default a saved view
 *                (`sabcrm_views` collection).
 * - `assign`   — assign or unassign a record (sub-action of `record` mutations
 *                but broken out here to match {@link AuditAction}'s `assign`
 *                verb so the audit-log page can filter them separately).
 */
export type SabcrmAuditDomain =
  | "record"
  | "object"
  | "field"
  | "relation"
  | "activity"
  | "view"
  | "assign";

/* -------------------------------------------------------------------------- */
/* Input shape                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Input for {@link logSabcrmAudit}.
 *
 * Every mutation in SabCRM must supply at minimum:
 *   - `tenantUserId` — the tenant-root user id (`session.user._id`), used to
 *     scope the shared `crm_audit_log` collection. Matches the field the
 *     cross-cutting audit log uses (`userId`).
 *   - `projectId`    — the SabCRM project this mutation belongs to. Stored in
 *     the audit row's `reason` prefix so audit queries can be tenant + project
 *     scoped without a schema change to `crm_audit_log`.
 *   - `actor`        — the workspace-member id performing the action. Defaults
 *     to `tenantUserId` in single-user tenants (matches `writeAuditEntry`
 *     behaviour).
 *   - `domain`       — which SabCRM sub-system was mutated.
 *   - `action`       — the verb (`create`, `update`, `delete`, `assign`, …).
 *     Accepts the {@link AuditAction} union so callers can pass any recognised
 *     verb without casting.
 *   - `objectSlug`   — the CRM object slug. Becomes `sabcrm:<slug>` as the
 *     `entityKind` stored in the audit row, aligning with the convention
 *     already used in `assignment.server.ts` (`entityKind: sabcrm:${record.object}`).
 *   - `entityId`     — Mongo hex string id of the mutated entity (record id,
 *     object doc id, activity id, view id, etc.).
 */
export interface SabcrmAuditInput {
  /**
   * Tenant root user id — `session.user._id` (hex string). Scopes the
   * `crm_audit_log` row to the correct tenant.
   */
  tenantUserId: string;

  /**
   * SabCRM project id. Embedded in the `reason` prefix so project-scoped
   * audit queries are possible without altering the shared collection schema.
   */
  projectId: string;

  /**
   * The workspace member performing the action. Defaults to `tenantUserId`
   * if omitted (passthrough to {@link writeAuditEntry}).
   */
  actor?: string;

  /** Which SabCRM sub-system was mutated. */
  domain: SabcrmAuditDomain;

  /**
   * The mutation verb. Uses the {@link AuditAction} union so well-known verbs
   * (`create`, `update`, `delete`, `assign`, `status_change`, …) are first-class
   * and ad-hoc verbs are still accepted via the `string` escape hatch.
   */
  action: AuditAction;

  /**
   * Object slug of the entity being mutated (e.g. `opportunities`, `people`,
   * `my-custom-object`). Becomes the `entityKind` suffix in the audit row:
   * `sabcrm:<objectSlug>`.
   */
  objectSlug: string;

  /**
   * Mongo hex string id of the mutated entity. For record mutations this is the
   * record `_id`; for object-schema mutations it is the object doc `_id`; for
   * activities it is the activity `_id`; for views it is the view `_id`.
   */
  entityId: string;

  /**
   * Optional human-readable context string (e.g. `'Created opportunity "Acme deal"'`).
   * The `projectId` is always prefixed automatically so project-filtered queries
   * on the audit page work without a schema change.
   */
  reason?: string;

  /**
   * Optional structured before/after diff. Shape is per-caller and stored
   * verbatim — the audit-log UI renders it as a key → {before, after} table.
   */
  diff?: Record<string, { before?: unknown; after?: unknown }>;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Log a SabCRM audit entry.
 *
 * Wraps {@link writeAuditEntry} with the SabCRM `entityKind` convention
 * (`sabcrm:<objectSlug>`) and embeds `projectId` in the `reason` prefix.
 *
 * **Best-effort / fire-and-forget by contract** — this function never throws.
 * Any failure is caught and logged to `stderr` only. Callers may `await` it
 * for sequencing but must not rely on its completion to determine whether the
 * primary mutation succeeded.
 *
 * @example
 * // In a server action, after a successful record write:
 * void logSabcrmAudit({
 *   tenantUserId: ctx.userId,
 *   projectId:    ctx.projectId,
 *   actor:        ctx.userId,
 *   domain:       'record',
 *   action:       'create',
 *   objectSlug:   object,
 *   entityId:     record._id,
 *   reason:       `Created ${objectLabel} "${label}"`,
 * });
 */
export async function logSabcrmAudit(input: SabcrmAuditInput): Promise<void> {
  // Guard: all scalar fields must be non-empty strings. writeAuditEntry also
  // validates, but we short-circuit here to avoid the async DB round-trip.
  if (
    !input.tenantUserId ||
    !input.projectId ||
    !input.domain ||
    !input.action ||
    !input.objectSlug ||
    !input.entityId
  ) {
    console.warn("[logSabcrmAudit] Skipped: missing required fields.", {
      tenantUserId: !!input.tenantUserId,
      projectId: !!input.projectId,
      domain: input.domain,
      action: input.action,
      objectSlug: input.objectSlug,
      entityId: !!input.entityId,
    });
    return;
  }

  // Prefix the reason with the projectId so audit-page queries can filter by
  // project without a schema change to the shared crm_audit_log collection.
  const reason = input.reason
    ? `[project:${input.projectId}] ${input.reason}`
    : `[project:${input.projectId}]`;

  // writeAuditEntry is already fire-and-forget by contract (swallows errors
  // and logs to stderr). We wrap in an additional try/catch here as defence-in-
  // depth so this helper is ALWAYS safe to call from any mutation path.
  try {
    await writeAuditEntry({
      tenantUserId: input.tenantUserId,
      actorId: input.actor,
      action: input.action,
      entityKind: `sabcrm:${input.objectSlug}`,
      entityId: input.entityId,
      reason,
      diff: input.diff,
    });
  } catch (e) {
    console.error("[logSabcrmAudit] Unexpected error (audit write failed):", e);
  }
}

/* -------------------------------------------------------------------------- */
/* Domain-scoped convenience builders                                         */
/* -------------------------------------------------------------------------- */

/**
 * Convenience builder — log a **record** mutation (`create` / `update` /
 * `delete` / `assign` / `status_change`).
 *
 * The `entityId` is the record's `_id` (hex string). The `objectSlug` is the
 * object this record belongs to (e.g. `opportunities`).
 */
export async function logRecordAudit(
  ctx: { tenantUserId: string; projectId: string; actor?: string },
  action: AuditAction,
  objectSlug: string,
  recordId: string,
  opts: { reason?: string; diff?: SabcrmAuditInput["diff"] } = {},
): Promise<void> {
  return logSabcrmAudit({
    tenantUserId: ctx.tenantUserId,
    projectId: ctx.projectId,
    actor: ctx.actor,
    domain: "record",
    action,
    objectSlug,
    entityId: recordId,
    reason: opts.reason,
    diff: opts.diff,
  });
}

/**
 * Convenience builder — log an **object-schema** mutation (`create` /
 * `update` / `delete`).
 *
 * The `entityId` is the object doc's `_id` (hex string), or a stable
 * synthetic id such as the slug when the doc id is not available at the
 * call site (e.g. just before deletion). The `objectSlug` is the slug
 * of the object being created/updated/deleted.
 */
export async function logObjectAudit(
  ctx: { tenantUserId: string; projectId: string; actor?: string },
  action: AuditAction,
  objectSlug: string,
  entityId: string,
  opts: { reason?: string; diff?: SabcrmAuditInput["diff"] } = {},
): Promise<void> {
  return logSabcrmAudit({
    tenantUserId: ctx.tenantUserId,
    projectId: ctx.projectId,
    actor: ctx.actor,
    domain: "object",
    action,
    objectSlug,
    entityId,
    reason: opts.reason,
    diff: opts.diff,
  });
}

/**
 * Convenience builder — log a **field-schema** mutation (`create` / `update` /
 * `delete` / `reorder`).
 *
 * The `entityId` should be the object doc's `_id` (the field itself has no
 * separate id; the audit row therefore targets the parent object document).
 * Use the `diff` map to record which field key was affected:
 *
 *   diff: { [fieldKey]: { before: oldField, after: newField } }
 */
export async function logFieldAudit(
  ctx: { tenantUserId: string; projectId: string; actor?: string },
  action: AuditAction,
  objectSlug: string,
  objectDocId: string,
  opts: { reason?: string; diff?: SabcrmAuditInput["diff"] } = {},
): Promise<void> {
  return logSabcrmAudit({
    tenantUserId: ctx.tenantUserId,
    projectId: ctx.projectId,
    actor: ctx.actor,
    domain: "field",
    action,
    objectSlug,
    entityId: objectDocId,
    reason: opts.reason,
    diff: opts.diff,
  });
}

/**
 * Convenience builder — log an **activity** mutation (`create` / `update` /
 * `delete` / `status_change`).
 *
 * The `entityId` is the activity doc's `_id` (hex string). The `objectSlug`
 * is the target record's object slug (e.g. `opportunities`) so the audit row
 * groups with related record mutations in the audit-log UI.
 */
export async function logActivityAudit(
  ctx: { tenantUserId: string; projectId: string; actor?: string },
  action: AuditAction,
  objectSlug: string,
  activityId: string,
  opts: { reason?: string; diff?: SabcrmAuditInput["diff"] } = {},
): Promise<void> {
  return logSabcrmAudit({
    tenantUserId: ctx.tenantUserId,
    projectId: ctx.projectId,
    actor: ctx.actor,
    domain: "activity",
    action,
    objectSlug,
    entityId: activityId,
    reason: opts.reason,
    diff: opts.diff,
  });
}

/**
 * Convenience builder — log a **view** mutation (`create` / `update` /
 * `delete`).
 *
 * The `entityId` is the view doc's `_id` (hex string). The `objectSlug` is
 * the object the view belongs to (e.g. `opportunities`).
 */
export async function logViewAudit(
  ctx: { tenantUserId: string; projectId: string; actor?: string },
  action: AuditAction,
  objectSlug: string,
  viewId: string,
  opts: { reason?: string; diff?: SabcrmAuditInput["diff"] } = {},
): Promise<void> {
  return logSabcrmAudit({
    tenantUserId: ctx.tenantUserId,
    projectId: ctx.projectId,
    actor: ctx.actor,
    domain: "view",
    action,
    objectSlug,
    entityId: viewId,
    reason: opts.reason,
    diff: opts.diff,
  });
}
