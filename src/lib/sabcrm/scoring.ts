/**
 * SabCRM — rule-based lead/deal scoring — PURE evaluator helpers.
 *
 * The structural twin of `./ai-fields.ts`: a `'server-only'`- and I/O-free
 * module so the unit tests (`tsx --test`) AND the `'use client'` settings page
 * can import the types + the deterministic scoring math directly. The Mongo /
 * provisioning side effects live in `./scoring.server.ts`, which re-exports
 * everything here.
 *
 * ## Model
 *
 * A {@link ScoringRuleSet} targets one object (e.g. `opportunities`) and is a
 * flat list of {@link ScoringRule}s. Each rule is a single
 * {@link FilterCondition} (the SAME operator vocabulary the records engine
 * already uses for filtering, see `./records-filter.ts`) plus a `points`
 * delta (which may be negative). A record's score is the sum of the points of
 * every rule whose condition matches; the score then resolves to a
 * {@link ScoreTier} (the highest tier whose `min` the score reaches).
 *
 * ## Storage envelope (see `./scoring.server.ts`)
 *
 * The score is a plain NUMBER at `data[scoreField]` (default `score`) and the
 * tier label a string at `data[tierField]` (default `scoreTier`, a SELECT) so
 * the records engine's table/board/filter/sort tree renders them with zero
 * engine change — exactly like the AI-fields scalar envelope. Per-rule-set
 * compute metadata rides `data.__score.<ruleSetId>`.
 */

import type { FilterCondition, FilterOperator } from './records-filter';

/** One scoring rule: a single typed condition worth `points` when it matches. */
export interface ScoringRule {
  /** Stable id (for React keys + the per-rule-set meta). */
  id: string;
  /** Optional human label shown in the editor + "why" breakdown. */
  label?: string;
  /** The condition, reusing the records engine's filter vocabulary. */
  condition: FilterCondition;
  /** Points added to the score when the condition matches (may be negative). */
  points: number;
}

/** A score band: `score >= min` maps to this tier (highest matching wins). */
export interface ScoreTier {
  /** Inclusive lower bound. */
  min: number;
  /** Human label, e.g. "Hot". Also used as the SELECT option value. */
  label: string;
  /** `--ui20-*` token name or hex; drives the colored tier badge. */
  color?: string;
}

/** A persisted scoring rule set (the doc shape minus the Mongo `_id`). */
export interface ScoringRuleSet {
  id: string;
  projectId: string;
  /** The object slug this set scores, e.g. `opportunities`. */
  objectSlug: string;
  name: string;
  enabled: boolean;
  rules: ScoringRule[];
  tiers: ScoreTier[];
  /** Field key the numeric score is written to (default `score`). */
  scoreField: string;
  /** Field key the tier label is written to (default `scoreTier`). */
  tierField: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape accepted by the save action (server stamps id / timestamps / project). */
export interface ScoringRuleSetInput {
  /** Present → update; absent → insert. */
  id?: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  rules: ScoringRule[];
  tiers: ScoreTier[];
  scoreField?: string;
  tierField?: string;
}

/** Result of scoring one record against one rule set. */
export interface ScoreResult {
  score: number;
  /** The resolved tier, or null when no tier's `min` is reached. */
  tier: ScoreTier | null;
  /** Ids of the rules that fired (for the "why" breakdown). */
  matched: string[];
}

export const DEFAULT_SCORE_FIELD = 'score';
export const DEFAULT_TIER_FIELD = 'scoreTier';

/* -------------------------------------------------------------------------- */
/* Value coercion helpers (mirror records-filter operator semantics in-memory) */
/* -------------------------------------------------------------------------- */

/** True for missing, null, empty-string, or empty-array values. */
function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Best-effort text view of a (possibly composite) value, for eq/contains. */
function asText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['label', 'name', 'title', 'value', 'url', 'text']) {
      const c = o[k];
      if (typeof c === 'string' && c) return c;
      if (typeof c === 'number' || typeof c === 'boolean') return String(c);
    }
    return '';
  }
  return '';
}

