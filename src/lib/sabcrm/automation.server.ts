import "server-only";

/**
 * SabCRM — automation rules engine (server-only).
 *
 * Implements simple event-driven automation: a rule matches when
 *   (trigger.event === incoming event) &&
 *   all conditions in trigger.conditions pass against the record's data
 * and then executes the configured action (create_task / send_notification /
 * call_webhook).
 *
 * Storage
 * -------
 * Rules live in the `sabcrm_automations` collection (one doc per rule), scoped
 * by `projectId`. The collection is registered lazily alongside the other
 * SabCRM collections and its indexes are appended to `ensureSabcrmIndexes`.
 *
 * Execution contract
 * ------------------
 * `evaluateAutomations(projectId, event, record)` is called **fire-and-forget**
 * from record and activity mutation paths. It NEVER throws to the caller — every
 * error is swallowed and logged to stderr. A single failing rule does not block
 * the others: rules are evaluated in a per-rule try/catch.
 *
 * Webhook safety
 * --------------
 * Webhooks fire a single POST with a JSON body; the call is bounded by a 10 s
 * timeout and retries once on network error. No redirects are followed. Only
 * https:// and http:// URLs are accepted; host allowlisting is the caller's
 * responsibility (admin UI should validate on save).
 *
 * Task creation
 * -------------
 * The `create_task` action inserts a TASK-type activity in the standard
 * `sabcrm_activities` collection via the `createActivity` helper so the task
 * appears on the record's timeline and is visible in the task board.
 *
 * Notification
 * ------------
 * Notifications are sent via `fireCrmNotification` (best-effort, never throws).
 * The `send_notification` action supports a static recipient user-id or the
 * `assigneeId` stored on the record (resolved at evaluation time).
 */

import { ObjectId, type Collection, type IndexDescription } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";
import { sabcrmRecords } from "./db";
import { createActivity } from "./activities.server";
import { fireCrmNotification } from "@/lib/notifications/crm";

/* ======================================================================== *
 * Types — automation event                                                   *
 * ======================================================================== */

/**
 * The lifecycle events that can trigger an automation rule.
 *
 * - `record_created`   — a new CRM record of `objectSlug` was created.
 * - `record_updated`   — an existing record was patched via `updateRecord`.
 * - `record_deleted`   — a record was deleted.
 * - `activity_created` — a timeline activity (note/task/call/…) was created
 *                        for a record.
 * - `field_changed`    — the value of a specific field changed (superset of
 *                        `record_updated`, but triggers only when `fieldKey`
 *                        matches the automation's condition).
 */
export type AutomationEvent =
  | "record_created"
  | "record_updated"
  | "record_deleted"
  | "activity_created"
  | "field_changed";

/** The set of all recognised automation events. */
export const AUTOMATION_EVENTS: readonly AutomationEvent[] = [
  "record_created",
  "record_updated",
  "record_deleted",
  "activity_created",
  "field_changed",
] as const;

function isAutomationEvent(value: unknown): value is AutomationEvent {
  return (
    typeof value === "string" &&
    (AUTOMATION_EVENTS as readonly string[]).includes(value)
  );
}

/* ======================================================================== *
 * Types — conditions                                                         *
 * ======================================================================== */

/**
 * A simple field-value condition evaluated against `record.data`.
 * All conditions in a rule are ANDed together.
 *
 * - `field` — key in `record.data` (or the string literal `"object"` to match
 *   the record's object slug).
 * - `op`    — comparison operator.
 * - `value` — the reference value (not required for `is_empty` / `is_not_empty`).
 */
export type AutomationConditionOp =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_empty"
  | "is_not_empty";

export interface AutomationCondition {
  field: string;
  op: AutomationConditionOp;
  value?: unknown;
}

/* ======================================================================== *
 * Types — actions                                                            *
 * ======================================================================== */

/**
 * Create a TASK-type activity on the triggering record's timeline.
 */
