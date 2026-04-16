/**
 * mergeNode — pure executor for the SabFlow "Merge" logic block.
 *
 * A Merge node has fan-in semantics: multiple incoming edges funnel their
 * per-branch outputs into a single array of items.  The executor is pure —
 * all inputs arrive as an array of arrays (one per predecessor) and a single
 * flattened / combined array is returned.  The engine is responsible for
 * collecting predecessor outputs and scheduling the call.
 *
 * All four n8n-style modes are supported:
 *
 *   - `append`     — concatenate every input array in order
 *   - `mergeByKey` — SQL-like inner/left join on a shared key
 *   - `multiplex`  — cartesian product across every input
 *   - `pickFirst`  — return the first non-empty input as-is
 */

import type { MergeOptions } from '@/lib/sabflow/types';

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** Returns true when the value is a plain (non-null, non-array) object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Safely reads a string-keyed property from an unknown value. */
function getKey(item: unknown, key: string): unknown {
  if (!isPlainObject(item)) return undefined;
  return item[key];
}

/** Coerces an unknown value to a stable string for key comparison. */
function toKeyString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/** Normalises a single input row into an array of items. */
function normaliseRow(row: unknown[] | undefined | null): unknown[] {
  if (!Array.isArray(row)) return [];
  return row.filter((v) => v !== undefined);
}

/* ── Executor ───────────────────────────────────────────────────────────── */

/**
 * Combines multiple fan-in input arrays into a single output array.
 *
 * @param inputs  one array per incoming edge (in predecessor order)
 * @param options merge configuration — mode, key, unpaired behaviour
 */
export function executeMerge(
  inputs: unknown[][],
  options: MergeOptions,
): unknown[] {
  const rows = Array.isArray(inputs) ? inputs.map(normaliseRow) : [];
  const mode = options.mode ?? 'append';

  // ── append ─────────────────────────────────────────────
  if (mode === 'append') {
    const out: unknown[] = [];
    for (const row of rows) {
      for (const item of row) out.push(item);
    }
    return out;
  }

  // ── pickFirst ──────────────────────────────────────────
  if (mode === 'pickFirst') {
    for (const row of rows) {
      if (row.length > 0) return [...row];
    }
    return [];
  }

  // ── multiplex (cartesian product) ──────────────────────
  if (mode === 'multiplex') {
    const nonEmpty = rows.filter((r) => r.length > 0);
    if (nonEmpty.length === 0) return [];

    let acc: Record<string, unknown>[] = [{}];
    for (let idx = 0; idx < nonEmpty.length; idx++) {
      const row = nonEmpty[idx];
      const next: Record<string, unknown>[] = [];
      for (const carry of acc) {
        for (const item of row) {
          const merged: Record<string, unknown> = { ...carry };
          if (isPlainObject(item)) {
            Object.assign(merged, item);
          } else {
            merged[`input_${idx}`] = item;
          }
          next.push(merged);
        }
      }
      acc = next;
    }
    return acc;
  }

  // ── mergeByKey ─────────────────────────────────────────
  if (mode === 'mergeByKey') {
    const field = options.mergeByField?.trim();
    if (!field) return [];

    // Anchor on the first non-empty input; join every other input into it.
    const [first, ...rest] = rows;
    if (!first || first.length === 0) return [];

    // Build keyed indexes for each other input.
    const indexes = rest.map((row) => {
      const map = new Map<string, Record<string, unknown>>();
      for (const item of row) {
        const keyVal = toKeyString(getKey(item, field));
        if (keyVal !== undefined && isPlainObject(item)) {
          map.set(keyVal, item);
        }
      }
      return map;
    });

    const seenKeys = indexes.map(() => new Set<string>());
    const out: Record<string, unknown>[] = [];

    for (const anchor of first) {
      if (!isPlainObject(anchor)) continue;
      const keyVal = toKeyString(anchor[field]);

      let merged: Record<string, unknown> = { ...anchor };
      let matchedAll = true;

      if (keyVal === undefined) {
        matchedAll = false;
      } else {
        for (let i = 0; i < indexes.length; i++) {
          const match = indexes[i].get(keyVal);
          if (match) {
            merged = { ...merged, ...match };
            seenKeys[i].add(keyVal);
          } else {
            matchedAll = false;
          }
        }
      }

      if (matchedAll || options.includeUnpaired) {
        out.push(merged);
      }
    }

    // Emit unpaired items from secondary inputs when requested.
    if (options.includeUnpaired) {
      for (let i = 0; i < rest.length; i++) {
        for (const item of rest[i]) {
          if (!isPlainObject(item)) continue;
          const keyVal = toKeyString(item[field]);
          if (keyVal === undefined || !seenKeys[i].has(keyVal)) {
            out.push({ ...item });
          }
        }
      }
    }

    return out;
  }

  return [];
}
