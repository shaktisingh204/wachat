/**
 * Durable workflow that executes one automation run.
 *
 * Per the bundled Workflow DevKit docs in `node_modules/workflow/docs/`:
 *   - A function tagged `"use workflow"` is the durable orchestrator. It
 *     runs in a sandboxed VM and may ONLY call other steps / workflow
 *     primitives (`sleep`, `createHook`). No fetch, fs, crypto.
 *   - A function tagged `"use step"` has full Node.js access, runs
 *     once per invocation, is automatically retried on failure, and has
 *     its return value persisted so re-running the workflow doesn't
 *     re-execute completed work.
 *
 * The shape below follows the canonical pattern: a thin workflow body
 * that just orchestrates `"use step"` functions.
 *
 * Triggered exclusively via `start(runAutomation, [...])` — see
 * `src/lib/automations/workflow-runtime.ts#startAutomationRun`.
 */

// `workflow` is an optional runtime dependency until
// `npm install workflow @workflow/next` is run (see
// docs/ops/automations-engine.md §8). We dynamic-import the symbols we
// need from `workflow` at workflow-load time so TypeScript can compile
// even when the package isn't installed yet. Once it is, this stub
// disappears in favour of `import { sleep } from 'workflow'`.
//
// IMPORTANT: per Workflow DevKit docs, `sleep` is a workflow primitive
// — it MUST be the one imported from `workflow`, not a plain
// `setTimeout`. Plain setTimeout is forbidden inside `"use workflow"`.
async function sleep(_duration: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const dynamicImport = new Function(
        'm',
        'return import(m)',
    ) as (m: string) => Promise<{ sleep?: (d: string) => Promise<void> }>;
    try {
        const mod = await dynamicImport('workflow');
        if (typeof mod.sleep === 'function') {
            await mod.sleep(_duration);
            return;
        }
    } catch {
        /* fall through to no-op */
    }
    console.warn(
        '[automation-run] sleep() called but `workflow` package missing — no-op. '
            + 'Install `workflow` to enable durable sleep.',
        { duration: _duration },
    );
}

import type {
    Automation,
    AutomationAction,
    AutomationActionKind,
    AutomationDomainEvent,
    AutomationEntitySnapshot,
    AutomationRunActionResult,
    AutomationRunLog,
    AutomationRunStatus,
} from '@/lib/automations/types';
import { passesConditions } from '@/lib/automations/evaluate';

import { sendEmailAction } from '@/lib/automations/actions/send-email';
import { createTaskAction } from '@/lib/automations/actions/create-task';
import { updateFieldAction } from '@/lib/automations/actions/update-field';
import { webhookAction } from '@/lib/automations/actions/webhook';

/* --------------------------------------------------------------------
 * Workflow input
 * ------------------------------------------------------------------ */

export interface RunAutomationInput {
    automationId: string;
    eventPayload: AutomationDomainEvent;
}

/* --------------------------------------------------------------------
 * Step: load automation + entity
 * ------------------------------------------------------------------ */

interface LoadedContext {
    automation: Automation | null;
    entity: AutomationEntitySnapshot | null;
}

async function loadAutomationAndEntity(
    input: RunAutomationInput,
): Promise<LoadedContext> {
    'use step';

    console.log('[automation-run] step:load enter', {
        automationId: input.automationId,
        entityKind: input.eventPayload.entityKind,
        entityId: input.eventPayload.entityId,
        eventType: input.eventPayload.type,
    });

    // Dynamic import keeps Mongo + Next runtime bindings out of the
    // workflow sandbox. Steps have full Node access, so this is fine.
    const { ObjectId } = await import('mongodb');
    const { connectToDatabase } = await import('@/lib/mongodb');

    const { db } = await connectToDatabase();

    let automation: Automation | null = null;
    if (ObjectId.isValid(input.automationId)) {
        const raw = await db
            .collection('crm_automations')
            .findOne({ _id: new ObjectId(input.automationId) });

        if (raw) {
            const { trigger, conditions, actions, ...rest } = raw as Record<
                string,
                unknown
            >;
            automation = {
                _id: String((raw as { _id: unknown })._id),
                userId: String((raw as { userId?: unknown }).userId ?? ''),
                name: String((rest as { name?: unknown }).name ?? '(unnamed)'),
                description:
                    typeof (rest as { description?: unknown }).description === 'string'
                        ? ((rest as { description: string }).description)
                        : undefined,
                isEnabled: (rest as { isEnabled?: boolean }).isEnabled === true,
                status:
                    ((rest as { status?: Automation['status'] }).status as Automation['status']) ??
                    'draft',
                trigger: trigger as Automation['trigger'],
                conditions: (conditions as Automation['conditions']) ?? [],
                actions: (actions as Automation['actions']) ?? [],
            };
        }
    }

    // Re-fetch the entity snapshot rather than trusting the event payload —
    // by the time the workflow runs the entity may have moved on.
    let entity: AutomationEntitySnapshot | null = input.eventPayload.entity;
    try {
        const collection = entityCollectionForKind(input.eventPayload.entityKind);
        if (collection && ObjectId.isValid(input.eventPayload.entityId)) {
            const fresh = await db
                .collection(collection)
                .findOne({ _id: new ObjectId(input.eventPayload.entityId) });
            if (fresh) entity = fresh as AutomationEntitySnapshot;
        }
    } catch {
        // Fall back to the event-time snapshot.
    }

    return { automation, entity };
}

