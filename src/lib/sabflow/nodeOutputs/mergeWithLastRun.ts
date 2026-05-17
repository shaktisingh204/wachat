/**
 * Merge a block's declared output schema with the keys actually observed in
 * its most recent execution result.  The picker uses the union so that:
 *
 *   1. Declared fields are always present with nice labels + types.
 *   2. Extra keys returned by a real run (e.g. a webhook that responded with
 *      an unexpected shape) still appear, so the user can pick them.
 *   3. When no schema is declared at all, the picker still works — every
 *      visible key from the last run becomes a pickable field.
 *
 * Type inference is best-effort: we look at the JS typeof on the observed
 * value and map to one of our `NodeOutputFieldType` slots.
 */

import type { NodeOutputField, NodeOutputFieldType } from './schema';

/** Recursive depth limit for key extraction. */
const MAX_DEPTH = 4;
/** Max keys returned — prevents enormous outputs from flooding the picker. */
const MAX_KEYS = 200;

export function mergeWithLastRun(
  declared: NodeOutputField[] | undefined,
  lastRun: unknown,
): NodeOutputField[] {
  const declaredMap = new Map<string, NodeOutputField>();
  for (const f of declared ?? []) declaredMap.set(f.key, f);

  if (lastRun === null || lastRun === undefined) {
    return Array.from(declaredMap.values());
  }

  const observed = extractKeys(lastRun);
  for (const key of observed) {
    if (declaredMap.has(key)) {
      // Already declared — overwrite `example` with the real last-run value
      // so the picker preview always reflects actual recent data, never the
      // placeholder.  This matches n8n's Output pane behaviour.
      const existing = declaredMap.get(key)!;
      const sample = readPath(lastRun, key);
      if (sample !== undefined) {
        declaredMap.set(key, { ...existing, example: sample });
      }
      continue;
    }
    const sample = readPath(lastRun, key);
    declaredMap.set(key, {
      key,
      label: humaniseKey(key),
      type: inferType(sample),
      example: sample,
    });
    if (declaredMap.size >= MAX_KEYS) break;
  }

  return Array.from(declaredMap.values());
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function extractKeys(value: unknown, prefix = '', depth = 0): string[] {
  if (depth >= MAX_DEPTH) return prefix ? [prefix] : [];
  if (value === null || value === undefined) return prefix ? [prefix] : [];

  if (Array.isArray(value)) {
    if (value.length === 0) return prefix ? [prefix] : [];
    // Sample the first element only — flow runs typically have homogeneous arrays.
    const childKeys = extractKeys(value[0], `${prefix}${prefix ? '.' : ''}0`, depth + 1);
    return prefix ? [prefix, ...childKeys] : childKeys;
  }

  if (typeof value === 'object') {
    const out: string[] = [];
    for (const k of Object.keys(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      const child = (value as Record<string, unknown>)[k];
      if (child !== null && typeof child === 'object') {
        out.push(...extractKeys(child, path, depth + 1));
      } else {
        out.push(path);
      }
    }
    return out;
  }

  return prefix ? [prefix] : [];
}

function readPath(value: unknown, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = value;
  for (const part of parts) {
    if (cursor === null || cursor === undefined) return undefined;
    if (Array.isArray(cursor)) {
      const idx = Number(part);
      if (!Number.isInteger(idx)) return undefined;
      cursor = cursor[idx];
      continue;
    }
    if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[part];
      continue;
    }
    return undefined;
  }
  return cursor;
}

function inferType(value: unknown): NodeOutputFieldType {
  if (value === null || value === undefined) return 'string';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  switch (typeof value) {
    case 'string':
      return looksLikeIsoDate(value) ? 'date' : 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;
function looksLikeIsoDate(s: string): boolean {
  return ISO_DATE.test(s);
}

/**
 * Convert a dotted key to a human label: `usage.total_tokens` → "Usage total tokens".
 */
function humaniseKey(key: string): string {
  return key
    .split('.')
    .map((seg) =>
      seg
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase()),
    )
    .join(' › ');
}
