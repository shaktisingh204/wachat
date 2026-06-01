import "server-only";

/**
 * SabCRM — unified event bus (server-only).
 *
 * `emitSabcrmEvent` is the single call site that every CRM mutation
 * (record create/update/delete, activity create/update/delete, task
 * status change, assignment) must invoke after a successful database
 * write. It fans out — concurrently and fire-and-forget — to:
 *
 *   1. **Outbound webhooks** (`dispatchWebhookEvent` from
 *      `@/lib/webhooks/dispatch`) — delivers a signed HTTP POST to every
 *      active CRM webhook subscription registered for the event name.
 *
 *   2. **Automation engine** (`dispatchAutomations` from
 *      `@/lib/automations/dispatch`) — matches the event against enabled
 *      automations and enqueues any triggered runs via Workflow DevKit.
 *
 *   3. **In-app notifications** (`fireCrmNotification` from
 *      `@/lib/notifications/crm`) — sends a notification to the
 *      appropriate recipient(s) when the event warrants one. Routing
 *      (who to notify + which notification type) is resolved internally.
 *
 * ## Contract
 *
 * - **Never throws.** Every fan-out arm catches its own errors and logs
 *   to stderr so a notification or webhook glitch never unwinds the
 *   already-committed database write.
 * - **Fire-and-forget.** Callers `void emitSabcrmEvent(...)` and do
 *   not await the result; the database mutation is the source of truth.
 * - **Idempotent-safe.** The webhook/automation layers implement their
 *   own deduplication (delivery ledger, `dedupeKey` index); this module
 *   does not add a second layer.
 *
 * ## Where to call it
 *
 * The actions agent wires the actual call. The guidance is:
 *
 * ```
 * // In sabcrm.actions.ts — after every successful lib mutation:
 *
 * // 1. record.create
 * void emitSabcrmEvent(g.ctx.projectId, 'record.created', {
 *   tenantUserId: g.ctx.userId,
 *   objectSlug: object,
 *   recordId: record._id,
 *   record: record as Record<string, unknown>,
 * });
 *
 * // 2. record.update
 * void emitSabcrmEvent(g.ctx.projectId, 'record.updated', {
 *   tenantUserId: g.ctx.userId,
 *   objectSlug: object,
 *   recordId: updated._id,
 *   record: updated as Record<string, unknown>,
 *   changedFields: Object.keys(patch),  // optional diff hint
 * });
 *
 * // 3. record.delete
 * void emitSabcrmEvent(g.ctx.projectId, 'record.deleted', {
 *   tenantUserId: g.ctx.userId,
 *   objectSlug: object,
 *   recordId: id,
 * });
 *
 * // 4. activity.created / activity.updated / activity.deleted
 * void emitSabcrmEvent(g.ctx.projectId, 'activity.created', {
 *   tenantUserId: g.ctx.userId,
 *   objectSlug: activity.targetObject,
 *   recordId: activity.targetRecordId,
 *   activityId: activity._id,
 *   activityType: activity.type,
 *   activityTitle: activity.title,
 * });
 *
 * // 5. record.assigned
 * void emitSabcrmEvent(g.ctx.projectId, 'record.assigned', {
 *   tenantUserId: g.ctx.userId,
 *   objectSlug: object,
 *   recordId: result.record._id,
 *   record: result.record as Record<string, unknown>,
 *   assigneeId: assigneeId ?? undefined,
 *   previousAssigneeId: result.previousAssigneeId ?? undefined,
 *   notifyAssignee: true,  // triggers in-app notification
 * });
 *
 * // 6. task.status_changed
 * void emitSabcrmEvent(g.ctx.projectId, 'task.status_changed', {
 *   tenantUserId: g.ctx.userId,
 *   objectSlug: 'tasks',
 *   recordId: taskId,
 *   activityId: updated._id,
 *   fromValue: oldStatus,
 *   toValue: status,
 * });
 * ```
 *
 * ## Naming convention for `event`
 *
 * Use `<domain>.<verb>` kebab-case:
 *   `record.created` | `record.updated` | `record.deleted`
 *   `record.assigned`
 *   `activity.created` | `activity.updated` | `activity.deleted`
 *   `task.status_changed`
 *   `object.created` | `object.updated` | `object.deleted`
 *   `field.added` | `field.updated` | `field.removed` | `field.reordered`
 *   `view.saved` | `view.deleted`
 *
 * These mirror the CRM_WEBHOOK_EVENTS catalogue; new events can be added
 * by appending to SABCRM_EVENT_NAMES below.
 */