function entityCollectionForKind(kind: string): string | null {
    switch (kind) {
        case 'lead':
            return 'crm_leads';
        case 'deal':
            return 'crm_deals';
        case 'task':
            return 'crm_tasks';
        case 'contact':
            return 'crm_contacts';
        case 'account':
            return 'crm_accounts';
        case 'invoice':
            return 'crm_invoices';
        case 'form_submission':
            return 'crm_form_submissions';
        default:
            return null;
    }
}

/* --------------------------------------------------------------------
 * Step: condition gate
 * ------------------------------------------------------------------ */

async function evaluateConditionsStep(
    automation: Automation,
    entity: AutomationEntitySnapshot,
    event: AutomationDomainEvent,
): Promise<boolean> {
    'use step';
    console.log('[automation-run] step:conditions enter', {
        automationId: automation._id,
        conditionsCount: automation.conditions.length,
    });
    const ok = passesConditions(automation, entity, { event });
    console.log('[automation-run] step:conditions exit', {
        automationId: automation._id,
        passed: ok,
    });
    return ok;
}

/* --------------------------------------------------------------------
 * Step: per-action execution
 *
 * Each action is its own `"use step"` — Workflow DevKit will:
 *   - cache its result so a workflow re-run skips it
 *   - retry it on failure with backoff
 *   - resume from this exact action if the worker crashes mid-run
 * ------------------------------------------------------------------ */

async function executeAction(
    action: AutomationAction,
    automation: Automation,
    entity: AutomationEntitySnapshot,
    event: AutomationDomainEvent,
): Promise<AutomationRunActionResult> {
    'use step';

    console.log('[automation-run] step:action enter', {
        automationId: automation._id,
        actionKind: action.kind,
        entityKind: event.entityKind,
        entityId: event.entityId,
    });

    const baseCtx = { automation, entity, event };
    try {
        let summary: string | undefined;
        switch (action.kind) {
            case 'send_email':
                summary = await sendEmailAction(action.config, baseCtx);
                break;
            case 'create_task':
                summary = await createTaskAction(action.config, baseCtx);
                break;
            case 'update_field':
                summary = await updateFieldAction(action.config, baseCtx);
                break;
            case 'webhook':
                summary = await webhookAction(action.config, baseCtx);
                break;
            default:
                console.log('[automation-run] step:action exit', {
                    actionKind: (action as { kind: AutomationActionKind }).kind,
                    success: false,
                    reason: 'unknown_action_kind',
                });
                return makeResult(
                    (action as { kind: AutomationActionKind }).kind,
                    false,
                    Date.now(),
                    'Unknown action kind',
                );
        }
        console.log('[automation-run] step:action exit', {
            actionKind: action.kind,
            success: true,
            summary,
        });
        return makeResult(action.kind, true, Date.now(), undefined, summary);
    } catch (e) {
        console.log('[automation-run] step:action exit', {
            actionKind: action.kind,
            success: false,
            error: (e as Error).message,
        });
        return makeResult(
            action.kind,
            false,
            Date.now(),
            (e as Error).message ?? 'unknown error',
        );
    }
}

