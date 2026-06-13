/**
 * SabCRM — agentic helpers — PURE core (no I/O, no LLM, no `server-only`).
 *
 * The structural twin of `./scoring.ts` / `./crm-rag.ts`: every deterministic
 * decision an agentic helper makes — turning the LLM's JSON reply into a SAFE,
 * runnable filter spec, and normalising a lead-qualification verdict — lives
 * here so it can be unit-tested with `tsx --test` AND imported by the
 * `'use client'` list-builder page WITHOUT pulling in Mongo / the LLM ladder.
 * The Mongo retrieval, the `generateSabcrmText` call and the data.* write-back
 * live in `./ai-agentic.server.ts`, which re-exports everything here.
 *
 * ## Two pure jobs
 *
 * 1. **NL → filter spec (validate, NEVER trust).** The model returns JSON; we
 *    parse it and validate every leaf against the records engine's OWN operator
 *    vocabulary ({@link VALID_OPERATORS} from `./records-filter`) plus the
 *    object's allowed field keys. Anything we can't prove safe — an unknown
 *    field, an unknown operator, a value-less comparison op, an over-deep /
 *    over-wide spec, a Mongo-operator injection (`$where`, `{$gt:…}` as a raw
 *    value) — is REJECTED, not silently coerced. The output is a list of typed
 *    {@link FilterCondition}s that the server feeds straight into the SAME
 *    ACL-scoped `listRecords` aggregation path — never a hand-built Mongo query.
 *
 * 2. **Qualification parse/normalise.** The model returns a verdict JSON; we
 *    clamp the verdict to a known enum, the confidence to `[0,1]`, and bound
 *    the reason string. The result is the scalar envelope written to
 *    `data.aiQualification`.
 */

import { VALID_OPERATORS, type FilterCondition, type FilterOperator } from './records-filter';

/* -------------------------------------------------------------------------- */
/* NL → filter spec                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A validated, runnable filter spec. `conditions` are typed
 * {@link FilterCondition}s (the SAME shape `listRecords` consumes via
 * `RecordQueryExtended.conditions`); `unresolved` carries any part of the
 * request the model could not express, for transparent display.
 */
export interface FilterSpec {
  /** Conditions are ANDed together by the records engine. */
  conditions: FilterCondition[];
  /** Optional free-text note about parts that could not be expressed. */
  unresolved?: string;
}

/** Hard caps so a hostile / runaway model reply can't build a giant query. */
export const MAX_CONDITIONS = 20;
/** Max chars of any single condition value (after string coercion). */
export const MAX_VALUE_LEN = 200;
/** Max members allowed in an `in` / `notIn` array value. */
export const MAX_IN_MEMBERS = 50;

/** Operators that take NO value (`isEmpty` / `isNotEmpty`). */
const VALUELESS_OPS: ReadonlySet<FilterOperator> = new Set<FilterOperator>([
  'isEmpty',
  'isNotEmpty',
]);

/** Operators whose value is a list (`in` / `notIn`). */
const ARRAY_OPS: ReadonlySet<FilterOperator> = new Set<FilterOperator>([
  'in',
  'notIn',
]);

/** Audit columns that are always queryable even though they aren't `fields`. */
export const AUDIT_FIELDS: readonly string[] = ['createdAt', 'updatedAt'];

/** Outcome of {@link validateFilterSpec}. */
export type FilterSpecResult =
  | { ok: true; spec: FilterSpec }
  | { ok: false; error: string };

