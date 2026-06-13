/**
 * SabCRM — global picklist value-sets — PURE model + helpers.
 *
 * `'server-only'`- and I/O-free (unit-testable). A **global value-set** is a
 * reusable, centrally-managed option list (Salesforce "global value set") that
 * many SELECT / MULTI_SELECT fields share: instead of every field carrying its
 * own `options[]`, a field opts in by referencing a set's id, and the record
 * form / option resolver expands that reference into live {@link FieldOption}s
 * at render time. Values can be **added** or **deprecated** (deactivated, never
 * hard-removed so historical records keep their meaning).
 *
 * The Mongo persistence (`sabcrm_value_sets`) + the field-option resolver live
 * in `./value-sets.server.ts`; this module is just the deterministic shape +
 * the two pure operations (`activeValues`, `validateValue`) the server and the
 * `'use client'` settings editor both import.
 */

import type { FieldOption } from './types';

/** One option in a value-set. `active:false` = deprecated (hidden on new picks). */
export interface ValueSetValue {
  /** Stored scalar written to `data.<fieldKey>` (stable; never reused). */
  value: string;
  /** Human label shown in the picker. */
  label: string;
  /** Token name from the `--ui20-*` palette or a hex color (optional). */
  color?: string;
  /** Deprecated values are excluded from new picks but kept for old records. */
  active: boolean;
}

/** A reusable, centrally-managed option list shared by many SELECT fields. */
export interface GlobalValueSet {
  /** Stable id (the value SELECT fields store in `settings.valueSetId`). */
  id: string;
  /** Display name, e.g. "Industries" or "Lead sources". */
  name: string;
  values: ValueSetValue[];
}

/**
 * Active (non-deprecated) values of a set, in declared order. Deprecated values
 * are dropped so they no longer appear in new picks. Pure.
 */
export function activeValues(set: Pick<GlobalValueSet, 'values'>): ValueSetValue[] {
  return (set?.values ?? []).filter((v) => v && v.active !== false && !!v.value);
}

/**
 * Whether `value` is a known value of the set. By default only **active**
 * values validate (the write-time semantics — you can't pick a deprecated
 * value on a new save); pass `{ allowDeprecated: true }` to also accept already
 * deprecated values (e.g. when re-validating a historical record). Pure.
 */
export function validateValue(
  set: Pick<GlobalValueSet, 'values'>,
  value: unknown,
  opts: { allowDeprecated?: boolean } = {},
): boolean {
  if (value === null || value === undefined || value === '') return false;
  const v = String(value);
  const pool = opts.allowDeprecated ? (set?.values ?? []) : activeValues(set);
  return pool.some((o) => o.value === v);
}

/** Project the active values of a set into records-engine {@link FieldOption}s. */
export function valueSetToOptions(
  set: Pick<GlobalValueSet, 'values'>,
): FieldOption[] {
  return activeValues(set).map((v) => ({
    value: v.value,
    label: v.label || v.value,
    ...(v.color ? { color: v.color } : {}),
  }));
}

/**
 * Normalise a raw value (from the settings editor) into a {@link ValueSetValue}.
 * Trims `value` / `label`, defaults `active` to `true`, drops an empty value.
 * Returns null for an unusable entry. Pure.
 */
export function normalizeValue(raw: {
  value?: unknown;
  label?: unknown;
  color?: unknown;
  active?: unknown;
}): ValueSetValue | null {
  const value = typeof raw.value === 'string' ? raw.value.trim() : '';
  if (!value) return null;
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : value;
  const color =
    typeof raw.color === 'string' && raw.color.trim() ? raw.color.trim() : undefined;
  return { value, label, color, active: raw.active !== false };
}

/**
 * De-duplicate values by `value` (first wins) and normalise each. Used by the
 * server before persisting a set so a picklist never carries two entries with
 * the same stored scalar. Pure.
 */
export function dedupeValues(
  raw: ReadonlyArray<Parameters<typeof normalizeValue>[0]>,
): ValueSetValue[] {
  const seen = new Set<string>();
  const out: ValueSetValue[] = [];
  for (const r of raw ?? []) {
    const n = normalizeValue(r);
    if (!n || seen.has(n.value)) continue;
    seen.add(n.value);
    out.push(n);
  }
  return out;
}
