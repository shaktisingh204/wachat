/**
 * SabCRM — data-quality scoring — PURE evaluator helpers.
 *
 * The data-health sibling of `./scoring.ts` and `./validation.ts`: a
 * `'server-only'`- and I/O-free module so the unit tests (`tsx --test`) AND a
 * `'use client'` dashboard can import the types + the deterministic math
 * directly. The Mongo aggregation / write-back side effects live in
 * `./data-quality-score.server.ts`, which re-exports everything here.
 *
 * ## Model
 *
 * {@link scoreRecord} grades ONE record on three axes, each 0–100, plus an
 * `overall` (their weighted mean) and an `issues[]` breakdown:
 *
 *   - **completeness** — share of the object's user-facing fields that carry a
 *     non-empty value. `required` fields are weighted double (a blank required
 *     field hurts the score more and emits a `missing-required` issue).
 *   - **validity** — share of the project's enabled VALIDATION rules that do
 *     NOT fire. A validation rule's `condition` describes the VIOLATION (see
 *     `./validation.ts`), so a rule that matches is a failure. `block` rules
 *     weigh double vs `warn` rules. Reuses {@link evalCondition} (imported from
 *     `./validation` per the vertical brief) for identical semantics to the
 *     records engine + write-time validation.
 *   - **freshness** — how recently the record was touched, decayed from its
 *     `updatedAt` age against {@link FRESHNESS_HALF_LIFE_DAYS} /
 *     {@link FRESHNESS_STALE_DAYS}. A record updated today scores ~100; one
 *     older than the stale horizon scores 0 and emits a `stale` issue.
 *
 * `overall` = completeness·Wc + validity·Wv + freshness·Wf (weights in
 * {@link DEFAULT_HEALTH_WEIGHTS}, renormalised over whichever axes apply — an
 * object with no validation rules drops the validity axis rather than scoring 0
 * on it).
 *
 * ## Storage envelope (see `./data-quality-score.server.ts`)
 *
 * The per-record breakdown rides the reserved `data.__dq` subkey
 * (`{ completeness, validity, freshness, overall, issues, computedAt }`),
 * exactly like the AI-fields `data.__ai.<key>` + scoring `data.__score.<id>`
 * envelopes — a scalar `$set` both stores serve, written WITHOUT bumping the
 * record's top-level `updatedAt` (a health write must not reset the
 * deal-rotting / `time.elapsed` idle clocks or re-trigger record workflows).
 */

import type { FieldMetadata } from './types';
import type { ValidationRule } from './validation';
// `evalCondition` is the in-memory condition evaluator the records engine,
// scoring AND write-time validation all share. Its canonical export lives in
// `./scoring` (`./validation` imports it from there but does not re-export it),
// so we import it from the source to get identical semantics with no cycle.
import { evalCondition } from './scoring';

/* -------------------------------------------------------------------------- */
/* Tunables                                                                    */
/* -------------------------------------------------------------------------- */

/** Axis weights for `overall` (renormalised over the axes that apply). */
export const DEFAULT_HEALTH_WEIGHTS = {
  completeness: 0.4,
  validity: 0.4,
  freshness: 0.2,
} as const;

/** Age (days) at which freshness has decayed to 50. */
export const FRESHNESS_HALF_LIFE_DAYS = 30;

/** Age (days) at or beyond which freshness is 0 and a `stale` issue fires. */
export const FRESHNESS_STALE_DAYS = 180;

/** Severity of a single data-quality issue (drives the dashboard badge tone). */
export type DataQualityIssueKind =
  | 'missing-required'
  | 'missing'
  | 'invalid-block'
  | 'invalid-warn'
  | 'stale';

/** One thing wrong with a record. */
export interface DataQualityIssue {
  kind: DataQualityIssueKind;
  /** Field key (completeness issues) or rule id (validity issues), else ''. */
  ref: string;
  /** Human label shown in the worst-records table. */
  message: string;
}

/** The 0–100 breakdown {@link scoreRecord} returns for one record. */
export interface DataQualityScore {
  completeness: number;
  validity: number;
  freshness: number;
  /** Weighted mean of the applicable axes, 0–100. */
  overall: number;
  issues: DataQualityIssue[];
}

/* -------------------------------------------------------------------------- */
/* Emptiness (mirrors scoring.ts `isEmpty`, incl. composite values)           */
/* -------------------------------------------------------------------------- */

/**
 * True for missing, null, empty-string, empty-array, or a composite/object
 * whose every leaf is itself empty (e.g. an all-blank FULL_NAME / ADDRESS).
 */
export function isValueEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'number') return Number.isNaN(v);
  if (Array.isArray(v)) return v.length === 0 || v.every(isValueEmpty);
  if (typeof v === 'object') {
    const vals = Object.values(v as Record<string, unknown>);
    if (vals.length === 0) return true;
    return vals.every(isValueEmpty);
  }
  return false;
}

