/**
 * Shared JSON-parsing helpers used by ported n8n forge blocks.
 *
 * Goals:
 *   - Consistent, label-augmented error messages so end-users can tell which
 *     field on which block failed to parse.
 *   - Treat empty/undefined input as an empty container (object/array) — that's
 *     the convention every block uses for optional JSON fields.
 *   - Distinguish between "not valid JSON" and "wrong shape" so the error
 *     message actually helps the user debug their input.
 */

import { asString } from './http';

/**
 * Parse a JSON object string with a label-augmented error message.
 * Returns {} for empty/undefined input.
 * Throws Error('<label> is not valid JSON — <reason>') on parse failure.
 * Throws Error('<label> must be a JSON object, not an array/primitive') if not an object.
 */
export function parseJsonObject<T = Record<string, unknown>>(raw: unknown, label: string): T {
  const s = asString(raw).trim();
  if (!s) return {} as T;
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${label} is not valid JSON — ${reason}`);
  }
  if (Array.isArray(v)) {
    throw new Error(`${label} must be a JSON object, not an array`);
  }
  if (v === null || typeof v !== 'object') {
    throw new Error(`${label} must be a JSON object, not a primitive`);
  }
  return v as T;
}

/**
 * Parse a JSON array string. Returns [] for empty/undefined input.
 * Throws on parse failure with a label-augmented message.
 * Throws if the parsed value is not an array.
 */
export function parseJsonArray<T = unknown>(raw: unknown, label: string): T[] {
  const s = asString(raw).trim();
  if (!s) return [];
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${label} is not valid JSON — ${reason}`);
  }
  if (!Array.isArray(v)) {
    throw new Error(`${label} must be a JSON array`);
  }
  return v as T[];
}

/**
 * Parse arbitrary JSON. Returns the parsed value (could be array, object, primitive).
 * Throws on parse failure.
 */
export function parseJson<T = unknown>(raw: unknown, label: string): T {
  const s = asString(raw).trim();
  if (!s) return undefined as T;
  try {
    return JSON.parse(s) as T;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${label} is not valid JSON — ${reason}`);
  }
}
