/**
 * Pure trigger / condition evaluator.
 *
 * No I/O — given an automation, an event, and an entity snapshot, return
 * a boolean. Keeps the engine unit-testable without booting Mongo or
 * Workflow DevKit.
 *
 * Used by `dispatch.ts` (which trigger-matches before enqueueing a run)
 * and by `src/workflows/automation-run.ts` (which condition-checks
 * inside the durable workflow before executing actions).
 */

import type {
    Automation,
    AutomationCondition,
    AutomationDomainEvent,
    AutomationEntitySnapshot,
} from './types';

/* --------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */

/** Dotted-path lookup. `getPath({a:{b:1}}, 'a.b')` → `1`. */
function getPath(obj: unknown, path: string): unknown {
    if (!path) return undefined;
    const segments = path.split('.');
    let cur: unknown = obj;
    for (const seg of segments) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
}

/** Loose equality that treats `1 == '1'` and `null == undefined` as equal. */
function looseEq(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    // Compare ObjectId-like by .toString()
    if (typeof a === 'object' || typeof b === 'object') {
        return String(a) === String(b);
    }
    // Numeric coercion for "5" vs 5
    if (typeof a === 'number' || typeof b === 'number') {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
    }
    return String(a) === String(b);
}

/* --------------------------------------------------------------------
 * matchesTrigger
 * ------------------------------------------------------------------ */

/**
 * Returns `true` if the given event should fire this automation's trigger.
 * Entity-kind mismatch always returns false. Tenant scoping is enforced
 * upstream in `dispatch.ts` (the Mongo query already filters by userId).
 */
export function matchesTrigger(
    automation: Automation,
    event: AutomationDomainEvent,
): boolean {
    const t = automation.trigger;
    if (!t || !t.config) return false;
    if (t.config.entityKind !== event.entityKind) return false;

    switch (t.type) {
        case 'entity_created':
            return event.type === 'entity_created';

        case 'entity_updated':
            // Match any update by default. If the trigger has fieldName
            // configured, only match updates that touched that field.
            if (event.type !== 'entity_updated' && event.type !== 'status_changed') return false;
            if (t.config.fieldName && event.fieldName !== t.config.fieldName) return false;
            return true;

        case 'status_changed':
            if (event.type !== 'status_changed' && event.type !== 'stage_changed') return false;
            if (t.config.fieldName && event.fieldName !== t.config.fieldName) return false;
            if (
                t.config.fromValue !== undefined &&
                !looseEq(event.fromValue, t.config.fromValue)
            ) {
                return false;
            }
            if (
                t.config.toValue !== undefined &&
                !looseEq(event.toValue, t.config.toValue)
            ) {
                return false;
            }
            return true;

        case 'time_elapsed':
            if (event.type !== 'time_elapsed') return false;
            if (
                typeof t.config.elapsedMinutes === 'number' &&
                (event.elapsedMinutes ?? 0) < t.config.elapsedMinutes
            ) {
                return false;
            }
            return true;

        default:
            return false;
    }
}

/* --------------------------------------------------------------------
 * passesConditions
 * ------------------------------------------------------------------ */

/**
 * Evaluates every condition against the entity snapshot. AND semantics —
 * all conditions must pass. An empty conditions array always passes
 * (the trigger was already a positive filter).
 */
export function passesConditions(
    automation: Automation,
    entity: AutomationEntitySnapshot,
    context: { event?: AutomationDomainEvent } = {},
): boolean {
    void context;
    const conditions = automation.conditions ?? [];
    if (conditions.length === 0) return true;

    for (const c of conditions) {
        if (!evaluateOne(c, entity)) return false;
    }
    return true;
}

function evaluateOne(
    c: AutomationCondition,
    entity: AutomationEntitySnapshot,
): boolean {
    const fieldVal = c.field ? getPath(entity, c.field) : undefined;

    switch (c.kind) {
        case 'field_equals':
            return looseEq(fieldVal, c.value);

        case 'field_in': {
            if (!Array.isArray(c.value)) return false;
            return (c.value as unknown[]).some(v => looseEq(fieldVal, v));
        }

        case 'has_tag': {
            // Tags can be stored either as a string[] or as {name}[]
            const raw = fieldVal ?? (entity.tags as unknown);
            if (!Array.isArray(raw)) return false;
            const target = String(c.value);
            return (raw as unknown[]).some(t => {
                if (typeof t === 'string') return t === target;
                if (t && typeof t === 'object') {
                    const name = (t as Record<string, unknown>).name;
                    return looseEq(name, target);
                }
                return false;
            });
        }

        case 'in_stage': {
            // Accept either an explicit `field` or fall back to common
            // stage-bearing fields by entity convention.
            const stage =
                fieldVal ??
                (entity.stage as unknown) ??
                (entity.stageId as unknown) ??
                (entity.status as unknown);
            return looseEq(stage, c.value);
        }

        default:
            return false;
    }
}
