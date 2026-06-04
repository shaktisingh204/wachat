import "server-only";

import { ObjectId, type Filter } from "mongodb";

import { writeAuditEntry } from "@/lib/audit-log";
import {
  fireCrmNotification,
  type CrmNotificationType,
  type CrmResourceType,
} from "@/lib/notifications/crm";

import { sabcrmRecords } from "./db";
import { getObject } from "./objects.server";
import type { CrmRecord, ObjectMetadata } from "./types";

/**
 * SabCRM — record/task assignment runtime (server-only).
 *
 * Assignment is stored as `assigneeId` inside the record's `data` map (the same
 * free-form map every other field lives in — see {@link CrmRecord}), rather than
 * in a parallel collection. This keeps a record's assignee co-located with the
 * record, so it round-trips through the existing CRUD/query runtime in
 * `records.server.ts` and renders like any other field.
 *
 * Tenant + ownership scoping
 * --------------------------
 * Record reads/writes are tenant-scoped by `projectId`. Unlike
 * `records.server.ts` (which additionally owner-scopes records by their
 * creator's `userId`), the assignment helpers intentionally do NOT scope by the
 * creator: any member with write access may (re)assign a record they did not
 * create, and the "my assignments" query must surface records owned by other
 * people. RBAC + plan gating is the responsibility of the calling server action
 * (the `gate()` helper in `sabcrm.actions.ts`); these helpers assume the caller
 * is already authorised.
 *
 * Cross-cutting side effects (audit + notification) are scoped by the *tenant
 * root user* (`tenantUserId`, i.e. `session.user._id`), matching the shared
 * `crm_audit_log` / `crm_notifications` collections — which key on the tenant
 * user, not the SabCRM `projectId`. The caller therefore passes both ids.
 *
 * Both side effects are best-effort: {@link writeAuditEntry} and
 * {@link fireCrmNotification} are fire-and-forget by contract and never unwind
 * the assignment write (the data change is the source of truth).
 */

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Field key on `record.data` that holds the assigned workspace-member id. */
export const ASSIGNEE_FIELD = "assigneeId" as const;

/**
 * Maps a SabCRM object slug onto the closest typed CRM notification kind +
 * resource type understood by `fireCrmNotification`. SabCRM objects are
 * metadata-driven (arbitrary slugs, incl. custom objects), whereas the shared
 * notification layer only models a fixed set of CRM resources; anything without
 * a direct match falls back to a generic `system` notification with no resource
 * type (the title/body still name the object).
 */
function notificationKindFor(objectSlug: string): {
  type: CrmNotificationType;
  resourceType?: CrmResourceType;
} {
  switch (objectSlug) {
    case "tasks":
      return { type: "task_assigned", resourceType: "task" };
    case "leads":
      return { type: "deal_assigned", resourceType: "deal" };
    default:
      return { type: "system" };
  }
}

/* -------------------------------------------------------------------------- */
/* Public result shapes                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Identifies the actor + tenant for the cross-cutting audit / notification
 * writes. `projectId` scopes the record itself; `tenantUserId` (the tenant root
 * user id / `session.user._id`) scopes the shared audit + notification
 * collections; `actorId` is the member performing the assignment.
 */
export interface AssignmentActor {
  /** SabCRM tenant scope for the record (`projectId`). */
  projectId: string;
  /** Tenant root user id (hex) — scope for audit + notifications. */
  tenantUserId: string;
  /** The member performing the (re)assignment (hex). */
  actorId: string;
}

/** Outcome of an {@link assignRecord} / {@link reassignRecord} call. */
export interface AssignResult {
  /** The record after the assignment write. */
  record: CrmRecord;
  /** Previous assignee id, or `null` if the record was unassigned. */
  previousAssigneeId: string | null;
  /** True when the new assignee differs from the previous one. */
  changed: boolean;
}

/** Query options for {@link listMyAssignments}. */
export interface MyAssignmentsQuery {
  /** Restrict to a single object slug (e.g. `tasks`). */
  object?: string;
  page?: number;
  pageSize?: number;
}

