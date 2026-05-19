/**
 * Normalise a `resourceLocator` field value into the plain string id an
 * action expects.
 *
 *   { mode: 'url', value: 'https://app.slack.com/archives/C0123ABC' }
 *      → 'C0123ABC'              (via the URL mode's extractValue regex)
 *
 *   { mode: 'id',  value: 'C99' } → 'C99'
 *   { mode: 'list',value: 'C99' } → 'C99'
 *   'C01'  (legacy plain string)  → 'C01'
 *   null / undefined              → ''
 *
 * Mirrors the runtime contract of n8n's `IExecuteFunctions.getNodeParameter(name, { extractValue: true })`.
 * Centralised so the load-options route, the forge executor, and any
 * future Phase-3 search plumbing all agree on the same normalisation rule.
 */

import type { ForgeFieldMode, ResourceLocatorValue } from './types';

const VALID_MODES = new Set(['list', 'id', 'url', 'string']);

/** True when `v` is a well-formed ResourceLocatorValue. */
export function isResourceLocatorValue(v: unknown): v is ResourceLocatorValue {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.mode === 'string' &&
    VALID_MODES.has(r.mode) &&
    typeof r.value === 'string'
  );
}

/**
 * Normalise `v` to its underlying id string. Accepts either a
 * ResourceLocatorValue or a legacy plain string. Never throws — a broken
 * regex in the field declaration falls through to the raw value so a
 * misconfigured mode degrades gracefully.
 */
export function extractValue(
  v: ResourceLocatorValue | string | null | undefined,
  modes: ForgeFieldMode[] | undefined,
): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (!isResourceLocatorValue(v)) return '';

  const mode = modes?.find((m) => m.name === v.mode);
  if (mode?.extractValue?.type === 'regex' && typeof v.value === 'string') {
    try {
      const re = new RegExp(mode.extractValue.regex);
      const m = re.exec(v.value);
      if (m && m[1] != null) return m[1];
    } catch {
      // Invalid regex in field declaration — fall through.
    }
  }
  return v.value;
}
