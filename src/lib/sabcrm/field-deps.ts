/**
 * SabCRM — field dependencies (dependent picklists) — PURE logic.
 *
 * `'server-only'`- and I/O-free (unit-testable), the data-quality sibling of
 * `./validation.ts` and the picklist analogue of `./formula.ts`. A
 * {@link DependencyRule} makes the allowed options of a *controlled* SELECT
 * field (`dependentField`) depend on the current value of a *controlling*
 * field (`controllingField`) — Salesforce "field dependencies".
 *
 * ## Model
 *
 * `map` is keyed by a controlling value → the list of dependent values that are
 * allowed when the controlling field holds that value. A controlling value with
 * no entry in `map` (or an empty list) imposes NO restriction — every dependent
 * value is allowed (so dependencies are additive, never accidentally lock out
 * un-mapped branches). An empty / missing controlling value likewise imposes no
 * restriction (nothing to depend on yet).
 *
 * The Mongo persistence + write-time enforcement live in
 * `./field-deps.server.ts`; this module is just the deterministic predicates.
 */

/** A persisted field-dependency rule scoped to one object. */
export interface DependencyRule {
  /** Object slug the rule applies to (e.g. `leads`). */
  object: string;
  /** Field key whose value drives the allowed options (the parent SELECT). */
  controllingField: string;
  /** Field key whose options are constrained (the child SELECT). */
  dependentField: string;
  /**
   * controlling value → allowed dependent values. A controlling value absent
   * from this map (or mapped to an empty array) is UNRESTRICTED.
   */
  map: Record<string, string[]>;
}

/** Normalise any stored value to the string key the `map` is indexed by. */
function keyOf(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/**
 * The dependent values allowed when the controlling field holds
 * `controllingValue`, per `depMap`. Returns `null` when there is NO restriction
 * (un-mapped / empty controlling value, or an explicit empty allow-list) so a
 * caller can distinguish "all options" from "exactly these". Pure.
 */
export function allowedOptionsOrNull(
  controllingValue: unknown,
  depMap: Record<string, string[]> | undefined | null,
): string[] | null {
  if (!depMap) return null;
  const key = keyOf(controllingValue);
  if (key === '') return null;
  const list = depMap[key];
  if (!Array.isArray(list) || list.length === 0) return null;
  // De-dupe + drop empties while preserving the authored order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    const s = keyOf(v);
    if (s === '' || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.length > 0 ? out : null;
}

/**
 * The dependent values allowed for `controllingValue` per `depMap`. Unlike
 * {@link allowedOptionsOrNull} this collapses "no restriction" to `[]` (the
 * empty array), which the record form reads as "fall back to the field's full
 * option set". Pure.
 */
export function allowedOptions(
  controllingValue: unknown,
  depMap: Record<string, string[]> | undefined | null,
): string[] {
  return allowedOptionsOrNull(controllingValue, depMap) ?? [];
}

/**
 * Is `dependentValue` a valid choice given `controllingValue` per `depMap`?
 *
 * - An empty / missing `dependentValue` is always valid (a required-field check
 *   is the validation layer's job, not the dependency's).
 * - When the controlling value imposes no restriction, every dependent value is
 *   valid.
 * - Otherwise the dependent value must appear in the allow-list. Pure.
 */
export function isComboValid(
  controllingValue: unknown,
  dependentValue: unknown,
  depMap: Record<string, string[]> | undefined | null,
): boolean {
  const dep = keyOf(dependentValue);
  if (dep === '') return true;
  const allowed = allowedOptionsOrNull(controllingValue, depMap);
  if (allowed === null) return true;
  return allowed.includes(dep);
}