function makeResult(
    kind: AutomationActionKind,
    success: boolean,
    finishedAt: number,
    error?: string,
    summary?: string,
): AutomationRunActionResult {
    return { kind, success, finishedAt, error, summary };
}

/* --------------------------------------------------------------------
 * Step: persist final run log
 * ------------------------------------------------------------------ */

async function recordRunOutcome(
    input: RunAutomationInput,
    automation: Automation | null,
    status: AutomationRunStatus,
    results: AutomationRunActionResult[],
    error: string | undefined,
    startedAt: number,
): Promise<void> {
    'use step';

    console.log('[automation-run] step:record enter', {
        automationId: input.automationId,
        status,
        actionsRun: results.length,
        error,
    });

    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();

    const update: Partial<AutomationRunLog> = {
        status,
        actions: results,
        error,
        finishedAt: Date.now(),
    };

    // The dispatcher already inserted a queued row keyed by dedupeKey;
    // we update it in place by (automationId, entityId, eventType, startedAt).
    try {
        await db.collection<AutomationRunLog>('crm_automation_runs').updateOne(
            {
                automationId: input.automationId,
                entityId: input.eventPayload.entityId,
                eventType: input.eventPayload.type,
                startedAt: { $lte: startedAt + 1 },
            },
            { $set: update },
            { upsert: false },
        );
    } catch {
        // Worst case the log row is stuck on `queued` — operators can
        // reconcile manually. Better than the workflow failing.
    }

    void automation; // reserved for richer logging once we add it
}

/* --------------------------------------------------------------------
 * The workflow
 *
 * `"use workflow"` MUST be the first line; the function MUST be async.
 * The orchestrator only calls `"use step"` functions, so all of the
 * Node-flavoured work above stays sandbox-safe.
 * ------------------------------------------------------------------ */

export async function runAutomation(
    input: RunAutomationInput,
): Promise<{ status: AutomationRunStatus; ranActions: number }> {
    'use workflow';

    console.log('[automation-run] workflow:start', {
        automationId: input.automationId,
        entityKind: input.eventPayload.entityKind,
        entityId: input.eventPayload.entityId,
        eventType: input.eventPayload.type,
    });

    const startedAt = Date.now();
    const event = input.eventPayload;

    // 1. Load.
    const { automation, entity } = await loadAutomationAndEntity(input);
    if (!automation || !entity) {
        console.log('[automation-run] workflow:end', {
            status: 'failed',
            reason: 'missing_automation_or_entity',
        });
        await recordRunOutcome(
            input,
            automation,
            'failed',
            [],
            'automation or entity not found',
            startedAt,
        );
        return { status: 'failed', ranActions: 0 };
    }

    // 2. Conditions.
    const conditionsOk = await evaluateConditionsStep(automation, entity, event);
    if (!conditionsOk) {
        console.log('[automation-run] workflow:end', {
            automationId: automation._id,
            status: 'skipped_conditions',
        });
        await recordRunOutcome(
            input,
            automation,
            'skipped_conditions',
            [],
            undefined,
            startedAt,
        );
        return { status: 'skipped_conditions', ranActions: 0 };
    }

    // 3. Time-elapsed sleep. For triggers that need a delay (e.g. "send
    //    follow-up email 1h after lead created") we honour
    //    elapsedMinutes here in a durable sleep — the workflow suspends
    //    and resumes from this exact point.
    const minutes = automation.trigger.config.elapsedMinutes ?? 0;
    if (minutes > 0 && automation.trigger.type === 'time_elapsed') {
        await sleep(`${Math.floor(minutes * 60)}s`);
    }

    // 4. Actions.
    const results: AutomationRunActionResult[] = [];
    for (const action of automation.actions) {
        const r = await executeAction(action, automation, entity, event);
        results.push(r);
        // Stop on first failure to avoid cascading bad effects; the run
        // log still captures everything that was attempted.
        if (!r.success) {
            await recordRunOutcome(
                input,
                automation,
                'failed',
                results,
                r.error,
                startedAt,
            );
            return { status: 'failed', ranActions: results.length };
        }
    }

    // 5. Done.
    await recordRunOutcome(
        input,
        automation,
        'succeeded',
        results,
        undefined,
        startedAt,
    );
    return { status: 'succeeded', ranActions: results.length };
}