/** Numeric view of a (possibly composite) value; NaN when not numeric. */
function asNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['amount', 'value', 'amountMicros']) {
      const c = o[k];
      if (typeof c === 'number') return k === 'amountMicros' ? c / 1_000_000 : c;
      if (typeof c === 'string' && c.trim() !== '') return Number(c);
    }
  }
  return Number.NaN;
}

/** Loose scalar equality used by eq/neq/in/notIn (string-normalized). */
function scalarEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const an = asNumber(a);
  const bn = asNumber(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an === bn;
  return asText(a).toLowerCase() === asText(b).toLowerCase();
}

function toArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [v];
}

function numCmp(
  raw: unknown,
  value: unknown,
  cmp: (a: number, b: number) => boolean,
): boolean {
  const a = asNumber(raw);
  const b = asNumber(value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return cmp(a, b);
}

/* -------------------------------------------------------------------------- */
/* Evaluation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Evaluate one condition against a record's `data` bag in memory. Mirrors the
 * Mongo translation in `conditionToMongo` (`./records-filter.ts`) so a rule
 * behaves identically whether previewed client-side or recomputed server-side.
 */
export function evalCondition(
  data: Record<string, unknown>,
  condition: FilterCondition,
): boolean {
  if (!condition?.field) return false;
  const op: FilterOperator = condition.op;
  const value = condition.value;
  const raw = data ? data[condition.field] : undefined;

  switch (op) {
    case 'isEmpty':
      return isEmpty(raw);
    case 'isNotEmpty':
      return !isEmpty(raw);
    case 'eq':
      return scalarEq(raw, value);
    case 'neq':
      return !scalarEq(raw, value);
    case 'contains':
      return asText(raw).toLowerCase().includes(asText(value).toLowerCase());
    case 'notContains':
      return !asText(raw).toLowerCase().includes(asText(value).toLowerCase());
    case 'gt':
      return numCmp(raw, value, (a, b) => a > b);
    case 'gte':
      return numCmp(raw, value, (a, b) => a >= b);
    case 'lt':
      return numCmp(raw, value, (a, b) => a < b);
    case 'lte':
      return numCmp(raw, value, (a, b) => a <= b);
    case 'in':
      return toArray(value).some((v) => scalarEq(raw, v));
    case 'notIn':
      return !toArray(value).some((v) => scalarEq(raw, v));
    default:
      return false;
  }
}

/** The highest tier whose `min` the score reaches, or null. */
export function resolveTier(
  tiers: ScoreTier[] | undefined,
  score: number,
): ScoreTier | null {
  if (!tiers || tiers.length === 0) return null;
  let best: ScoreTier | null = null;
  for (const t of tiers) {
    if (score >= t.min && (best === null || t.min > best.min)) best = t;
  }
  return best;
}

/**
 * Compute a record's score: the sum of the points of every rule whose
 * condition matches, plus the resolved tier and the ids of the rules that
 * fired. Pure + deterministic.
 */
export function computeScore(
  ruleSet: Pick<ScoringRuleSet, 'rules' | 'tiers'>,
  data: Record<string, unknown>,
): ScoreResult {
  let score = 0;
  const matched: string[] = [];
  for (const rule of ruleSet.rules ?? []) {
    if (!rule?.condition) continue;
    if (evalCondition(data, rule.condition)) {
      score += Number.isFinite(rule.points) ? Number(rule.points) : 0;
      matched.push(rule.id);
    }
  }
  return { score, tier: resolveTier(ruleSet.tiers, score), matched };
}

/** Distinct field keys referenced by a rule set's conditions (hash inputs). */
export function scoringSourceFields(
  ruleSet: Pick<ScoringRuleSet, 'rules'>,
): string[] {
  const out = new Set<string>();
  for (const r of ruleSet.rules ?? []) {
    if (r?.condition?.field) out.add(r.condition.field);
  }
  return [...out];
}