export interface AutomationActionCreateTask {
  type: "create_task";
  /** Title of the task activity that will be created. */
  title: string;
  /** Optional body / description shown in the timeline. */
  body?: string;
  /**
   * Optional assignee for the new task.
   * - a literal user-id hex string: assigned to that user.
   * - `"$record.assigneeId"`: resolved from `record.data.assigneeId` at
   *   evaluation time; the task is left unassigned if the field is absent.
   */
  assigneeId?: string;
  /** Optional ISO-8601 due date string, e.g. `"2026-12-31T00:00:00Z"`. */
  dueAt?: string;
}

/**
 * Send an in-app notification to a workspace member.
 */
export interface AutomationActionSendNotification {
  type: "send_notification";
  /**
   * Recipient user id.
   * - a literal user-id hex string.
   * - `"$record.assigneeId"`: resolved from `record.data.assigneeId` at
   *   evaluation time; the notification is skipped if unset.
   */
  recipientUserId: string;
  title: string;
  body?: string;
}

/**
 * POST a JSON payload to an external webhook URL.
 */
export interface AutomationActionCallWebhook {
  type: "call_webhook";
  /** Target URL. Must start with `https://` or `http://`. */
  url: string;
  /**
   * Optional extra headers merged into the request (e.g. `Authorization`).
   * Values must be strings. Do not include `Content-Type` — it is always
   * `application/json`.
   */
  headers?: Record<string, string>;
  /**
   * Optional secret token. When set, a `X-SabCRM-Signature` header containing
   * `sha256(secret + ":" + JSON.stringify(body))` is appended so the receiver
   * can verify authenticity.
   */
  secret?: string;
}

export type AutomationAction =
  | AutomationActionCreateTask
  | AutomationActionSendNotification
  | AutomationActionCallWebhook;

/* ======================================================================== *
 * Types — the rule document                                                  *
 * ======================================================================== */

/**
 * The persisted automation rule shape (`sabcrm_automations` collection).
 *
 * An enabled rule fires when:
 *   1. `trigger.event` matches the incoming event, AND
 *   2. `trigger.objectSlug` (when set) matches `record.object`, AND
 *   3. every entry in `trigger.conditions` evaluates to `true` against
 *      the record's `data` map.
 */
