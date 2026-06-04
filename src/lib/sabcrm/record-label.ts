/**
 * SabCRM — canonical record display label.
 *
 * Pure, dependency-free, safe to import from both client and server. This is the
 * ONE place that decides how a record renders as a single line of text, so every
 * list cell, board card, record header, picker option, relation chip, search
 * result and lead-name prefill agrees.
 *
 * The important rule it encodes: **people display as their FULL name**
 * (`First Last`), not the `isLabel` field alone. The `people` standard object
 * stores `firstName` + `lastName` separately with `isLabel` on `lastName`, so a
 * naïve `isLabel` lookup would render a person as their last name only — which
 * then leaked into the People list, record headers, relation chips and the name
 * of leads created from a person. Composing the full name here fixes all of them
 * at once.
 */

/** The minimal object-metadata shape this helper needs. */
export interface LabelObjectLike {
  slug: string;
  labelSingular?: string;
  fields: ReadonlyArray<{ key: string; type?: string; isLabel?: boolean }>;
}

/** The minimal record shape this helper needs. */
export interface LabelRecordLike {
  id: string;
  data?: Record<string, unknown> | null;
}

/** First non-empty trimmed string among the candidates. */
function firstStr(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/** True when this object models a person (firstName + lastName pair). */
export function isPersonLikeObject(object: LabelObjectLike): boolean {
  if (/people|person|contact/i.test(object.slug)) return true;
  const keys = new Set(object.fields.map((f) => f.key));
  return keys.has('firstName') && keys.has('lastName');
}

/** Compose a person's full name from their record data, if present. */
export function personFullName(data: Record<string, unknown> | null | undefined): string {
  const d = data ?? {};
  const full = [firstStr(d.firstName), firstStr(d.lastName)].filter(Boolean).join(' ').trim();
  return full || firstStr(d.name) || firstStr(d.email);
}

/**
 * The canonical display label for a record.
 *
 * Order of preference:
 *   1. People → `First Last` (falls back to a stored `name`/`email`).
 *   2. The object's `isLabel` field (or first TEXT/EMAIL field) value.
 *   3. `<Singular> <last-6-of-id>` as a final, never-empty fallback.
 */
export function sabcrmRecordLabel(object: LabelObjectLike, record: LabelRecordLike): string {
  const data = record.data ?? {};

  if (isPersonLikeObject(object)) {
    const full = personFullName(data);
    if (full) return full;
  }

  const field =
    object.fields.find((f) => f.isLabel) ??
    object.fields.find((f) => f.type === 'TEXT' || f.type === 'EMAIL') ??
    object.fields[0];
  if (field) {
    const raw = data[field.key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  }

  const singular = object.labelSingular ?? 'Record';
  return `${singular} ${record.id.slice(-6)}`;
}
