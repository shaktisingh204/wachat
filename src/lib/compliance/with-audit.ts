/**
 * Higher-order wrapper that turns any server-action style function
 * into one that emits a compliance audit event around its execution.
 *
 * The wrapper is *opt-in*: existing actions are never modified.
 * Adopters wrap their action at the export site:
 *
 * ```ts
 * export const updateContact = withAudit(_updateContact, {
 *     action: 'contact.update',
 *     resource: ({ args }) => `contacts/${args[0]}`,
 *     captureBefore: ({ args }) => loadContact(args[0]),
 * });
 * ```
 *
 * The implementation is tolerant of either a successful return *or* a
 * thrown exception — both produce an audit row, with the failure path
 * marked via `metadata.outcome = 'error'` and the error message stored
 * (PII-redacted) in `metadata.error`.
 */
import type { AuditEvent } from './types';
import { audit as defaultAudit, type AuditInput } from './audit-log';
import { publishAudit } from './event-feed';
import { redactPayload } from './redact';

/* ── DI seam for tests ──────────────────────────────────────────────── */

/**
 * The wrapper writes via this function so tests can swap in a fake
 * that doesn't need a live Mongo.  Production code never touches it.
 */
let auditEmitter: (input: AuditInput) => Promise<AuditEvent> = defaultAudit;

/** Replace the audit emitter — test utility. */
export function __setAuditEmitter(
    fn: (input: AuditInput) => Promise<AuditEvent>,
): void {
    auditEmitter = fn;
}

/** Restore the production emitter — test utility. */
export function __resetAuditEmitter(): void {
    auditEmitter = defaultAudit;
}

/* ── Types ──────────────────────────────────────────────────────────── */

/** Generic server-action signature. */
export type ServerAction<A extends unknown[] = unknown[], R = unknown> = (
    ...args: A
) => Promise<R> | R;

/** Context passed to user-supplied resolvers. */
export interface AuditContext<A extends unknown[]> {
    args: A;
}

/** Context passed *after* the wrapped action resolves. */
export interface AuditResultContext<A extends unknown[], R> extends AuditContext<A> {
    result: R;
}

/**
 * Configuration accepted by {@link withAudit}.  Every dynamic field can
 * be a literal value or a function of the call context — that lets
 * callers derive `tenantId`, `actor`, `before`/`after` snapshots from
 * the action's arguments without monkey-patching their signatures.
 */
export interface WithAuditOptions<A extends unknown[], R> {
    /** Verb that describes the action (e.g. `contact.update`). */
    action: string;
    /** Logical resource being acted on (string or resolver). */
    resource: string | ((ctx: AuditContext<A>) => string | Promise<string>);
    /**
     * Tenant scope.  Required by the audit log.  If omitted the wrapper
     * looks for `process.env.AUDIT_DEFAULT_TENANT` and falls back to
     * `'system'` so the call never silently skips logging.
     */
    tenantId?:
        | string
        | ((ctx: AuditContext<A>) => string | Promise<string>);
    /** Acting principal — `user:abc`, `system`, etc. */
    actor?:
        | string
        | ((ctx: AuditContext<A>) => string | Promise<string>);
    /** Snapshot loader run *before* the action executes. */
    captureBefore?: (
        ctx: AuditContext<A>,
    ) => Record<string, unknown> | Promise<Record<string, unknown>> | undefined;
    /** Snapshot loader run *after* the action resolves successfully. */
    captureAfter?: (
        ctx: AuditResultContext<A, R>,
    ) => Record<string, unknown> | Promise<Record<string, unknown>> | undefined;
    /** Extra free-form metadata recorder. */
    metadata?: (
        ctx: AuditContext<A>,
    ) => Record<string, unknown> | Promise<Record<string, unknown>> | undefined;
    /**
     * If `true` the audit row is PII-scrubbed via {@link redact} before
     * it hits the log.  Default `true` — opt out only when callers
     * explicitly need raw payloads (e.g. forensic captures already
     * scoped to a legal-hold collection).
     */
    redactPii?: boolean;
    /**
     * If `true` (default) the wrapper continues to *throw* the original
     * error after recording the failed-action audit.  Set to `false` if
     * you want errors to be swallowed and surfaced to the caller as a
     * structured `{ ok: false, error }` result instead.
     */
    rethrow?: boolean;
}