/** Strip a ```json … ``` fence the model may wrap its reply in. */
export function stripCodeFence(text: string): string {
  const t = (text || '').trim();
  if (!t.startsWith('```')) return t;
  // Drop the opening fence (with optional language) and the closing fence.
  return t
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

/**
 * Reject a value that is NOT a plain JSON scalar. This is the injection guard:
 * a Mongo operator object (`{ $gt: … }`, `{ $where: … }`), an array (except for
 * the array operators, handled by the caller), a function, etc. never reaches
 * `conditionToMongo` as a raw `value`, so the model cannot smuggle an operator
 * through the value slot.
 */
function isScalar(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** A scalar is safe iff, when a string, it is bounded and has no `$`/`.` keys. */
function scalarIsBounded(v: string | number | boolean): boolean {
  if (typeof v !== 'string') return Number.isFinite(typeof v === 'number' ? v : 1);
  return v.length <= MAX_VALUE_LEN;
}

/**
 * Validate ONE raw leaf from the model into a typed {@link FilterCondition}.
 * Returns `null` when the leaf is unsafe/unusable (unknown field/op, missing or
 * non-scalar value, injection attempt) — callers drop nulls so a single bad
 * leaf never poisons the whole spec.
 */
export function validateCondition(
  raw: unknown,
  allowedFields: ReadonlySet<string>,
): FilterCondition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  // The model may use `field`/`fieldKey` and `op`/`operator` interchangeably.
  const field = typeof o.field === 'string' ? o.field : typeof o.fieldKey === 'string' ? o.fieldKey : '';
  const opRaw = typeof o.op === 'string' ? o.op : typeof o.operator === 'string' ? o.operator : '';

  if (!field || !allowedFields.has(field)) return null;
  if (!VALID_OPERATORS.has(opRaw)) return null;
  const op = opRaw as FilterOperator;

  // Value-less operators: never carry a value.
  if (VALUELESS_OPS.has(op)) {
    return { field, op };
  }

  const value = o.value;

  // Array operators: a bounded list of scalars only.
  if (ARRAY_OPS.has(op)) {
    if (!Array.isArray(value)) {
      // A single scalar is acceptable — wrap it.
      if (!isScalar(value) || !scalarIsBounded(value)) return null;
      return { field, op, value: [value] };
    }
    if (value.length === 0 || value.length > MAX_IN_MEMBERS) return null;
    const members: Array<string | number | boolean> = [];
    for (const m of value) {
      if (!isScalar(m) || !scalarIsBounded(m)) return null; // reject nested objects/operators
      members.push(m);
    }
    return { field, op, value: members };
  }

  // Every remaining operator REQUIRES a bounded scalar value.
  if (!isScalar(value) || !scalarIsBounded(value)) return null;
  return { field, op, value };
}

/**
 * Parse + validate the model's JSON reply into a safe {@link FilterSpec}.
 *
 * Accepts either the bare-array form (`[{field,op,value}, …]`) or the object
 * form (`{conditions:[…], unresolved?}`). Validates each leaf via
 * {@link validateCondition} against `allowedFields`; drops unsafe leaves. Fails
 * when the JSON can't be parsed, the shape is wrong, or NOTHING valid remains
 * (so the caller never runs an empty/whole-table query off a garbage reply).
 */
export function nlToFilterSpec(
  modelText: string,
  allowedFields: Iterable<string>,
): FilterSpecResult {
  const allowed = new Set<string>([...allowedFields, ...AUDIT_FIELDS]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(modelText));
  } catch {
    return { ok: false, error: 'Could not parse the model reply as JSON.' };
  }

  let rawConditions: unknown;
  let unresolved: string | undefined;

  if (Array.isArray(parsed)) {
    rawConditions = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    rawConditions = o.conditions;
    if (typeof o.unresolved === 'string' && o.unresolved.trim()) {
      unresolved = o.unresolved.trim().slice(0, MAX_VALUE_LEN);
    }
  }

  if (!Array.isArray(rawConditions)) {
    return { ok: false, error: 'The model reply had no conditions array.' };
  }
  if (rawConditions.length > MAX_CONDITIONS) {
    // Trim rather than fail — keep the first N safe leaves.
    rawConditions = rawConditions.slice(0, MAX_CONDITIONS);
  }

  const conditions: FilterCondition[] = [];
  for (const raw of rawConditions as unknown[]) {
    const c = validateCondition(raw, allowed);
    if (c) conditions.push(c);
  }

  if (conditions.length === 0) {
    return {
      ok: false,
      error:
        'No valid filter could be built from the request — try naming the ' +
        'fields and values you want to match.',
    };
  }

  return { ok: true, spec: { conditions, unresolved } };
}

/* -------------------------------------------------------------------------- */
/* Lead qualification                                                          */
/* -------------------------------------------------------------------------- */

/** Allowed qualification verdicts (clamped — anything else → `unknown`). */
export type QualVerdict = 'qualified' | 'unqualified' | 'needs_review' | 'unknown';

/** Every recognised verdict (validates persisted blobs + model replies). */
export const QUAL_VERDICTS: ReadonlySet<string> = new Set<QualVerdict>([
  'qualified',
  'unqualified',
  'needs_review',
  'unknown',
]);

/** Max chars kept of the model's qualification reason. */
export const MAX_REASON_LEN = 600;

/** The normalised qualification scalar written to `data.aiQualification`. */
export interface QualificationResult {
  verdict: QualVerdict;
  /** 0..1 model confidence (clamped). */
  confidence: number;
  /** Short human reason (bounded). */
  reason: string;
}

/** Map a free-form model verdict string onto the closed {@link QualVerdict} set. */
export function normalizeVerdict(raw: unknown): QualVerdict {
  if (typeof raw !== 'string') return 'unknown';
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (QUAL_VERDICTS.has(v)) return v as QualVerdict;
  // Tolerant synonyms the model commonly emits.
  if (v === 'qualify' || v === 'good' || v === 'hot' || v === 'yes') return 'qualified';
  if (v === 'disqualified' || v === 'reject' || v === 'bad' || v === 'cold' || v === 'no') {
    return 'unqualified';
  }
  if (v === 'review' || v === 'maybe' || v === 'warm' || v === 'follow_up') return 'needs_review';
  return 'unknown';
}

/**
 * Scan a free-text reply for a verdict KEYWORD (used by the non-JSON fallback).
 * `unqualified` / `disqualified` are checked first so they aren't shadowed by
 * the `qualified` substring they contain.
 */
