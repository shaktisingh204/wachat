/**
 * SabCRM AI computed fields — PURE evaluator helpers.
 *
 * Split out of `ai-fields.server.ts` (which carries `'server-only'` + the
 * Mongo/LLM side effects) so the unit tests can import these under
 * `tsx --test` — the same pure/impure split as `gate-membership.ts` vs the
 * `'use server'` actions (see `__tests__/gate-security.test.ts` rationale).
 * Consumers should import from `ai-fields.server.ts`, which re-exports
 * everything here.
 */

import { createHash } from 'crypto';

import type { FieldMetadata } from './types';

/** Outcome of one AI-field evaluation (also used by the pure coercion step). */
export interface AiFieldEvalResult {
  status: 'ready' | 'failed' | 'skipped';
  /** The coerced scalar written to `data.<key>` (when status === 'ready'). */
  value?: unknown;
  /** Failure / skip reason. */
  detail?: string;
}

/**
 * System prompt for AI field computation. The model must reply with the bare
 * value (or the single word UNKNOWN), never prose.
 */
export const AI_FIELD_SYSTEM =
  'You compute one CRM field value. Reply with ONLY the value — no preamble, ' +
  'no markdown, no quotes. If the inputs are insufficient, reply with the ' +
  'single word UNKNOWN.';

/** `{{token}}` matcher — field keys, dotted paths allowed. */
const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Pseudo-fields always allowed as prompt inputs. */
const SYSTEM_INPUT_KEYS: ReadonlySet<string> = new Set(['updatedAt', 'createdAt']);

/**
 * Parse `{{token}}` field keys out of a prompt template, intersected with the
 * object's field keys; `'updatedAt'` / `'createdAt'` are always allowed. A
 * dotted token (`emails.primaryEmail`) counts when its ROOT segment is a field
 * key. Returns unique keys in first-occurrence order.
 */
export function aiSourceFields(
  prompt: string,
  fieldKeys: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of prompt.matchAll(TOKEN_RE)) {
    const token = match[1];
    if (seen.has(token)) continue;
    const root = token.includes('.') ? token.slice(0, token.indexOf('.')) : token;
    if (!fieldKeys.has(token) && !fieldKeys.has(root) && !SYSTEM_INPUT_KEYS.has(root)) {
      continue;
    }
    seen.add(token);
    out.push(token);
  }
  return out;
}

/** Resolve a (possibly dotted) source-field token against a record's data bag. */
export function aiSourceValue(
  data: Record<string, unknown> | undefined,
  token: string,
): unknown {
  if (!data) return undefined;
  if (!token.includes('.')) return data[token];
  let cur: unknown = data;
  for (const seg of token.split('.')) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * sha256 hex (32 chars) over `JSON.stringify({ prompt, values })` where
 * `values` is the ordered source-field → raw data value map. Mirrors
 * `hashKey()` in `src/app/actions/sabsheet-ai.actions.ts`.
 */
export function aiInputsHash(
  prompt: string,
  values: Record<string, unknown>,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ prompt, values }))
    .digest('hex')
    .slice(0, 32);
}

/**
 * Coerce raw LLM text by the field's `settings.ai.outputType`.
 *
 * - TEXT   → trimmed text (empty → failed)
 * - NUMBER → `Number()` (reject NaN / non-finite)
 * - BOOLEAN→ `/^(true|yes)$/i` → true, `/^(false|no)$/i` → false, else failed
 * - SELECT → matches option value OR label case-insensitively against
 *            `field.options`, stores the option VALUE
 * - RATING → integer 1..5
 *
 * Any failure → `{ status:'failed', detail }`. Pure — callers persist.
 */
export function coerceAiOutput(
  text: string,
  field: FieldMetadata,
): AiFieldEvalResult {
  // Local parse instead of importing aiFieldConfig's full validation: the
  // caller already validated the config; here only outputType matters.
  const outputType = String(
    (field.settings as { ai?: { outputType?: unknown } } | undefined)?.ai
      ?.outputType ?? 'TEXT',
  );
  const trimmed = text.trim();
  if (!trimmed) {
    return { status: 'failed', detail: 'model returned an empty reply' };
  }

  switch (outputType) {
    case 'NUMBER': {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        return { status: 'failed', detail: `not a number: "${trimmed.slice(0, 80)}"` };
      }
      return { status: 'ready', value: n };
    }
    case 'BOOLEAN': {
      if (/^(true|yes)$/i.test(trimmed)) return { status: 'ready', value: true };
      if (/^(false|no)$/i.test(trimmed)) return { status: 'ready', value: false };
      return {
        status: 'failed',
        detail: `not a boolean: "${trimmed.slice(0, 80)}"`,
      };
    }
    case 'SELECT': {
      const options = field.options ?? [];
      const needle = trimmed.toLowerCase();
      const opt = options.find(
        (o) =>
          o.value.toLowerCase() === needle || o.label.toLowerCase() === needle,
      );
      if (!opt) {
        return {
          status: 'failed',
          detail: `"${trimmed.slice(0, 80)}" is not one of the allowed options`,
        };
      }
      return { status: 'ready', value: opt.value };
    }
    case 'RATING': {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return {
          status: 'failed',
          detail: `not a 1–5 rating: "${trimmed.slice(0, 80)}"`,
        };
      }
      return { status: 'ready', value: n };
    }
    case 'TEXT':
    default:
      return { status: 'ready', value: trimmed };
  }
}