/** Return type for {@link withAudit} — preserves the original signature. */
export type WrappedAction<A extends unknown[], R> = (...args: A) => Promise<R>;

/* ── Helpers ────────────────────────────────────────────────────────── */

async function resolveValue<T, A extends unknown[]>(
    value: T | ((ctx: AuditContext<A>) => T | Promise<T>) | undefined,
    ctx: AuditContext<A>,
): Promise<T | undefined> {
    if (typeof value === 'function') {
        return await (value as (c: AuditContext<A>) => T | Promise<T>)(ctx);
    }
    return value;
}

async function safeAudit(
    input: AuditInput,
    onEvent?: (e: AuditEvent) => void,
): Promise<AuditEvent | null> {
    try {
        const evt = await auditEmitter(input);
        onEvent?.(evt);
        publishAudit(evt);
        return evt;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[withAudit] failed to write audit row', err);
        return null;
    }
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Wrap a server-action style function so every invocation emits an
 * audit event.  See module-level docs for usage examples.
 *
 * The returned function preserves the original argument types and
 * resolves to the original return type — invocation is a drop-in
 * replacement.  When `rethrow` is `false` the return type widens to
 * `R | { ok: false; error: string }`.
 */
export function withAudit<A extends unknown[], R>(
    handler: ServerAction<A, R>,
    opts: WithAuditOptions<A, R>,
): WrappedAction<A, R> {
    const redactEnabled = opts.redactPii !== false;
    const rethrow = opts.rethrow !== false;

    return async function wrapped(...args: A): Promise<R> {
        const ctx: AuditContext<A> = { args };

        // ── Resolve scope eagerly so failures here don't lose audit ──
        const tenantId =
            (await resolveValue(opts.tenantId, ctx)) ??
            process.env.AUDIT_DEFAULT_TENANT ??
            'system';
        const actor = (await resolveValue(opts.actor, ctx)) ?? 'system';
        const resource = await resolveValue(opts.resource, ctx);

        // ── Capture pre-state (best effort) ──
        let before: Record<string, unknown> | undefined;
        try {
            before = (await opts.captureBefore?.(ctx)) ?? undefined;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[withAudit] captureBefore threw', err);
        }

        const baseMeta = (await opts.metadata?.(ctx)) ?? undefined;

        try {
            const result = await handler(...args);

            let after: Record<string, unknown> | undefined;
            try {
                after =
                    (await opts.captureAfter?.({ ...ctx, result })) ?? undefined;
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[withAudit] captureAfter threw', err);
            }

            const metadata = {
                ...(baseMeta ?? {}),
                outcome: 'success' as const,
            };

            const input: AuditInput = {
                tenantId,
                actor,
                action: opts.action,
                resource: resource ?? 'unknown',
                before: redactEnabled && before ? redactPayload(before) : before,
                after: redactEnabled && after ? redactPayload(after) : after,
                metadata: redactEnabled ? redactPayload(metadata) : metadata,
            };

            await safeAudit(input);
            return result;
        } catch (err) {
            const message =
                err instanceof Error ? err.message : String(err);

            const metadata = {
                ...(baseMeta ?? {}),
                outcome: 'error' as const,
                error: message,
            };

            const input: AuditInput = {
                tenantId,
                actor,
                action: opts.action,
                resource: resource ?? 'unknown',
                before: redactEnabled && before ? redactPayload(before) : before,
                metadata: redactEnabled ? redactPayload(metadata) : metadata,
            };

            await safeAudit(input);

            if (rethrow) throw err;
            // Caller asked for a structured error envelope.  Cast is
            // safe because callers that opt-in widen R themselves.
            return { ok: false, error: message } as unknown as R;
        }
    };
}

/* ── Re-exports ─────────────────────────────────────────────────────── */

export { redactPayload, redactPii } from './redact';
export { subscribeToAudit, publishAudit } from './event-feed';