import {
  dispatchWebhookEvent,
} from "@/lib/webhooks/dispatch";
import {
  dispatchAutomations,
} from "@/lib/automations/dispatch";
import {
  fireCrmNotification,
  type CrmNotificationType,
  type CrmResourceType,
} from "@/lib/notifications/crm";
import type {
  AutomationDomainEvent,
  AutomationEntityKind,
  AutomationEventType,
} from "@/lib/automations/types";

/* -------------------------------------------------------------------------- */
/* Event catalogue                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every named SabCRM event. Keep in sync with `CRM_WEBHOOK_EVENTS` in
 * `@/lib/webhooks/dispatch` — the values here are the `eventName` strings
 * passed to `dispatchWebhookEvent`.
 *
 * Naming: `<domain>.<verb>` — matches the webhook event catalogue pattern
 * (`account.created`, `deal.updated`, …) but prefixed with the SabCRM
 * object domain rather than the legacy CRM entity kinds.
 */
export const SABCRM_EVENT_NAMES = [
  "record.created",
  "record.updated",
  "record.deleted",
  "record.assigned",
  "activity.created",
  "activity.updated",
  "activity.deleted",
  "task.status_changed",
  "object.created",
  "object.updated",
  "object.deleted",
  "field.added",
  "field.updated",
  "field.removed",
  "field.reordered",
  "view.saved",
  "view.deleted",
] as const;

/** Union of all SabCRM event name literals. */
export type SabcrmEventName = (typeof SABCRM_EVENT_NAMES)[number];

/* -------------------------------------------------------------------------- */
/* Payload shape                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Event payload passed to `emitSabcrmEvent`. All callers must supply the
 * mandatory fields; the optional fields are progressively enriched per
 * domain. Unmapped keys are forwarded verbatim to the webhook body and the
 * automation entity snapshot.
 *
 * Design notes
 * - `tenantUserId` is the session `user._id` (hex string), matching the
 *   scoping key used by `dispatchAutomations`, `dispatchWebhookEvent`,
 *   `writeAuditEntry`, and `fireCrmNotification`. It is the tenant boundary
 *   across every cross-cutting system.
 * - `objectSlug` is the CRM object slug (e.g. `opportunities`), used to
 *   map the event onto the automation `entityKind` and the notification type.
 * - `recordId` is the hex string id of the primary entity (record, activity,
 *   object-doc, view-doc) to which this event is attached. Always set.
 */
export interface SabcrmEventPayload {
  /** Tenant root user id — `session.user._id`. Required for cross-cutting scoping. */
  tenantUserId: string;

  /**
   * CRM object slug — `opportunities`, `people`, `companies`, or any custom
   * object slug. Used to derive the automation `entityKind`, the webhook
   * event sub-namespace, and the notification resource type.
   */
  objectSlug: string;

  /**
   * Primary entity id (hex string). For record events: the record `_id`.
   * For activity events: the target record `_id` (NOT the activity `_id`).
   * For object/field/view events: the object-doc / view-doc `_id`.
   */
  recordId: string;

  // ── Record fields ──────────────────────────────────────────────────────────

  /**
   * Full record snapshot at the time of the event. Used as the automation
   * entity snapshot (dotted-path conditions) and forwarded in the webhook body.
   * Not required for `deleted` events (the record no longer exists).
   */
  record?: Record<string, unknown>;

  /**
   * Field keys that changed in an `updated` event. Used as the automation
   * `fieldName` hint (the dispatcher picks the first entry for single-field
   * triggers) and as a structured diff in the webhook body. Optional but
   * strongly recommended for `record.updated`.
   */
  changedFields?: string[];

  // ── Assignment fields ──────────────────────────────────────────────────────

  /** New assignee user id (undefined / null = unassigned). */
  assigneeId?: string;

  /** Previous assignee user id before this assignment. */
  previousAssigneeId?: string;

  /**
   * When `true`, `emitSabcrmEvent` fires an in-app notification to the
   * new assignee. Set for `record.assigned` events where the caller knows a
   * human should be notified.
   */
  notifyAssignee?: boolean;

