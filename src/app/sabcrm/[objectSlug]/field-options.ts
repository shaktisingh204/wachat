/**
 * SabCRM record surfaces — value-set field-option mapping (pure).
 *
 * A SELECT / MULTI_SELECT field can reference a global value-set via
 * `settings.valueSetId`; the record create/edit form, however, renders options
 * straight from `field.options`. These pure helpers bridge the two: given a map
 * of `fieldKey → resolved options` (fetched lazily by the `useFieldOptions`
 * hook through the gated `getFieldOptionsTw` action), they produce a field whose
 * `options` are the resolved active set values — degrading to the field's own
 * inline `options` whenever a resolution is missing, empty or the field is not a
 * picklist.
 *
 * Kept React/CSS/server-only-free (mirrors `./record-surface-adapter`) so the
 * mapping can run under the plain node test runner via `npx tsx --test`.
 */

import type { FieldMetadata, FieldOption } from '@/lib/sabcrm/types';

/** A field key → its resolved (value-set or inline) option list. */
export type ResolvedOptionsMap = Record<string, FieldOption[]>;

/** Whether a field's options can come from a value-set (SELECT family only). */
export function isPicklistField(field: FieldMetadata): boolean {
  return field.type === 'SELECT' || field.type === 'MULTI_SELECT';
}

/**
 * Whether a SELECT/MULTI_SELECT field references a global value-set, i.e. it
 * carries a non-blank string `settings.valueSetId`. Non-picklist fields and
 * fields without the reference return false. (Pure mirror of the server-only
 * `fieldValueSetId` predicate — duplicated here so the client mapping stays
 * free of the `server-only` import.)
 */
export function fieldReferencesValueSet(field: FieldMetadata): boolean {
  if (!isPicklistField(field)) return false;
  const settings = field.settings;
  if (!settings || typeof settings !== 'object') return false;
  const raw = (settings as Record<string, unknown>).valueSetId;
  return typeof raw === 'string' && raw.trim().length > 0;
}

/**
 * Return a field with its `options` swapped to the resolved set, or the field
 * UNCHANGED (same reference) when there is nothing to swap. A swap happens only
 * for a SELECT/MULTI_SELECT field that has a non-empty resolved option list in
 * `resolved`; every other case (non-picklist, no entry, empty list) keeps the
 * field's own inline `options` so the form degrades gracefully.
 */
export function applyResolvedOptions(
  field: FieldMetadata,
  resolved: ResolvedOptionsMap,
): FieldMetadata {
  if (!isPicklistField(field)) return field;
  const next = resolved[field.key];
  if (!next || next.length === 0) return field;
  return { ...field, options: next };
}

/**
 * Map `applyResolvedOptions` over a field list. Returns the SAME array reference
 * when no field changed, so React memo identity holds in the no-value-set case
 * (the common path).
 */
export function applyResolvedOptionsToFields(
  fields: FieldMetadata[],
  resolved: ResolvedOptionsMap,
): FieldMetadata[] {
  let changed = false;
  const out = fields.map((f) => {
    const mapped = applyResolvedOptions(f, resolved);
    if (mapped !== f) changed = true;
    return mapped;
  });
  return changed ? out : fields;
}

/**
 * The set of field keys whose options should be lazily fetched: every
 * SELECT/MULTI_SELECT field that references a global value-set. Fields with only
 * inline options are skipped (no fetch needed — they already carry their
 * options), keeping the resolver to one request per genuinely-referencing field.
 */
export function valueSetFieldKeys(fields: FieldMetadata[]): string[] {
  return fields.filter(fieldReferencesValueSet).map((f) => f.key);
}
