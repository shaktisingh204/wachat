/**
 * Domain-event → automation dispatcher.
 *
 * Every entity emitter (`saveLead`, `saveDeal`, `saveTask`, …) calls
 * `dispatchAutomations(event)` after a successful save. The dispatcher:
 *
 *  1. Loads enabled, active automations for the tenant from `crm_automations`.
 *  2. Normalises the stored shape (rich Rust-shaped doc) into our slim
 *     `Automation` runtime shape.
 *  3. Filters by `matchesTrigger`.
 *  4. For each match, computes a dedupe key and tries to insert a
 *     `crm_automation_runs` row with `status: 'queued'`. The unique index
 *     on `dedupeKey` prevents the same (automation, entity, event,
 *     hour-bucket) from being processed twice — runaway loops can't
 *     happen even if a buggy automation re-triggers itself.
 *  5. Hands the run off to Workflow DevKit via `tryStartWorkflow`.
 *     If Workflow DevKit isn't installed yet, the run is left in the
 *     log with `status: 'workflow_devkit_missing'` so ops can see it.
 *
 * Failures here MUST NOT propagate — every caller wraps this in a
 * try/catch already, but we also swallow internal errors and log them.
 */

import type { Db } from 'mongodb';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { matchesTrigger } from './evaluate';
import { startAutomationRun } from './workflow-runtime';
import type {
    Automation,
    AutomationDomainEvent,
    AutomationRunLog,
    AutomationTrigger,
    AutomationCondition,
    AutomationAction,
} from './types';

const AUTOMATIONS_COLLECTION = 'crm_automations';
const RUNS_COLLECTION = 'crm_automation_runs';

/* --------------------------------------------------------------------
 * Public entrypoint
 * ------------------------------------------------------------------ */

/**
 * Dispatch a domain event to all matching automations. Safe to call from
 * any save-success hook; it never throws.
 */
export async function dispatchAutomations(
    event: AutomationDomainEvent,
): Promise<void> {
    try {
        if (!event.tenantUserId) return;

        const { db } = await connectToDatabase();
        const automations = await loadEligibleAutomations(db, event);
        if (automations.length === 0) return;

        await Promise.all(
            automations.map(a => dispatchOne(db, a, event).catch(err => {
                console.warn('[automations] dispatchOne failed', {
                    automationId: a._id,
                    err: (err as Error).message,
                });
            })),
        );
    } catch (e) {
        console.warn('[automations] dispatchAutomations top-level failure', {
            err: (e as Error).message,
        });
    }
}

/* --------------------------------------------------------------------
 * One-automation dispatch path
 * ------------------------------------------------------------------ */

async function dispatchOne(
    db: Db,
    automation: Automation,
    event: AutomationDomainEvent,
): Promise<void> {
    if (!matchesTrigger(automation, event)) return;

    const dedupeKey = buildDedupeKey(automation._id, event);
    const startedAt = Date.now();

    // Insert with dedupe. If a duplicate exists, swallow and move on.
    const initialLog: AutomationRunLog = {
        automationId: automation._id,
        userId: automation.userId,
        entityKind: event.entityKind,
        entityId: event.entityId,
        eventType: event.type,
        status: 'queued',
        dedupeKey,
        actions: [],
        startedAt,
    };

    try {
        await db.collection<AutomationRunLog>(RUNS_COLLECTION).insertOne(
            initialLog as AutomationRunLog,
        );
    } catch (e) {
        // E11000 → duplicate. The unique index on `dedupeKey` (created
        // out-of-band in the migration) is doing its job.
        const msg = (e as Error).message ?? '';
        if (/E11000|duplicate key/i.test(msg)) {
            // Already queued for this bucket; nothing to do.
            return;
        }
        // Anything else is an infra problem — bail without enqueueing.
        console.warn('[automations] run-log insert failed', {
            dedupeKey,
            err: msg,
        });
        return;
    }

    // Durable dispatch. `startAutomationRun` is a thin wrapper around
    // `start()` from `workflow/api` (see `workflow-runtime.ts`). We
    // never call the workflow function directly — `start()` registers
    // the run with Workflow DevKit and returns a runId that we persist
    // on the log.
    const result = await startAutomationRun('runAutomation', [
        { automationId: automation._id, eventPayload: event },
    ]);

    // Update the queued row with the workflow runId (or mark as missing).
    const update: Partial<AutomationRunLog> = result.durable
        ? { workflowRunId: result.runId }
        : { status: 'workflow_devkit_missing', finishedAt: Date.now() };

    try {
        await db
            .collection<AutomationRunLog>(RUNS_COLLECTION)
            .updateOne({ dedupeKey }, { $set: update });
    } catch (e) {
        console.warn('[automations] run-log update failed', {
            dedupeKey,
            err: (e as Error).message,
        });
    }
}

/* --------------------------------------------------------------------
 * Dedupe key
 * ------------------------------------------------------------------ */

