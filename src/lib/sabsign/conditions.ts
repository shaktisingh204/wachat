import type { EnvelopeField, FieldCondition } from '@/lib/rust-client/sabsign-envelopes';

/**
 * Conditional-field + formula evaluation, shared by the signer portal (and
 * usable by the builder preview). Pure functions over the current field-value
 * map (`fieldId -> string`).
 */

export function evalCondition(
  cond: FieldCondition,
  values: Record<string, string>,
): boolean {
  const v = values[cond.whenFieldId] ?? '';
  const target = cond.value ?? '';
  switch (cond.op) {
    case 'equals':
      return v === target;
    case 'not_equals':
      return v !== target;
    case 'contains':
      return v.includes(target);
    case 'truthy':
      return !!v && v !== 'false' && v !== '0' && v !== 'off';
    case 'gt':
      return parseFloat(v) > parseFloat(target);
    case 'lt':
      return parseFloat(v) < parseFloat(target);
    default:
      return false;
  }
}

/**
 * Effective visibility + required-ness for a field given current values.
 * A field with any `show` rule starts hidden and appears only when a show-rule
 * matches; `hide` rules hide on match; `require` rules force required on match.
 */
export function fieldVisibility(
  field: EnvelopeField,
  values: Record<string, string>,
): { visible: boolean; required: boolean } {
  let visible = true;
  let required = !!field.required;
  const conds = field.conditions ?? [];
  if (conds.some((c) => c.action === 'show')) visible = false;
  for (const c of conds) {
    const met = evalCondition(c, values);
    if (c.action === 'show' && met) visible = true;
    if (c.action === 'hide' && met) visible = false;
    if (c.action === 'require' && met) required = true;
  }
  return { visible, required };
}

/**
 * Compute a formula field's value. Supported: `sum:a,b`, `avg:a,b`, `min:a,b`,
 * `max:a,b`, `concat:a,b`. Returns `null` for non-formula / unknown ops.
 */
export function computeFormula(
  field: EnvelopeField,
  values: Record<string, string>,
): string | null {
  const f = field.formula;
  if (!f) return null;
  const idx = f.indexOf(':');
  const op = (idx >= 0 ? f.slice(0, idx) : f).trim().toLowerCase();
  const ids = (idx >= 0 ? f.slice(idx + 1) : '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const nums = ids
    .map((id) => parseFloat(values[id] ?? ''))
    .filter((n) => Number.isFinite(n));
  switch (op) {
    case 'sum':
      return String(nums.reduce((a, b) => a + b, 0));
    case 'avg':
      return nums.length ? String(nums.reduce((a, b) => a + b, 0) / nums.length) : '0';
    case 'min':
      return nums.length ? String(Math.min(...nums)) : '';
    case 'max':
      return nums.length ? String(Math.max(...nums)) : '';
    case 'concat':
      return ids.map((id) => values[id] ?? '').join(' ');
    default:
      return null;
  }
}