export function verdictFromProse(text: string): QualVerdict {
  const t = (text || '').toLowerCase();
  if (/\b(un|dis)qualif/.test(t) || /\b(reject|not a (good )?fit|cold)\b/.test(t)) {
    return 'unqualified';
  }
  if (/\bqualif/.test(t) || /\b(strong fit|good fit|hot lead)\b/.test(t)) return 'qualified';
  if (/\b(needs?[ _-]?review|follow[ _-]?up|maybe|warm|unclear)\b/.test(t)) {
    return 'needs_review';
  }
  return 'unknown';
}

/**
 * Clamp an arbitrary value to a `[0,1]` confidence (default 0).
 *
 * Tolerates a model that emits a 0..100 percentage: a value of `10..100` is
 * read as a percentage and divided by 100, while a small over-1 value (`1..10`,
 * e.g. a stray `2`) is simply clamped to 1 — models write percentages in tens,
 * not single digits, so this disambiguates the two common mistakes.
 */
export function clampConfidence(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n <= 1) return Math.round(n * 100) / 100;
  if (n >= 10 && n <= 100) return Math.round(n) / 100; // percentage scale
  return 1; // small over-1 (1 < n < 10) or anything above 100 → clamp
}

/**
 * Parse + normalise the model's qualification reply into a
 * {@link QualificationResult}. Accepts a JSON object (`{verdict, confidence,
 * reason}`); falls back to a heuristic over the raw text when the reply isn't
 * JSON, so a non-JSON model still yields a sensible verdict rather than an
 * error. Never throws.
 */
export function parseQualification(modelText: string): QualificationResult {
  const text = (modelText || '').trim();

  // Preferred path: a JSON object.
  try {
    const parsed = JSON.parse(stripCodeFence(text)) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const reasonRaw =
        typeof parsed.reason === 'string'
          ? parsed.reason
          : typeof parsed.rationale === 'string'
            ? parsed.rationale
            : '';
      return {
        verdict: normalizeVerdict(parsed.verdict),
        confidence: clampConfidence(parsed.confidence),
        reason: reasonRaw.trim().slice(0, MAX_REASON_LEN),
      };
    }
  } catch {
    /* fall through to the heuristic */
  }

  // Heuristic fallback: scan the prose for a verdict keyword + keep it as reason.
  return {
    verdict: verdictFromProse(text),
    confidence: 0,
    reason: text.slice(0, MAX_REASON_LEN),
  };
}

/** System prompt grounding the qualification model (honest, no fabrication). */
export const QUALIFY_SYSTEM =
  'You are a CRM sales-qualification assistant. Given a lead record and ' +
  'related CRM context, decide whether the lead is worth pursuing. Reply with ' +
  'ONLY minified JSON, no markdown: ' +
  '{"verdict":"qualified"|"unqualified"|"needs_review","confidence":0..1,' +
  '"reason":"<one or two sentences, cite the record fields that drove the ' +
  'decision>"}. Base the decision ONLY on the data provided — never invent ' +
  'fields, budgets, or signals that are not present.';

/** System prompt for the NL → filter spec translation. */
export const NL_LIST_SYSTEM =
  'You translate a natural-language request into a JSON filter for a CRM ' +
  'object list. Reply with ONLY minified JSON, no markdown.';

/** Serialise one field for the catalogue block (key | label | type | options). */
export function catalogueLine(f: {
  key: string;
  label: string;
  type: string;
  options?: Array<{ value: string; label: string }>;
}): string {
  const opts = (f.options ?? []).map((o) => `${o.value}:${o.label}`).join(', ');
  return `${f.key} | ${f.label} | ${f.type}${opts ? ` | options: ${opts}` : ''}`;
}

/**
 * Build the NL → filter user prompt: the field catalogue, a date anchor, the
 * operator vocabulary, the strict JSON schema, examples, and the request.
 * Pure (no I/O) so it is unit-testable.
 */
export function buildNlListPrompt(
  fields: Array<{ key: string; label: string; type: string; options?: Array<{ value: string; label: string }> }>,
  query: string,
  today = new Date().toISOString().slice(0, 10),
): string {
  return [
    'CRM object fields (key | label | type | options):',
    ...fields.map(catalogueLine),
    '',
    `Today's date: ${today} (resolve relative dates like "last month" to literal YYYY-MM-DD bounds).`,
    '',
    'Operators (use ONLY these): eq, neq, contains, notContains, gt, gte, lt, lte, in, notIn, isEmpty, isNotEmpty.',
    '- isEmpty / isNotEmpty take NO "value".',
    '- in / notIn take an ARRAY "value".',
    '- every other operator takes a single scalar "value".',
    '- SELECT values MUST be the option value, never the label.',
    '- Only reference field keys from the catalogue above (plus createdAt / updatedAt).',
    '',
    'Reply with ONLY minified JSON matching this schema:',
    '{"conditions":[{"field":string,"op":string,"value"?:scalar|array}],"unresolved"?:string}',
    'Put anything you cannot express into the optional "unresolved" string.',
    '',
    'Example — "open enterprise deals over 10000" (stage SELECT option open:Open, tier SELECT option ent:Enterprise):',
    '{"conditions":[{"field":"stage","op":"eq","value":"open"},{"field":"tier","op":"eq","value":"ent"},{"field":"amount","op":"gt","value":10000}]}',
    '',
    `Request: ${query}`,
  ].join('\n');
}