/** Round to an int in 0..100. */
function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/* -------------------------------------------------------------------------- */
/* Field selection                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The fields that count toward completeness: user-facing, non-system fields
 * whose key is not a reserved `__*` namespace and that aren't the computed
 * health/score/AI display fields themselves (so health doesn't grade itself).
 */
export function completenessFields(
  fieldDefs: FieldMetadata[] | undefined,
): FieldMetadata[] {
  const reserved = new Set(['score', 'scoreTier']);
  return (fieldDefs ?? []).filter((f) => {
    if (!f?.key) return false;
    if (f.key.startsWith('__')) return false;
    if (f.system) return false;
    if (f.type === 'AI') return false; // computed, not user-entered
    if (reserved.has(f.key)) return false;
    return true;
  });
}

/* -------------------------------------------------------------------------- */
/* Axis scorers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Completeness 0–100: weighted share of fields carrying a non-empty value.
 * `required` fields weigh double. Returns 100 when there are no gradable
 * fields (nothing to be incomplete about). Pushes a `missing` /
 * `missing-required` issue per blank field.
 */
export function scoreCompleteness(
  data: Record<string, unknown>,
  fields: FieldMetadata[],
  issues: DataQualityIssue[],
): number {
  if (fields.length === 0) return 100;
  let total = 0;
  let earned = 0;
  for (const f of fields) {
    const weight = f.required ? 2 : 1;
    total += weight;
    const empty = isValueEmpty(data?.[f.key]);
    if (!empty) {
      earned += weight;
    } else {
      issues.push({
        kind: f.required ? 'missing-required' : 'missing',
        ref: f.key,
        message: f.required
          ? `Required field "${f.label || f.key}" is empty`
          : `"${f.label || f.key}" is empty`,
      });
    }
  }
  return clampPct((earned / total) * 100);
}

/**
 * Validity 0–100: weighted share of validation rules that do NOT fire. A rule's
 * `condition` describes the VIOLATION, so a matching rule is a failure;
 * `block` rules weigh double vs `warn`. Disabled rules (and conditionless ones)
 * are skipped. Returns 100 when no rules apply. Pushes one issue per fired rule.
 */
export function scoreValidity(
  data: Record<string, unknown>,
  rules: ValidationRule[] | undefined,
  issues: DataQualityIssue[],
): number {
  const active = (rules ?? []).filter(
    (r) => r && r.enabled !== false && r.condition,
  );
  if (active.length === 0) return 100;
  let total = 0;
  let earned = 0;
  for (const rule of active) {
    const weight = rule.severity === 'block' ? 2 : 1;
    total += weight;
    const fired = evalCondition(data, rule.condition);
    if (!fired) {
      earned += weight;
    } else {
      issues.push({
        kind: rule.severity === 'block' ? 'invalid-block' : 'invalid-warn',
        ref: rule.id,
        message: rule.message || rule.label || 'Validation rule failed',
      });
    }
  }
  return clampPct((earned / total) * 100);
}

/**
 * Freshness 0–100 from `updatedAt` age, relative to `now` (ms epoch).
 *
 *   - missing / unparseable `updatedAt` → 50 (unknown, neither fresh nor stale)
 *   - age ≤ 0 (just updated / clock skew) → 100
 *   - age ≥ {@link FRESHNESS_STALE_DAYS} → 0 (+ a `stale` issue)
 *   - otherwise exponential decay with {@link FRESHNESS_HALF_LIFE_DAYS}.
 */
export function scoreFreshness(
  updatedAt: string | number | Date | undefined | null,
  now: number,
  issues: DataQualityIssue[],
): number {
  if (updatedAt === undefined || updatedAt === null || updatedAt === '') {
    return 50;
  }
  const t =
    updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return 50;
  const ageDays = (now - t) / 86_400_000;
  if (ageDays <= 0) return 100;
  if (ageDays >= FRESHNESS_STALE_DAYS) {
    issues.push({
      kind: 'stale',
      ref: '',
      message: `Not updated in ${Math.round(ageDays)} days`,
    });
    return 0;
  }
  const decayed = 100 * Math.pow(0.5, ageDays / FRESHNESS_HALF_LIFE_DAYS);
  return clampPct(decayed);
}

/* -------------------------------------------------------------------------- */
/* Record scorer                                                              */
/* -------------------------------------------------------------------------- */

/** The minimum record shape {@link scoreRecord} reads. */
export interface ScorableRecord {
  data?: Record<string, unknown>;
  updatedAt?: string | number | Date | null;
}