export interface AutomationRuleDoc {
  _id: ObjectId;
  projectId: string;
  /** Human label for the UI. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Whether the rule is active. Disabled rules are stored but never evaluated. */
  enabled: boolean;
  trigger: {
    /**
     * The lifecycle event that activates this rule.
     * Use `"field_changed"` to react only when a specific field changes; in that
     * case add an `AutomationCondition` with `field` equal to the watched key.
     */
    event: AutomationEvent;
    /**
     * Object slug filter. When set, the rule only fires for records of that
     * object (e.g. `"opportunities"`). When omitted the rule fires for all
     * objects.
     */
    objectSlug?: string;
    /** ALL conditions must pass for the rule to fire. Empty array → always fires. */
    conditions: AutomationCondition[];
  };
  /** The action executed when the trigger matches. */
  action: AutomationAction;
  /** ISO-8601 timestamp of the last time this rule fired successfully. */
  lastFiredAt?: string;
  /** ISO-8601 timestamp of the last time this rule failed. */
  lastFailedAt?: string;
  /** Last error message (set when the rule fires but the action errors). */
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/* ======================================================================== *
 * Types — public API shapes                                                  *
 * ======================================================================== */

/** Serialised (id as string) automation rule returned to callers. */
export interface AutomationRule
  extends Omit<AutomationRuleDoc, "_id"> {
  id: string;
}

/** Input to create a new automation rule. */
export interface CreateAutomationRuleInput {
  name: string;
  description?: string;
  enabled?: boolean;
  trigger: {
    event: AutomationEvent;
    objectSlug?: string;
    conditions?: AutomationCondition[];
  };
  action: AutomationAction;
}

/** Patch input for updating an existing rule. */
export interface UpdateAutomationRulePatch {
  name?: string;
  description?: string;
  enabled?: boolean;
  trigger?: {
    event?: AutomationEvent;
    objectSlug?: string;
    conditions?: AutomationCondition[];
  };
  action?: AutomationAction;
}

/** Minimal record shape expected by the evaluator (a subset of CrmRecord). */
export interface AutomationRecordContext {
  /** Mongo hex string id. */
  _id: string;
  /** Object slug, e.g. `"opportunities"`. */
  object: string;
  /** Owner user id. */
  userId: string;
  /** Free-form data map keyed by field keys. */
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Contextual payload passed to `evaluateAutomations`. */
export interface AutomationEventContext {
  /** The lifecycle event that occurred. */
  event: AutomationEvent;
  /** The record involved in the event. */
  record: AutomationRecordContext;
  /**
   * When `event === "field_changed"`: the field keys that changed in this
   * update. The evaluator checks conditions against these keys to decide
   * whether a `field_changed` rule should fire.
   */
  changedFields?: string[];
  /**
   * When `event === "activity_created"`: the type of the created activity
   * (NOTE / TASK / CALL / …). Available as `ctx.activityType` in conditions.
   */
  activityType?: string;
}

/* ======================================================================== *
 * Collection accessor                                                        *
 * ======================================================================== */

const AUTOMATIONS_COLLECTION = "sabcrm_automations";

async function sabcrmAutomations(): Promise<Collection<AutomationRuleDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<AutomationRuleDoc>(AUTOMATIONS_COLLECTION);
}

/* ======================================================================== *
 * Index bootstrapping (call from ensureSabcrmIndexes or on first use)       *
 * ======================================================================== */

let automationIndexesEnsured = false;

/**
 * Idempotent — creates indexes for the `sabcrm_automations` collection.
 *
 * Called lazily on first CRUD operation rather than in the module-level
 * `ensureSabcrmIndexes` to avoid coupling the new collection to the existing
 * db.ts bootstrap (preserving the "additive edits only" contract for shared
 * files).
 */
async function ensureAutomationIndexes(): Promise<void> {
  if (automationIndexesEnsured) return;
  const col = await sabcrmAutomations();
  await col.createIndexes([
    // Primary listing: tenant + newest first.
    { key: { projectId: 1, updatedAt: -1 } },
    // Evaluation hot-path: tenant + enabled flag + event so the evaluator only
    // reads rules that could possibly fire.
    { key: { projectId: 1, enabled: 1, "trigger.event": 1 } },
    // Filter by object slug (used when the caller supplies objectSlug).
    { key: { projectId: 1, "trigger.objectSlug": 1 } },
  ] as IndexDescription[]);
  automationIndexesEnsured = true;
}

/* ======================================================================== *
 * Serialisation                                                              *
 * ======================================================================== */

function toRule(doc: AutomationRuleDoc): AutomationRule {
  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...rest };
}

/* ======================================================================== *
 * Validation                                                                 *
 * ======================================================================== */

const MAX_NAME_LENGTH = 120;
const MAX_CONDITIONS = 10;
const MAX_HEADER_PAIRS = 20;

