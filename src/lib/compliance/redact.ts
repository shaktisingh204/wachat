/**
 * PII redaction helper used by the audit-log wrappers.
 *
 * Built on top of Impl 9's DLP module (`./dlp`).  We delegate the
 * heavy lifting — regex compilation, Luhn / entropy / JWT validators
 * and finding de-dup — to {@link scan} and {@link dlpRedact}, then
 * walk arbitrary serializable payloads applying redactions to every
 * string value.
 *
 * Object *keys* are intentionally not scanned; they form part of the
 * audit schema and are safe to retain.
 */
import {
    DEFAULT_RULES,
    redact as dlpRedact,
    scan,
} from './dlp';
import type { DlpRule } from './types';

/* ── Public types ───────────────────────────────────────────────────── */

/**
 * Categories that {@link redactPii} will scrub by default.  Mirrors
 * `DlpRule['category']` from {@link ./types}.  Callers may pass an
 * explicit subset via `categories` or supply their own custom rules.
 */
export type PiiCategory = DlpRule['category'];

/** Options accepted by {@link redactPii}. */
export interface RedactOptions {
    /** Subset of categories to scrub.  Defaults to email/phone/card. */
    categories?: ReadonlyArray<PiiCategory>;
    /** Extra rules to apply on top of the defaults / categories. */
    customRules?: ReadonlyArray<DlpRule>;
}

const DEFAULT_CATEGORIES: ReadonlyArray<PiiCategory> = [
    'email',
    'phone',
    'credit_card',
];

/* ── Helpers ────────────────────────────────────────────────────────── */

/**
 * Build the rule set for a single redaction call by intersecting the
 * DLP defaults with the requested categories and appending any
 * caller-supplied rules.
 */
function rulesFor(opts: RedactOptions): DlpRule[] {
    const wanted = new Set<PiiCategory>(opts.categories ?? DEFAULT_CATEGORIES);
    const builtins = DEFAULT_RULES.filter((r) => wanted.has(r.category));
    return [...builtins, ...(opts.customRules ?? [])];
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Walk a serializable payload recursively and replace any value that
 * matches a configured PII pattern.  Values are masked with the same
 * fixed-width `*` mask Impl 9's DLP module uses for consistency
 * across audit, broadcast and message-scanning surfaces.
 *
 * The function is pure: the returned object is a structural clone of
 * `payload` with redacted strings.  The original is never mutated.
 *
 * @example
 *   const { data } = redactPii({ email: 'a@b.com' });
 *   // data.email === '*******'
 */
export function redactPii<T = unknown>(
    payload: T,
    opts: RedactOptions = {},
): { data: T; redactions: number } {
    const rules = rulesFor(opts);
    let total = 0;

    const walk = (value: unknown): unknown => {
        if (value == null) return value;
        if (typeof value === 'string') {
            const findings = scan(value, rules);
            if (findings.length === 0) return value;
            total += findings.length;
            return dlpRedact(value, findings);
        }
        if (typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(walk);
        if (value instanceof Date) return value;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = walk(v);
        }
        return out;
    };

    return { data: walk(payload) as T, redactions: total };
}

/**
 * Convenience wrapper that returns *just* the data — useful inside
 * pipelines where the redaction count is not interesting.
 */
export function redactPayload<T>(payload: T, opts?: RedactOptions): T {
    return redactPii(payload, opts).data;
}