/**
 * (automationId, entityKind, entityId, eventType, hour-bucket).
 *
 * Hour-bucket = floor(occurredAt / 1h). Prevents the same automation
 * from firing more than once per hour for the same (entity, event) — a
 * pragmatic guard against runaway loops where an `update_field` action
 * re-triggers an `entity_updated` event.
 *
 * Operators who need shorter cycles can lower the bucket size; longer
 * cycles can raise it. The schema is `string` so the index just compares
 * bytes.
 */
export function buildDedupeKey(
    automationId: string,
    event: AutomationDomainEvent,
): string {
    const hourBucket = Math.floor(event.occurredAt / (60 * 60 * 1000));
    return [
        automationId,
        event.entityKind,
        event.entityId,
        event.type,
        hourBucket,
    ].join(':');
}

/* --------------------------------------------------------------------
 * Mongo helpers
 * ------------------------------------------------------------------ */

/**
 * Loads active, enabled automations for the tenant whose trigger.entityKind
 * matches the event's entity. Normalises the stored doc into the slim
 * `Automation` runtime shape.
 */
async function loadEligibleAutomations(
    db: Db,
    event: AutomationDomainEvent,
): Promise<Automation[]> {
    if (!ObjectId.isValid(event.tenantUserId)) return [];

    type StoredAutomation = WithId<Record<string, unknown>> & {
        name?: string;
        description?: string;
        isEnabled?: boolean;
        active?: boolean;
        status?: string;
        trigger?: unknown;
        conditions?: unknown;
        actions?: unknown;
        nodes?: unknown;
        edges?: unknown;
        userId?: ObjectId | string;
        createdAt?: Date;
        updatedAt?: Date;
    };

    const raw = await db
        .collection<StoredAutomation>(AUTOMATIONS_COLLECTION)
        .find({
            userId: new ObjectId(event.tenantUserId),
            // We accept either schema-shape: §6.7 (`isEnabled` + `status`)
            // or the older Rust shape (`active: true`).
            $or: [
                { isEnabled: true, status: 'active' },
                { active: true },
            ],
        })
        .toArray();

    const normalised: Automation[] = [];
    for (const doc of raw) {
        const a = normaliseAutomation(doc);
        if (!a) continue;
        if (a.trigger.config.entityKind !== event.entityKind) continue;
        normalised.push(a);
    }
    return normalised;
}

function normaliseAutomation(
    doc: WithId<Record<string, unknown>>,
): Automation | null {
    const trigger = normaliseTrigger(doc.trigger);
    if (!trigger) return null;

    const conditions = normaliseConditions(doc.conditions);
    const actions = normaliseActions(doc.actions);

    return {
        _id: String(doc._id),
        userId: String(doc.userId ?? ''),
        name: typeof doc.name === 'string' ? doc.name : '(unnamed)',
        description:
            typeof doc.description === 'string' ? doc.description : undefined,
        isEnabled:
            doc.isEnabled === true ||
            (doc.isEnabled === undefined && doc.active === true),
        status:
            (doc.status as Automation['status']) ??
            (doc.active ? 'active' : 'draft'),
        trigger,
        conditions,
        actions,
        createdAt: doc.createdAt instanceof Date ? doc.createdAt : undefined,
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : undefined,
    };
}

function normaliseTrigger(raw: unknown): AutomationTrigger | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    // §6.7 shape: { type, config }
    if (typeof r.type === 'string' && r.config && typeof r.config === 'object') {
        const cfg = r.config as Record<string, unknown>;
        const entityKind = cfg.entityKind;
        if (typeof entityKind !== 'string') return null;
        return {
            type: r.type as AutomationTrigger['type'],
            config: {
                entityKind: entityKind as AutomationTrigger['config']['entityKind'],
                fieldName:
                    typeof cfg.fieldName === 'string' ? cfg.fieldName : undefined,
                fromValue: cfg.fromValue,
                toValue: cfg.toValue,
                elapsedMinutes:
                    typeof cfg.elapsedMinutes === 'number'
                        ? cfg.elapsedMinutes
                        : undefined,
            },
        };
    }
    return null;
}

function normaliseConditions(raw: unknown): AutomationCondition[] {
    if (!Array.isArray(raw)) return [];
    const out: AutomationCondition[] = [];
    for (const c of raw) {
        if (!c || typeof c !== 'object') continue;
        const obj = c as Record<string, unknown>;
        if (typeof obj.kind !== 'string') continue;
        out.push({
            kind: obj.kind as AutomationCondition['kind'],
            field: typeof obj.field === 'string' ? obj.field : undefined,
            value: obj.value,
        });
    }
    return out;
}

function normaliseActions(raw: unknown): AutomationAction[] {
    if (!Array.isArray(raw)) return [];
    const out: AutomationAction[] = [];
    for (const a of raw) {
        if (!a || typeof a !== 'object') continue;
        const obj = a as Record<string, unknown>;
        const kind = obj.kind;
        const config = obj.config;
        if (typeof kind !== 'string' || !config || typeof config !== 'object') continue;
        // Trust the stored shape; the action handlers validate at run time.
        out.push({
            kind: kind as AutomationAction['kind'],
            config: config as never,
        } as AutomationAction);
    }
    return out;
}