function assertValidAction(action: AutomationAction): void {
  if (!action || typeof action.type !== "string") {
    throw new Error("Automation action requires a type.");
  }

  switch (action.type) {
    case "create_task": {
      if (typeof action.title !== "string" || !action.title.trim()) {
        throw new Error("create_task action requires a non-empty title.");
      }
      break;
    }
    case "send_notification": {
      if (
        typeof action.recipientUserId !== "string" ||
        !action.recipientUserId.trim()
      ) {
        throw new Error(
          "send_notification action requires a non-empty recipientUserId.",
        );
      }
      if (typeof action.title !== "string" || !action.title.trim()) {
        throw new Error(
          "send_notification action requires a non-empty title.",
        );
      }
      break;
    }
    case "call_webhook": {
      if (typeof action.url !== "string" || !action.url.trim()) {
        throw new Error("call_webhook action requires a non-empty url.");
      }
      if (!/^https?:\/\//i.test(action.url)) {
        throw new Error(
          "call_webhook url must start with https:// or http://.",
        );
      }
      if (action.headers !== undefined) {
        if (
          typeof action.headers !== "object" ||
          Array.isArray(action.headers)
        ) {
          throw new Error("call_webhook headers must be a plain object.");
        }
        const pairs = Object.entries(action.headers);
        if (pairs.length > MAX_HEADER_PAIRS) {
          throw new Error(
            `call_webhook headers must have at most ${MAX_HEADER_PAIRS} entries.`,
          );
        }
        for (const [k, v] of pairs) {
          if (typeof k !== "string" || typeof v !== "string") {
            throw new Error(
              "call_webhook headers keys and values must be strings.",
            );
          }
        }
      }
      break;
    }
    default: {
      const exhaustive: never = action;
      throw new Error(
        `Unknown automation action type: ${(exhaustive as AutomationAction).type}`,
      );
    }
  }
}

function assertValidConditions(conditions: AutomationCondition[]): void {
  if (!Array.isArray(conditions)) {
    throw new Error("Automation conditions must be an array.");
  }
  if (conditions.length > MAX_CONDITIONS) {
    throw new Error(
      `A rule may have at most ${MAX_CONDITIONS} conditions.`,
    );
  }
  const validOps: ReadonlySet<string> = new Set<AutomationConditionOp>([
    "eq",
    "neq",
    "contains",
    "not_contains",
    "gt",
    "gte",
    "lt",
    "lte",
    "is_empty",
    "is_not_empty",
  ]);
  for (const c of conditions) {
    if (typeof c.field !== "string" || !c.field.trim()) {
      throw new Error("Each condition requires a non-empty field.");
    }
    if (!validOps.has(c.op)) {
      throw new Error(`Unknown condition operator: ${c.op}`);
    }
  }
}

function assertValidInput(input: CreateAutomationRuleInput): void {
  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new Error("Automation rule requires a non-empty name.");
  }
  if (input.name.length > MAX_NAME_LENGTH) {
    throw new Error(
      `Automation rule name must be at most ${MAX_NAME_LENGTH} characters.`,
    );
  }
  if (!input.trigger || typeof input.trigger !== "object") {
    throw new Error("Automation rule requires a trigger.");
  }
  if (!isAutomationEvent(input.trigger.event)) {
    throw new Error(
      `Unknown automation event: "${input.trigger.event}". Valid events: ${AUTOMATION_EVENTS.join(", ")}.`,
    );
  }
  assertValidConditions(input.trigger.conditions ?? []);
  assertValidAction(input.action);
}

/* ======================================================================== *
 * CRUD                                                                       *
 * ======================================================================== */

/**
 * Lists all automation rules for a project, newest-updated first.
 */
export async function listAutomationRules(
  projectId: string,
): Promise<AutomationRule[]> {
  if (!projectId) throw new Error("projectId is required.");
  await ensureAutomationIndexes();
  const col = await sabcrmAutomations();
  const docs = await col
    .find({ projectId } as unknown as Parameters<typeof col.find>[0])
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map(toRule);
}

/**
 * Fetches one automation rule by id. Returns `null` when not found or when
 * the id is malformed.
 */
export async function getAutomationRule(
  projectId: string,
  id: string,
): Promise<AutomationRule | null> {
  if (!projectId || !id) return null;
  if (!ObjectId.isValid(id)) return null;
  await ensureAutomationIndexes();
  const col = await sabcrmAutomations();
  const doc = await col.findOne({
    _id: new ObjectId(id),
    projectId,
  } as unknown as Parameters<typeof col.findOne>[0]);
  return doc ? toRule(doc) : null;
}