/** Paginated list of records assigned to a user. */
export interface MyAssignmentsPage {
  records: CrmRecord[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/* -------------------------------------------------------------------------- */
/* Id + serialisation helpers (the string <-> ObjectId boundary)              */
/* -------------------------------------------------------------------------- */

/** Returns an {@link ObjectId} for a caller-supplied id, or `null` if invalid. */
function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

/** Maps a raw `sabcrm_records` document onto the public {@link CrmRecord}. */
function toCrmRecord(doc: Record<string, unknown>): CrmRecord {
  const rawId = doc._id;
  const _id =
    rawId instanceof ObjectId ? rawId.toHexString() : String(rawId ?? "");
  return {
    _id,
    object: String(doc.object ?? ""),
    userId: String(doc.userId ?? ""),
    data: (doc.data as Record<string, unknown>) ?? {},
    createdAt: String(doc.createdAt ?? new Date().toISOString()),
    updatedAt: String(doc.updatedAt ?? new Date().toISOString()),
  };
}

/**
 * Resolves a human title for a record from its object metadata (the `isLabel`
 * field, falling back to the first TEXT/EMAIL field), for use in notification
 * bodies + audit reasons. Never throws — returns a generic fallback instead.
 */
function recordLabel(record: CrmRecord, object: ObjectMetadata | null): string {
  if (object) {
    const labelField =
      object.fields.find((f) => f.isLabel) ??
      object.fields.find((f) => f.type === "TEXT" || f.type === "EMAIL");
    if (labelField) {
      const raw = record.data[labelField.key];
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        return String(raw);
      }
    }
  }
  return `${object?.labelSingular ?? "Record"} ${record._id.slice(-6)}`;
}

/* -------------------------------------------------------------------------- */
/* Assignment                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Assigns (or reassigns) a record to a workspace member.
 *
 * Writes `assigneeId` onto the record's `data` map and bumps `updatedAt`, then
 * records an `assign` audit entry attributed to `actor.actorId`. When the
 * assignee actually changed and differs from the actor, a notification is
 * emitted to the new assignee. Pass `assigneeId = null` to clear the assignment
 * (this still audits, but never notifies).
 *
 * The record is scoped by `actor.projectId` only (see module docs) — any
 * authorised member may assign any record in the project. Returns `null` when
 * the id is malformed or no matching record exists in the project.
 */
export async function assignRecord(
  actor: AssignmentActor,
  recordId: string,
  assigneeId: string | null,
): Promise<AssignResult | null> {
  const { projectId, tenantUserId, actorId } = actor;

  const oid = toObjectId(recordId);
  if (!oid) return null;

  const col = await sabcrmRecords();
  const existing = await col.findOne({
    _id: oid,
    projectId,
  } as unknown as Filter<Record<string, unknown>>);
  if (!existing) return null;

  const current = toCrmRecord(existing as Record<string, unknown>);
  const previousAssigneeId =
    typeof current.data[ASSIGNEE_FIELD] === "string"
      ? (current.data[ASSIGNEE_FIELD] as string)
      : null;
  const changed = previousAssigneeId !== assigneeId;

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };
  const unset: Record<string, unknown> = {};
  if (assigneeId === null) {
    unset[`data.${ASSIGNEE_FIELD}`] = "";
  } else {
    set[`data.${ASSIGNEE_FIELD}`] = assigneeId;
  }

  await col.updateOne(
    { _id: oid, projectId } as unknown as Filter<Record<string, unknown>>,
    Object.keys(unset).length > 0 ? { $set: set, $unset: unset } : { $set: set },
  );

  // Construct the post-write view without a re-read.
  const nextData: Record<string, unknown> = { ...current.data };
  if (assigneeId === null) {
    delete nextData[ASSIGNEE_FIELD];
  } else {
    nextData[ASSIGNEE_FIELD] = assigneeId;
  }
  const record: CrmRecord = { ...current, data: nextData, updatedAt: now };

  // Object metadata is best-effort: used only for human-readable summaries.
  const object = await getObject(projectId, record.object).catch(() => null);
  const label = recordLabel(record, object);
  const objectLabel = object?.labelSingular ?? record.object;

  const summary =
    assigneeId === null
      ? `Unassigned ${objectLabel} "${label}"`
      : previousAssigneeId
        ? `Reassigned ${objectLabel} "${label}"`
        : `Assigned ${objectLabel} "${label}"`;

  // Audit (fire-and-forget by contract). `assign` is a recognised AuditAction.
  await writeAuditEntry({
    tenantUserId,
    actorId,
    action: "assign",
    entityKind: `sabcrm:${record.object}`,
    entityId: record._id,
    reason: summary,
    diff: {
      [ASSIGNEE_FIELD]: { before: previousAssigneeId, after: assigneeId },
    },
  });

  // Notify the new assignee only on a real change, and never self-notify.
  // `fireCrmNotification` is best-effort (swallows its own failures) and is
  // keyed on the recipient user; `tenantUserId` already scopes the audit row
  // above, so the notification call only needs the recipient + payload.
  if (assigneeId !== null && changed && assigneeId !== actorId) {
    const { type, resourceType } = notificationKindFor(record.object);
    await fireCrmNotification({
      recipientUserId: assigneeId,
      type,
      title: `You were assigned a ${objectLabel}`,
      body: label,
      resourceType,
      resourceId: record._id,
    });
  }

  return { record, previousAssigneeId, changed };
}

/**
 * Reassigns a record to a new workspace member.
 *
 * Thin wrapper over {@link assignRecord} kept for call-site clarity; the
 * underlying write is identical and idempotent on the target assignee.
 */
export async function reassignRecord(
  actor: AssignmentActor,
  recordId: string,
  newAssigneeId: string,
): Promise<AssignResult | null> {
  return assignRecord(actor, recordId, newAssigneeId);
}

/* -------------------------------------------------------------------------- */
/* My assignments                                                             */
/* -------------------------------------------------------------------------- */

function clampPage(page?: number): number {
  if (!page || page < 1) return 1;
  return Math.floor(page);
}

function clampPageSize(pageSize?: number): number {
  if (!pageSize || pageSize <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(pageSize, MAX_PAGE_SIZE);
}

/**
 * Lists records assigned to `userId` within a project, newest-updated first.
 *
 * Scoped by `projectId` + `data.assigneeId` so it returns every record assigned
 * to the user regardless of who created it. Optionally narrowed to a single
 * object slug.
 */
export async function listMyAssignments(
  projectId: string,
  userId: string,
  query: MyAssignmentsQuery = {},
): Promise<MyAssignmentsPage> {
  const col = await sabcrmRecords();

  const filter: Record<string, unknown> = {
    projectId,
    [`data.${ASSIGNEE_FIELD}`]: userId,
  };
  if (query.object) filter.object = query.object;

  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const [rawDocs, total] = await Promise.all([
    col
      .find(filter as unknown as Filter<Record<string, unknown>>)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    col.countDocuments(filter as unknown as Filter<Record<string, unknown>>),
  ]);

  const records = rawDocs.map((doc) =>
    toCrmRecord(doc as Record<string, unknown>),
  );

  return { records, total, page, pageSize };
}
