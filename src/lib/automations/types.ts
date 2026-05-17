/**
 * SabNode CRM Automations — engine types.
 *
 * Mirrors the data model from `rust/crates/crm-sales-crm-types/src/automation.rs`
 * and CRM_REBUILD_PLAN.md §6.7, but expressed in the slimmer "minimum
 * viable" shape the engine consumes at runtime.
 *
 * Storage shape on Mongo (`crm_automations`) still uses the richer Rust
 * schema (Trigger / Action / Condition tagged enums). The engine normalises
 * stored documents into the {AutomationTrigger, AutomationCondition,
 * AutomationAction} shapes defined here before evaluating / dispatching.
 *
 * Triggers are domain events emitted by entity actions
 * (saveLead / saveDeal / saveTask). See `src/lib/automations/dispatch.ts`.
 */

import type { ObjectId } from 'mongodb';

/* --------------------------------------------------------------------
 * Domain events (input to the dispatcher)
 * ------------------------------------------------------------------ */

/**
 * The kinds of CRM entities the engine knows about today. Add to this
 * union as new entity emitters get wired up.
 */
export type AutomationEntityKind =
    | 'lead'
    | 'deal'
    | 'task'
    | 'contact'
    | 'account'
    | 'invoice'
    | 'form_submission';

/**
 * The kinds of domain events an entity emits. Triggers match against
 * `type` plus optional config (e.g. for `status_changed` we also look at
 * `fromValue` / `toValue`).
 */
export type AutomationEventType =
    | 'entity_created'
    | 'entity_updated'
    | 'status_changed'
    | 'stage_changed'
    | 'time_elapsed';

/**
 * One snapshot of a CRM entity carried alongside a domain event. The
 * dispatcher uses this for trigger matching (e.g. `field_equals`
 * conditions) and the workflow uses it to render action templates.
 *
 * Kept loose (`Record<string, unknown>`) on purpose — different entity
 * kinds have wildly different shapes and the evaluator only ever does
 * dotted-path lookups.
 */
export type AutomationEntitySnapshot = Record<string, unknown> & {
    _id?: ObjectId | string;
    userId?: ObjectId | string;
};

export interface AutomationDomainEvent {
    type: AutomationEventType;
    entityKind: AutomationEntityKind;
    entityId: string;
    /** Tenant / user scope. Filters which automations are eligible. */
    tenantUserId: string;
    /** Snapshot of the entity at the time the event fired. */
    entity: AutomationEntitySnapshot;
    /** Field that changed (for status_changed / stage_changed). */
    fieldName?: string;
    fromValue?: unknown;
    toValue?: unknown;
    /** How long the entity has been in its current state (minutes). */
    elapsedMinutes?: number;
    /** Wall-clock when the event was emitted, ms since epoch. */
    occurredAt: number;
}

/* --------------------------------------------------------------------
 * Trigger
 * ------------------------------------------------------------------ */

export type AutomationTriggerType =
    | 'entity_created'
    | 'entity_updated'
    | 'status_changed'
    | 'time_elapsed';

export interface AutomationTrigger {
    type: AutomationTriggerType;
    config: {
        entityKind: AutomationEntityKind;
        /** Only match when this field changed (status_changed). */
        fieldName?: string;
        /** Only match when the field went from this value... */
        fromValue?: unknown;
        /** ...to this value. */
        toValue?: unknown;
        /** Only match when the entity has been in its state ≥N minutes. */
        elapsedMinutes?: number;
    };
}

/* --------------------------------------------------------------------
 * Conditions
 * ------------------------------------------------------------------ */

export type AutomationConditionKind =
    | 'field_equals'
    | 'field_in'
    | 'has_tag'
    | 'in_stage';

export interface AutomationCondition {
    kind: AutomationConditionKind;
    /** Dotted path on the entity snapshot, e.g. `"source"` or `"contact.email"`. */
    field?: string;
    /**
     * RHS. For `field_in` / `has_tag` we accept an array. For everything
     * else it's a scalar.
     */
    value: unknown;
}

/* --------------------------------------------------------------------
 * Actions
 * ------------------------------------------------------------------ */

export type AutomationActionKind =
    | 'send_email'
    | 'create_task'
    | 'update_field'
    | 'webhook';

export interface SendEmailActionConfig {
    /** Resolved recipient (email address). The engine renders templated
     *  recipients before queueing. */
    to: string;
    subject: string;
    /** Body — plaintext for now. HTML template support is a wiring TODO. */
    body: string;
    /** Optional reference to a stored CrmEmailTemplate. */
    templateId?: string;
}

export interface CreateTaskActionConfig {
    title: string;
    description?: string;
    /** ISO duration days; due = now + dueInDays * 24h. */
    dueInDays?: number;
    priority?: 'High' | 'Medium' | 'Low';
    type?: 'Call' | 'Meeting' | 'Follow-up' | 'WhatsApp' | 'Email';
    /** ObjectId string of the assignee. Defaults to the entity owner. */
    assignedTo?: string;
    /** Link the new task back to the triggering entity. */
    linkedKind?: 'lead' | 'deal' | 'contact';
    linkedId?: string;
}

export interface UpdateFieldActionConfig {
    /** Top-level field name to overwrite on the triggering entity. */
    field: string;
    value: unknown;
}

export interface WebhookActionConfig {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    /** JSON-serialisable body. The engine appends `{ entity, event }` if absent. */
    body?: unknown;
}

export type AutomationAction =
    | { kind: 'send_email'; config: SendEmailActionConfig }
    | { kind: 'create_task'; config: CreateTaskActionConfig }
    | { kind: 'update_field'; config: UpdateFieldActionConfig }
    | { kind: 'webhook'; config: WebhookActionConfig };

/* --------------------------------------------------------------------
 * Automation document
 * ------------------------------------------------------------------ */

export type AutomationStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface Automation {
    _id: string;
    /** Tenant / user scope. */
    userId: string;
    name: string;
    description?: string;
    /** Master on/off switch. Defaults to `false` for new automations. */
    isEnabled: boolean;
    status: AutomationStatus;
    trigger: AutomationTrigger;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
    createdAt?: Date;
    updatedAt?: Date;
}

/* --------------------------------------------------------------------
 * Run log (`crm_automation_runs`)
 * ------------------------------------------------------------------ */

export type AutomationRunStatus =
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'skipped_conditions'
    | 'skipped_duplicate'
    | 'workflow_devkit_missing';

export interface AutomationRunActionResult {
    kind: AutomationActionKind;
    success: boolean;
    error?: string;
    summary?: string;
    /** ms since epoch. */
    finishedAt: number;
}

export interface AutomationRunLog {
    automationId: string;
    userId: string;
    entityKind: AutomationEntityKind;
    entityId: string;
    eventType: AutomationEventType;
    status: AutomationRunStatus;
    /** dedupe key: see dispatch.ts `buildDedupeKey`. */
    dedupeKey: string;
    workflowRunId?: string;
    actions: AutomationRunActionResult[];
    error?: string;
    startedAt: number;
    finishedAt?: number;
}