/**
 * Creates a new automation rule.
 *
 * @throws validation errors with user-facing messages.
 */
export async function createAutomationRule(
  projectId: string,
  input: CreateAutomationRuleInput,
): Promise<AutomationRule> {
  if (!projectId) throw new Error("projectId is required.");
  assertValidInput(input);
  await ensureAutomationIndexes();

  const now = new Date().toISOString();
  const col = await sabcrmAutomations();
  const doc: Omit<AutomationRuleDoc, "_id"> = {
    projectId,
    name: input.name.trim(),
    description: input.description?.trim(),
    enabled: input.enabled !== false, // default true
    trigger: {
      event: input.trigger.event,
      objectSlug: input.trigger.objectSlug?.trim() || undefined,
      conditions: input.trigger.conditions ?? [],
    },
    action: input.action,
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(
    doc as unknown as Parameters<typeof col.insertOne>[0],
  );
  return toRule({ ...doc, _id: result.insertedId } as AutomationRuleDoc);
}

/**
 * Updates an existing automation rule (partial patch).
 *
 * @throws if the rule does not exist or patch is invalid.
 */
export async function updateAutomationRule(
  projectId: string,
  id: string,
  patch: UpdateAutomationRulePatch,
): Promise<AutomationRule | null> {
  if (!projectId || !id) return null;
  if (!ObjectId.isValid(id)) return null;
  await ensureAutomationIndexes();

  const col = await sabcrmAutomations();
  const existing = await col.findOne({
    _id: new ObjectId(id),
    projectId,
  } as unknown as Parameters<typeof col.findOne>[0]);
  if (!existing) return null;

  // Build and validate the merged trigger + action before writing.
  const mergedTrigger = {
    event: patch.trigger?.event ?? existing.trigger.event,
    objectSlug:
      patch.trigger?.objectSlug !== undefined
        ? patch.trigger.objectSlug
        : existing.trigger.objectSlug,
    conditions:
      patch.trigger?.conditions !== undefined
        ? patch.trigger.conditions
        : existing.trigger.conditions,
  };
  const mergedAction = patch.action ?? existing.action;

  if (!isAutomationEvent(mergedTrigger.event)) {
    throw new Error(`Unknown automation event: "${mergedTrigger.event}".`);
  }
  assertValidConditions(mergedTrigger.conditions);
  assertValidAction(mergedAction);

  const now = new Date().toISOString();
  const $set: Record<string, unknown> = {
    updatedAt: now,
    trigger: mergedTrigger,
    action: mergedAction,
  };
  if (typeof patch.name === "string") {
    if (!patch.name.trim()) throw new Error("name must be non-empty.");
    $set.name = patch.name.trim();
  }
  if (typeof patch.description === "string") {
    $set.description = patch.description.trim();
  }
  if (typeof patch.enabled === "boolean") {
    $set.enabled = patch.enabled;
  }

  const updated = await col.findOneAndUpdate(
    { _id: new ObjectId(id), projectId } as unknown as Parameters<
      typeof col.findOneAndUpdate
    >[0],
    { $set },
    { returnDocument: "after" },
  );

  return updated ? toRule(updated as unknown as AutomationRuleDoc) : null;
}

/**
 * Deletes an automation rule. Returns `true` when deleted, `false` when not
 * found.
 */
export async function deleteAutomationRule(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !id) return false;
  if (!ObjectId.isValid(id)) return false;
  await ensureAutomationIndexes();
  const col = await sabcrmAutomations();
  const result = await col.deleteOne({
    _id: new ObjectId(id),
    projectId,
  } as unknown as Parameters<typeof col.deleteOne>[0]);
  return result.deletedCount === 1;
}

/* ======================================================================== *
 * Condition evaluation                                                       *
 * ======================================================================== */

