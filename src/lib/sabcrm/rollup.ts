/**
 * SabCRM — rollup fields — PURE op math.
 *
 * `'server-only'`- and I/O-free (unit-testable). A rollup aggregates CHILD
 * records that point at a parent via a relation field (count / sum / avg / min
 * / max over a child field). The Mongo retrieval + recompute live in
 * `./rollup.server.ts`; this module is just the deterministic reducer + types.
 */

export type RollupOp = 'count' | 'sum' | 'avg' | 'min' | 'max';

export const ROLLUP_OPS: ReadonlySet<string> = new Set<RollupOp>([
  'count',
  'sum',
  'avg',
  'min',
  'max',
]);

/** A persisted rollup field definition. */
export interface RollupField {
  id: string;
  projectId: string;
  /** Parent object the rollup result is written onto. */
  objectSlug: string;
  /** Field key on the parent the result is written to. */
  fieldKey: string;
  name?: string;
  /** Child object whose records are aggregated. */
  childObject: string;
  /** Field on the CHILD whose value === the parent record id. */
  childRelationField: string;
  op: RollupOp;
  /** Child field to aggregate (required for sum/avg/min/max; ignored for count). */
  childTargetField?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RollupFieldInput {
  id?: string;
  objectSlug: string;
  fieldKey: string;
  name?: string;
  childObject: string;
  childRelationField: string;
  op: RollupOp;
  childTargetField?: string;
  enabled: boolean;
}

/** Coerce a (possibly composite) child value to a number; NaN-safe. */
function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['amount', 'value', 'amountMicros']) {
      const c = o[k];
      if (typeof c === 'number') return k === 'amountMicros' ? c / 1_000_000 : c;
    }
  }
  return Number.NaN;
}

/**
 * Reduce one child value per child into the rollup result. `rawValues` carries
 * exactly one entry per matching child (so `count` = length); sum/avg/min/max
 * coerce each entry to a number and ignore non-numeric ones. Pure.
 */
export function computeRollup(op: RollupOp, rawValues: unknown[]): number {
  if (op === 'count') return rawValues.length;
  const nums = rawValues.map(num).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return 0;
  switch (op) {
    case 'sum':
      return Math.round(nums.reduce((a, b) => a + b, 0) * 1e6) / 1e6;
    case 'avg':
      return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1e6) / 1e6;
    case 'min':
      return Math.min(...nums);
    case 'max':
      return Math.max(...nums);
    default:
      return 0;
  }
}
