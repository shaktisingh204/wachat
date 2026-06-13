/**
 * SabCRM — lookup fields — PURE resolver.
 *
 * `'server-only'`- and I/O-free (unit-testable). A lookup field MIRRORS a value
 * from a related (PARENT) record onto this record and keeps it in sync — the
 * Salesforce "lookup field". This record carries a RELATION field
 * ({@link LookupFieldConfig.relationField}) holding the parent's id; the lookup
 * copies the parent's `data[sourceKey]` into this record's `data[targetKey]`.
 *
 * The Mongo persistence + recompute (follow the relation, fetch the parent via
 * the Rust records path, write the mirrored scalar) live in `./lookup.server.ts`;
 * this module is just the deterministic value-pick + types — the same split as
 * `./formula.ts` / `./rollup.ts`.
 *
 * The resolved value is stored as a plain scalar at `data[targetKey]` (recompute
 * metadata at `data.__lookup.<targetKey>`), so the records engine renders /
 * filters / sorts it with zero change — same AI-fields envelope as formula +
 * rollup + scoring fields.
 */

/** A lookup field definition: mirror parent `sourceKey` → this `targetKey`. */
export interface LookupFieldConfig {
  /** Stable identity of this lookup (the persisted doc key / target field key). */
  key: string;
  /**
   * The RELATION field ON THIS object whose stored value is the PARENT record's
   * id. The recompute follows this id to fetch the parent.
   */
  relationField: string;
  /** Slug of the parent object the relation points at (e.g. `companies`). */
  parentObject: string;
  /** Field key on the PARENT whose value is copied. */
  sourceKey: string;
  /** Field key on THIS record the mirrored value is written to. */
  targetKey: string;
}

/** Outcome of one lookup resolution. */
export interface LookupResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

/**
 * Pull the parent id stored in this record's relation field. A RELATION value
 * is normally a bare id string, but may arrive as `{ id }` (an enriched hint) or
 * a single-element array; this normalises all three to the hex id string, or
 * `null` when empty / unresolvable. Pure.
 */
export function lookupParentId(
  recordData: Record<string, unknown> | null | undefined,
  relationField: string,
): string | null {
  const raw = recordData?.[relationField];
  return normalizeRelationId(raw);
}

function normalizeRelationId(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    return s.length > 0 ? s : null;
  }
  if (Array.isArray(raw)) {
    // A MANY_TO_ONE relation occasionally serialises as a single-element list.
    return raw.length > 0 ? normalizeRelationId(raw[0]) : null;
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const k of ['id', '_id', 'value']) {
      const c = o[k];
      if (typeof c === 'string' && c.trim().length > 0) return c.trim();
    }
  }
  return null;
}

/**
 * Resolve a lookup's mirrored value from the PARENT record's data. Returns the
 * raw value at `parentData[sourceKey]` verbatim (no coercion — a lookup mirrors,
 * it does not transform). A missing key resolves to `null` (the field is cleared
 * downstream) rather than `undefined`, so a dotted `$set` always writes a value.
 * Never throws.
 */
export function resolveLookup(
  parentData: Record<string, unknown> | null | undefined,
  sourceKey: string,
): LookupResult {
  if (!sourceKey || typeof sourceKey !== 'string') {
    return { ok: false, error: 'empty sourceKey' };
  }
  if (!parentData || typeof parentData !== 'object') {
    return { ok: true, value: null };
  }
  const raw = parentData[sourceKey];
  return { ok: true, value: raw === undefined ? null : raw };
}

/** Validate a config has every field needed to resolve. Pure. */
export function isResolvableLookup(
  config: Partial<LookupFieldConfig> | null | undefined,
): config is LookupFieldConfig {
  return Boolean(
    config &&
      config.relationField &&
      config.parentObject &&
      config.sourceKey &&
      config.targetKey,
  );
}