/**
 * Grade one record across completeness / validity / freshness and combine into
 * an `overall`. Pure + deterministic given `now` (defaults to `Date.now()`).
 *
 * The validity axis is DROPPED from the `overall` mean when the project has no
 * applicable validation rules (an object you haven't written rules for is not
 * penalised for it) — the remaining weights renormalise. Freshness is always
 * applicable; completeness is always applicable (100 when no fields).
 *
 * @param record     The record (reads `data` + `updatedAt`).
 * @param fieldDefs  The object's field metadata (drives completeness).
 * @param validationRules Enabled validation rules for the object (drives validity).
 * @param now        Epoch ms reference for freshness (default `Date.now()`).
 */
export function scoreRecord(
  record: ScorableRecord,
  fieldDefs: FieldMetadata[],
  validationRules: ValidationRule[],
  now: number = Date.now(),
): DataQualityScore {
  const data = record?.data ?? {};
  const issues: DataQualityIssue[] = [];

  const fields = completenessFields(fieldDefs);
  const activeRules = (validationRules ?? []).filter(
    (r) => r && r.enabled !== false && r.condition,
  );

  const completeness = scoreCompleteness(data, fields, issues);
  const validity = scoreValidity(data, activeRules, issues);
  const freshness = scoreFreshness(record?.updatedAt ?? null, now, issues);

  // Renormalise weights over the axes that apply (drop validity when no rules).
  const W = DEFAULT_HEALTH_WEIGHTS;
  const axes: Array<[number, number]> = [
    [completeness, W.completeness],
    [freshness, W.freshness],
  ];
  if (activeRules.length > 0) axes.push([validity, W.validity]);
  const weightSum = axes.reduce((s, [, w]) => s + w, 0);
  const overall =
    weightSum > 0
      ? clampPct(axes.reduce((s, [v, w]) => s + v * w, 0) / weightSum)
      : 100;

  // Worst issues first for the dashboard breakdown.
  issues.sort((a, b) => issueSeverity(b.kind) - issueSeverity(a.kind));

  return { completeness, validity, freshness, overall, issues };
}

/** Relative severity used to order an issue list (higher = worse). */
export function issueSeverity(kind: DataQualityIssueKind): number {
  switch (kind) {
    case 'invalid-block':
      return 4;
    case 'missing-required':
      return 3;
    case 'invalid-warn':
      return 2;
    case 'stale':
      return 1;
    case 'missing':
    default:
      return 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

/** Aggregate health for one object across many scored records. */
export interface ObjectHealthSummary {
  objectSlug: string;
  /** Number of records graded. */
  count: number;
  avgCompleteness: number;
  avgValidity: number;
  avgFreshness: number;
  avgOverall: number;
  /** Lowest-`overall` records (worst first), capped for the table. */
  worst: WorstRecord[];
}

/** One row in the "worst records" table. */
export interface WorstRecord {
  id: string;
  /** Best-effort human label for the record. */
  label: string;
  overall: number;
  completeness: number;
  validity: number;
  freshness: number;
  /** Top issue messages (capped). */
  issues: string[];
}

/** A scored record plus its identity, fed to {@link summarizeObjectHealth}. */
export interface ScoredRecordRow {
  id: string;
  label: string;
  score: DataQualityScore;
}

/** Mean of `nums`, rounded to an int 0..100; 0 for an empty list. */
function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return clampPct(nums.reduce((s, n) => s + n, 0) / nums.length);
}

/**
 * Roll a batch of scored records into an {@link ObjectHealthSummary}, including
 * the `worstLimit` lowest-`overall` records (ties broken by completeness then
 * id, for a stable order). Pure.
 */
export function summarizeObjectHealth(
  objectSlug: string,
  rows: ScoredRecordRow[],
  worstLimit = 25,
): ObjectHealthSummary {
  const count = rows.length;
  const summary: ObjectHealthSummary = {
    objectSlug,
    count,
    avgCompleteness: avg(rows.map((r) => r.score.completeness)),
    avgValidity: avg(rows.map((r) => r.score.validity)),
    avgFreshness: avg(rows.map((r) => r.score.freshness)),
    avgOverall: avg(rows.map((r) => r.score.overall)),
    worst: [],
  };

  const worst = [...rows]
    .sort((a, b) => {
      if (a.score.overall !== b.score.overall) {
        return a.score.overall - b.score.overall;
      }
      if (a.score.completeness !== b.score.completeness) {
        return a.score.completeness - b.score.completeness;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, Math.max(0, worstLimit))
    .map<WorstRecord>((r) => ({
      id: r.id,
      label: r.label,
      overall: r.score.overall,
      completeness: r.score.completeness,
      validity: r.score.validity,
      freshness: r.score.freshness,
      issues: r.score.issues.slice(0, 4).map((i) => i.message),
    }));

  summary.worst = worst;
  return summary;
}