  // ── Activity fields ────────────────────────────────────────────────────────

  /** Activity `_id` (for activity / task events). */
  activityId?: string;

  /** Activity type (NOTE / TASK / CALL / MEETING / EMAIL / COMMENT). */
  activityType?: string;

  /** Activity title / subject — used in notification copy. */
  activityTitle?: string;

  // ── Task / status-change fields ────────────────────────────────────────────

  /** Value before the change (for `status_changed` / `stage_changed` events). */
  fromValue?: unknown;

  /** Value after the change. */
  toValue?: unknown;

  /** Field name that changed (for multi-field update triggers). */
  fieldName?: string;

  // ── Notification routing ───────────────────────────────────────────────────

  /**
   * Explicit recipient user id for the in-app notification. When set, a
   * notification is fired to this user regardless of `notifyAssignee`.
   * For broadcast / team notifications use the `recipientUserIds` list.
   */
  recipientUserId?: string;

  /** Broadcast notification to multiple recipients. */
  recipientUserIds?: string[];

  /** Human-readable notification title override. Auto-derived when absent. */
  notificationTitle?: string;

  /** Human-readable notification body override. Auto-derived when absent. */
  notificationBody?: string;

  // ── Escape hatch ──────────────────────────────────────────────────────────

  /** Arbitrary extra data forwarded verbatim in the webhook body. */
  extra?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Map a SabCRM object slug to the closest `AutomationEntityKind`. Slugs
 * without a direct mapping fall back to `'contact'` (a catch-all that
 * allows trigger matching via the entity snapshot rather than entityKind).
 *
 * Extend this map as new standard objects are added to `schema.ts`.
 */
function slugToEntityKind(slug: string): AutomationEntityKind {
  switch (slug) {
    case "companies":
      return "account";
    case "people":
      return "contact";
    case "opportunities":
      return "deal";
    case "tasks":
    case "activities":
      return "task";
    default:
      // Custom objects — pass through as 'contact' so the automation
      // evaluator can still match `entity_created` / `entity_updated`
      // triggers that don't restrict by entityKind.
      return "contact";
  }
}

/**
 * Map a SabCRM event name to the closest `AutomationEventType`. The
 * automation engine only models a small set of verbs; we collapse the
 * richer SabCRM vocabulary onto them.
 */
function eventNameToAutomationType(name: SabcrmEventName): AutomationEventType {
  switch (name) {
    case "record.created":
    case "activity.created":
    case "object.created":
      return "entity_created";

    case "record.updated":
    case "activity.updated":
    case "record.assigned":
    case "field.added":
    case "field.updated":
    case "field.removed":
    case "field.reordered":
    case "object.updated":
    case "view.saved":
      return "entity_updated";

    case "record.deleted":
    case "activity.deleted":
    case "object.deleted":
    case "view.deleted":
      // Automations don't model 'entity_deleted' — map to entity_updated
      // so any 'entity_updated' trigger with conditions can still match.
      return "entity_updated";

    case "task.status_changed":
      return "status_changed";

    default:
      return "entity_updated";
  }
}

/**
 * Map a SabCRM object slug to the closest `CrmNotificationType` and
 * optional `CrmResourceType`. Mirrors the pattern in `assignment.server.ts`
 * (`notificationKindFor`) but extended to cover the full event surface.
 */
function notificationMetaFor(
  slug: string,
  eventName: SabcrmEventName,
): { type: CrmNotificationType; resourceType?: CrmResourceType } {
  // assignment events — reuse the assign notification types
  if (eventName === "record.assigned") {
    switch (slug) {
      case "tasks":
        return { type: "task_assigned", resourceType: "task" };
      case "opportunities":
        return { type: "deal_assigned", resourceType: "deal" };
      default:
        return { type: "system" };
    }
  }

  // task status change
  if (eventName === "task.status_changed") {
    return { type: "system", resourceType: "task" };
  }

  // mention in comment/activity
  if (
    (eventName === "activity.created" || eventName === "activity.updated") &&
    slug === "activities"
  ) {
    return { type: "mention" };
  }

  // generic fallback
  return { type: "system" };
}

/**
 * Build the automation `AutomationDomainEvent` from the SabCRM event
 * payload so `dispatchAutomations` can trigger-match without knowing
 * SabCRM internals.
 */
function buildAutomationEvent(
  name: SabcrmEventName,
  payload: SabcrmEventPayload,
): AutomationDomainEvent {
  return {
    type: eventNameToAutomationType(name),
    entityKind: slugToEntityKind(payload.objectSlug),
    entityId: payload.activityId ?? payload.recordId,
    tenantUserId: payload.tenantUserId,
    // Use the record snapshot (or a minimal stub) as the entity snapshot.
    entity: (payload.record ?? {
      _id: payload.recordId,
      userId: payload.tenantUserId,
    }) as AutomationDomainEvent["entity"],
    fieldName: payload.fieldName ?? payload.changedFields?.[0],
    fromValue: payload.fromValue,
    toValue: payload.toValue,
    occurredAt: Date.now(),
  };
}

/**
 * Build the outbound webhook payload envelope. Callers receive a
 * structured JSON body that includes the SabCRM-specific metadata plus
 * whatever the caller put in `payload.record`/`payload.extra`.
 */
function buildWebhookBody(
  name: SabcrmEventName,
  projectId: string,
  payload: SabcrmEventPayload,
): Record<string, unknown> {
  return {
    event: name,
    projectId,
    objectSlug: payload.objectSlug,
    recordId: payload.recordId,
    tenantUserId: payload.tenantUserId,
    occurredAt: new Date().toISOString(),
    ...(payload.record ? { record: payload.record } : {}),
    ...(payload.changedFields ? { changedFields: payload.changedFields } : {}),
    ...(payload.activityId ? { activityId: payload.activityId } : {}),
    ...(payload.activityType ? { activityType: payload.activityType } : {}),
    ...(payload.assigneeId != null ? { assigneeId: payload.assigneeId } : {}),
    ...(payload.previousAssigneeId != null
      ? { previousAssigneeId: payload.previousAssigneeId }
      : {}),
    ...(payload.fromValue !== undefined ? { fromValue: payload.fromValue } : {}),
    ...(payload.toValue !== undefined ? { toValue: payload.toValue } : {}),
    ...(payload.extra ?? {}),
  };
}

/**
 * Derive a sensible notification title when the caller hasn't provided one.
 * Short, English-language, human-readable.
 */
function deriveNotificationTitle(
  name: SabcrmEventName,
  payload: SabcrmEventPayload,
): string {
  const slug = payload.objectSlug;
  const id = payload.activityId ?? payload.recordId;

  if (payload.notificationTitle) return payload.notificationTitle;

  switch (name) {
    case "record.assigned":
      return `${slug} assigned to you`;
    case "record.created":
      return `New ${slug} created`;
    case "record.updated":
      return `${slug} updated`;
    case "record.deleted":
      return `${slug} deleted`;
    case "activity.created": {
      const kind = payload.activityType ?? "activity";
      const title = payload.activityTitle ?? id;
      return `New ${kind.toLowerCase()}: ${title}`;
    }
    case "task.status_changed": {
      const to = typeof payload.toValue === "string" ? payload.toValue : "";
      return `Task status changed${to ? ` to ${to}` : ""}`;
    }
    default:
      return `${slug} event: ${name}`;
  }
}

/**
 * Derive a notification body when the caller hasn't provided one. May return
 * `undefined` (notification still fires with title only).
 */
function deriveNotificationBody(
  name: SabcrmEventName,
  payload: SabcrmEventPayload,
): string | undefined {
  if (payload.notificationBody) return payload.notificationBody;

  switch (name) {
    case "record.assigned":
      return payload.previousAssigneeId
        ? `Previously assigned to user ${payload.previousAssigneeId}.`
        : undefined;
    case "task.status_changed":
      if (payload.fromValue !== undefined && payload.toValue !== undefined) {
        return `${String(payload.fromValue)} → ${String(payload.toValue)}`;
      }
      return undefined;
    default:
      return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/* Fan-out arms (each isolated — failures do not affect siblings)            */
/* -------------------------------------------------------------------------- */

async function fanOutWebhook(
  name: SabcrmEventName,
  projectId: string,
  payload: SabcrmEventPayload,
): Promise<void> {
  try {
    // `dispatchWebhookEvent` scopes deliveries by `tenantUserId`. We also
    // pass `projectId` inside the body envelope so receivers can distinguish
    // multi-project tenants.
    const body = buildWebhookBody(name, projectId, payload);
    await dispatchWebhookEvent(payload.tenantUserId, name, body);
  } catch (e) {
    console.error("[sabcrm/events] webhook fan-out error:", e);
  }
}

async function fanOutAutomations(
  name: SabcrmEventName,
  payload: SabcrmEventPayload,
): Promise<void> {
  try {
    const event = buildAutomationEvent(name, payload);
    await dispatchAutomations(event);
  } catch (e) {
    console.error("[sabcrm/events] automations fan-out error:", e);
  }
}

async function fanOutNotifications(
  name: SabcrmEventName,
  payload: SabcrmEventPayload,
): Promise<void> {
  try {
    // Collect recipients.
    const recipientSet = new Set<string>();

    // Explicit single recipient.
    if (payload.recipientUserId) {
      recipientSet.add(payload.recipientUserId);
    }

    // Explicit broadcast list.
    if (Array.isArray(payload.recipientUserIds)) {
      for (const id of payload.recipientUserIds) {
        if (id) recipientSet.add(id);
      }
    }

    // Assignment events: notify the new assignee automatically when
    // `notifyAssignee` is set and we have a resolved assignee id.
    if (
      payload.notifyAssignee &&
      payload.assigneeId &&
      payload.assigneeId !== payload.tenantUserId
    ) {
      recipientSet.add(payload.assigneeId);
    }

    if (recipientSet.size === 0) return;

    const { type, resourceType } = notificationMetaFor(
      payload.objectSlug,
      name,
    );
    const title = deriveNotificationTitle(name, payload);
    const body = deriveNotificationBody(name, payload);

    // Fire to all recipients. Each call is best-effort (fireCrmNotification
    // never throws). We don't await sequentially to avoid one slow send
    // blocking the others.
    await Promise.all(
      [...recipientSet].map((recipientUserId) =>
        fireCrmNotification({
          recipientUserId,
          type,
          title,
          body,
          resourceType,
          resourceId: payload.activityId ?? payload.recordId,
        }),
      ),
    );
  } catch (e) {
    console.error("[sabcrm/events] notifications fan-out error:", e);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Emit a SabCRM domain event and fan it out to the three cross-cutting
 * systems: outbound webhooks, automation engine, and in-app notifications.
 *
 * **Never throws. Always fire-and-forget.** Call as `void emitSabcrmEvent(...)`.
 *
 * @param projectId  SabCRM project id (tenant boundary for this module).
 * @param event      Named SabCRM event (see {@link SabcrmEventName}).
 * @param payload    Structured event payload (see {@link SabcrmEventPayload}).
 *
 * @example
 * // After a successful createRecord() call in sabcrm.actions.ts:
 * void emitSabcrmEvent(g.ctx.projectId, 'record.created', {
 *   tenantUserId: g.ctx.userId,
 *   objectSlug: object,
 *   recordId: record._id,
 *   record: record as Record<string, unknown>,
 * });
 *
 * @example
 * // After a successful assignRecord() call:
 * void emitSabcrmEvent(g.ctx.projectId, 'record.assigned', {
 *   tenantUserId: g.ctx.userId,
 *   objectSlug: result.record.object,
 *   recordId: result.record._id,
 *   record: result.record as Record<string, unknown>,
 *   assigneeId: assigneeId ?? undefined,
 *   previousAssigneeId: result.previousAssigneeId ?? undefined,
 *   notifyAssignee: true,
 * });
 */
export async function emitSabcrmEvent(
  projectId: string,
  event: SabcrmEventName,
  payload: SabcrmEventPayload,
): Promise<void> {
  // Guard: silently skip malformed calls so mutations are never affected.
  if (!projectId || !event || !payload?.tenantUserId || !payload?.objectSlug) {
    console.warn("[sabcrm/events] emitSabcrmEvent: missing required fields", {
      projectId: !!projectId,
      event,
      tenantUserId: !!payload?.tenantUserId,
      objectSlug: !!payload?.objectSlug,
    });
    return;
  }

  // Fan out concurrently. Each arm isolates its own errors.
  await Promise.all([
    fanOutWebhook(event, projectId, payload),
    fanOutAutomations(event, payload),
    fanOutNotifications(event, payload),
  ]);
}