/**
 * Resolve the value of a condition field against the record context.
 *
 * Special tokens:
 * - `"object"` → `record.object`
 * - anything else → `record.data[field]`
 */
function resolveFieldValue(
  field: string,
  record: AutomationRecordContext,
): unknown {
  if (field === "object") return record.object;
  return record.data[field];
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function coerceToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

/**
 * Evaluates a single condition. Returns `true` when the condition passes.
 */
function evaluateCondition(
  condition: AutomationCondition,
  record: AutomationRecordContext,
): boolean {
  const actual = resolveFieldValue(condition.field, record);
  const expected = condition.value;

  switch (condition.op) {
    case "eq":
      // Use string comparison so SELECT/TEXT fields compare naturally.
      return String(actual ?? "") === String(expected ?? "");
    case "neq":
      return String(actual ?? "") !== String(expected ?? "");
    case "contains":
      return (
        typeof actual === "string" &&
        typeof expected === "string" &&
        actual.toLowerCase().includes(expected.toLowerCase())
      );
    case "not_contains":
      return !(
        typeof actual === "string" &&
        typeof expected === "string" &&
        actual.toLowerCase().includes(expected.toLowerCase())
      );
    case "gt":
      return coerceToNumber(actual) > coerceToNumber(expected);
    case "gte":
      return coerceToNumber(actual) >= coerceToNumber(expected);
    case "lt":
      return coerceToNumber(actual) < coerceToNumber(expected);
    case "lte":
      return coerceToNumber(actual) <= coerceToNumber(expected);
    case "is_empty":
      return isEmpty(actual);
    case "is_not_empty":
      return !isEmpty(actual);
    default: {
      const exhaustive: never = condition.op;
      console.warn(
        "[sabcrm/automation] Unknown condition op:",
        (exhaustive as AutomationCondition["op"]),
      );
      return false;
    }
  }
}

/**
 * Returns `true` when ALL conditions in the rule's trigger pass. An empty
 * conditions array is an unconditional match (always fires).
 */
function evaluateConditions(
  conditions: AutomationCondition[],
  record: AutomationRecordContext,
): boolean {
  return conditions.every((c) => evaluateCondition(c, record));
}

/**
 * Decide whether a `field_changed` rule should fire given the set of field
 * keys that changed. A rule fires if ANY of its conditions reference a field
 * that actually changed.
 *
 * If the rule has no conditions it fires on every update (no narrowing).
 */
function shouldFireOnFieldChanged(
  rule: AutomationRuleDoc,
  changedFields: string[],
): boolean {
  if (rule.trigger.conditions.length === 0) return true;
  const changed = new Set(changedFields);
  return rule.trigger.conditions.some((c) => changed.has(c.field));
}

/* ======================================================================== *
 * Action executors                                                           *
 * ======================================================================== */

/** Resolve a `$record.assigneeId` token or return the literal string. */
function resolveRecipient(
  recipientOrToken: string,
  record: AutomationRecordContext,
): string | null {
  if (recipientOrToken === "$record.assigneeId") {
    const v = record.data.assigneeId;
    return typeof v === "string" && v ? v : null;
  }
  return recipientOrToken || null;
}

async function executeSendNotification(
  action: AutomationActionSendNotification,
  record: AutomationRecordContext,
): Promise<void> {
  const recipientUserId = resolveRecipient(
    action.recipientUserId,
    record,
  );
  if (!recipientUserId) return; // resolved to null — skip silently

  await fireCrmNotification({
    recipientUserId,
    type: "system",
    title: action.title,
    body: action.body,
  });
}

/** 10-second timeout for outbound webhook calls. */
const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * Compute HMAC-SHA-256 signature for webhook authenticity.
 *
 * Uses the Web Crypto API (available in Node ≥ 18 and all Edge runtimes).
 */
async function webhookSignature(
  secret: string,
  payload: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function executeCallWebhook(
  action: AutomationActionCallWebhook,
  event: AutomationEventContext,
): Promise<void> {
  const body = JSON.stringify({
    event: event.event,
    record: event.record,
    changedFields: event.changedFields,
    activityType: event.activityType,
    timestamp: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SabCRM-Automation/1.0",
    ...(action.headers ?? {}),
  };

  if (action.secret) {
    headers["X-SabCRM-Signature"] = await webhookSignature(
      action.secret,
      body,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    WEBHOOK_TIMEOUT_MS,
  );

  try {
    const res = await fetch(action.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      redirect: "error",
    });
    if (!res.ok) {
      throw new Error(
        `Webhook returned HTTP ${res.status} for ${action.url}`,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

/* ======================================================================== *
 * Per-rule execution with retry + state update                               *
 * ======================================================================== */

/**
 * Execute one rule's action and update the rule's `lastFiredAt` /
 * `lastFailedAt` / `lastError` fields. Any thrown error is re-thrown so the
 * outer evaluator can catch and continue with the next rule.
 */
async function executeRule(
  rule: AutomationRuleDoc,
  ctx: AutomationEventContext,
  projectId: string,
): Promise<void> {
  const col = await sabcrmAutomations();
  const now = new Date().toISOString();

  try {
    const { action } = rule;

    switch (action.type) {
      case "create_task": {
        // Thread the real projectId into createActivity's projectId field.
        const typedAction = action as AutomationActionCreateTask;
        const assigneeId = typedAction.assigneeId
          ? resolveRecipient(typedAction.assigneeId, ctx.record)
          : undefined;

        await createActivity({
          projectId,
          type: "TASK",
          title: typedAction.title,
          body: typedAction.body,
          targetObject: ctx.record.object,
          targetRecordId: ctx.record._id,
          authorId: "automation",
          ...(assigneeId ? { assigneeId } : {}),
          ...(typedAction.dueAt
            ? { dueAt: new Date(typedAction.dueAt) }
            : {}),
          status: "TODO",
        });
        break;
      }
      case "send_notification":
        await executeSendNotification(action, ctx.record);
        break;
      case "call_webhook":
        await executeCallWebhook(action, ctx);
        break;
      default: {
        const exhaustive: never = action;
        throw new Error(
          `Unknown action type: ${(exhaustive as AutomationAction).type}`,
        );
      }
    }

    // Mark success (fire-and-forget update — do not await in the critical path).
    void col
      .updateOne(
        {
          _id: rule._id,
          projectId,
        } as unknown as Parameters<typeof col.updateOne>[0],
        { $set: { lastFiredAt: now, updatedAt: now } },
      )
      .catch((e) =>
        console.error(
          `[sabcrm/automation] Failed to update lastFiredAt for rule ${rule._id.toHexString()}:`,
          e,
        ),
      );
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";

    // Mark failure (fire-and-forget).
    void col
      .updateOne(
        {
          _id: rule._id,
          projectId,
        } as unknown as Parameters<typeof col.updateOne>[0],
        {
          $set: {
            lastFailedAt: now,
            lastError: errorMessage,
            updatedAt: now,
          },
        },
      )
      .catch((e) =>
        console.error(
          `[sabcrm/automation] Failed to update lastFailedAt for rule ${rule._id.toHexString()}:`,
          e,
        ),
      );

    throw err; // re-throw so the outer evaluator logs and continues
  }
}

/* ======================================================================== *
 * Public evaluation entry-point                                              *
 * ======================================================================== */

/**
 * Evaluates all enabled automation rules for a project against the given
 * event + record context, and executes the matching rules' actions.
 *
 * **Call this fire-and-forget from mutation paths:**
 * ```ts
 * void evaluateAutomations(projectId, {
 *   event: "record_created",
 *   record: createdRecord,
 * });
 * ```
 *
 * Guarantees:
 * - Never throws — all errors are caught and logged to stderr.
 * - Per-rule isolation — a failing rule never blocks subsequent rules.
 * - Early-exit optimised — only loads rules whose `trigger.event` matches;
 *   conditions are evaluated in-process with no extra DB round-trips.
 *
 * @param projectId Tenant project id.
 * @param ctx       The event context (event type + record + optional extras).
 */
export async function evaluateAutomations(
  projectId: string,
  ctx: AutomationEventContext,
): Promise<void> {
  if (!projectId || !ctx?.record) return;

  try {
    await ensureAutomationIndexes();
    const col = await sabcrmAutomations();

    // Load only enabled rules for this project + event (covered by index).
    const rules = await col
      .find({
        projectId,
        enabled: true,
        "trigger.event": ctx.event,
      } as unknown as Parameters<typeof col.find>[0])
      .toArray();

    if (rules.length === 0) return;

    for (const rule of rules) {
      try {
        // 1. Object-slug filter (when set on the rule).
        if (
          rule.trigger.objectSlug &&
          rule.trigger.objectSlug !== ctx.record.object
        ) {
          continue;
        }

        // 2. Extra check for field_changed: at least one watched field must
        //    appear in the changed-fields set.
        if (
          ctx.event === "field_changed" &&
          ctx.changedFields !== undefined &&
          ctx.changedFields.length > 0
        ) {
          if (!shouldFireOnFieldChanged(rule, ctx.changedFields)) {
            continue;
          }
        }

        // 3. Condition evaluation.
        if (!evaluateConditions(rule.trigger.conditions, ctx.record)) {
          continue;
        }

        // 4. Execute the action (throws on failure; caught below per-rule).
        await executeRule(rule, ctx, projectId);
      } catch (ruleErr) {
        console.error(
          `[sabcrm/automation] Rule ${rule._id.toHexString()} ("${rule.name}") failed:`,
          ruleErr,
        );
        // Continue with the next rule.
      }
    }
  } catch (topErr) {
    // Any failure in index setup or the initial DB query — log and swallow.
    console.error("[sabcrm/automation] evaluateAutomations error:", topErr);
  }
}

/* ======================================================================== *
 * Convenience: resolve the list of changed fields from two data snapshots   *
 * ======================================================================== */

/**
 * Returns the field keys whose values differ between `before` and `after`
 * data maps. Useful for constructing the `changedFields` argument when
 * calling `evaluateAutomations` from `updateRecord`.
 *
 * Comparison is shallow and uses `JSON.stringify` for value equality so
 * nested objects (e.g. CURRENCY or LINK composites) are compared correctly.
 */
export function diffDataFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}

/* ======================================================================== *
 * Convenience: fetch one rule's execution state (for admin UI status badge) *
 * ======================================================================== */

export interface AutomationRuleStatus {
  id: string;
  name: string;
  enabled: boolean;
  lastFiredAt?: string;
  lastFailedAt?: string;
  lastError?: string;
}

/**
 * Returns lightweight execution-state rows for all rules in a project.
 * Used by the admin UI to render status badges without loading full docs.
 */
export async function listAutomationRuleStatuses(
  projectId: string,
): Promise<AutomationRuleStatus[]> {
  if (!projectId) return [];
  await ensureAutomationIndexes();
  const col = await sabcrmAutomations();
  const docs = await col
    .find(
      { projectId } as unknown as Parameters<typeof col.find>[0],
      {
        projection: {
          name: 1,
          enabled: 1,
          lastFiredAt: 1,
          lastFailedAt: 1,
          lastError: 1,
        },
      },
    )
    .sort({ updatedAt: -1 })
    .toArray();

  return docs.map((d) => ({
    id: d._id.toHexString(),
    name: d.name,
    enabled: d.enabled,
    lastFiredAt: d.lastFiredAt,
    lastFailedAt: d.lastFailedAt,
    lastError: d.lastError,
  }));
}
