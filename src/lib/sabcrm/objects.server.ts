import "server-only";

/**
 * SabCRM — object / field metadata layer (server-only).
 *
 * SabCRM is metadata-driven: objects and their fields are *data*, not
 * hardcoded screens (see {@link ObjectMetadata} / {@link FieldMetadata} in
 * `./types`). This module is the single source of truth for "what objects
 * exist and what fields they have" for a given project (tenant).
 *
 * Resolution model
 * ----------------
 * The effective object catalogue for a project is the merge of:
 *   1. STANDARD_OBJECTS — built-in objects shipped in `./schema`
 *      (Companies, People, Opportunities, Notes, Tasks, Activities). These
 *      live in code, never in the database.
 *   2. Persisted documents in the `sabcrm_objects` collection (see
 *      {@link SabcrmObjectDoc} in `./db`), scoped by `projectId`. A doc with
 *      `extendsStandard: true` customizes a standard object (its `fields`
 *      array carries the standard fields PLUS any appended custom fields);
 *      a doc without it defines a fully-custom object.
 *
 * Standard / system fields always win on a key collision — a custom field
 * can never shadow a standard field, and standard fields cannot be removed.
 */

import { sabcrmObjects, type SabcrmObjectDoc } from "./db";
import { STANDARD_OBJECTS, getStandardObject } from "./schema";
import type { FieldMetadata, ObjectMetadata } from "./types";

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

function nowIso(): string {
  return new Date().toISOString();
}

/** Reserved keys custom fields may never collide with or shadow. */
const RESERVED_FIELD_KEYS = new Set([
  "_id",
  "id",
  "object",
  "userId",
  "createdAt",
  "updatedAt",
]);

function isValidFieldKey(key: string): boolean {
  // camelCase-style identifier starting with a lowercase letter, not reserved.
  return /^[a-z][a-zA-Z0-9_]*$/.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

/**
 * Re-base a persisted standard-object overlay onto the canonical schema
 * definition: standard fields always come from code (in their declared order
 * and with their authoritative metadata), then any persisted custom fields
 * (keys not present in the standard schema) are appended.
 */
function mergeStandardOverlay(
  base: ObjectMetadata,
  doc: SabcrmObjectDoc | null | undefined,
): ObjectMetadata {
  if (!doc) {
    return { ...base, fields: [...base.fields], standard: true };
  }
  const baseKeys = new Set(base.fields.map((f) => f.key));
  const customFields = doc.fields.filter((f) => !baseKeys.has(f.key));
  return {
    ...base,
    fields: [...base.fields, ...customFields],
    standard: true,
  };
}

/** Build the effective ObjectMetadata for a fully-custom object from its doc. */
function docToObject(doc: SabcrmObjectDoc): ObjectMetadata {
  return {
    slug: doc.slug,
    labelSingular: doc.labelSingular,
    labelPlural: doc.labelPlural,
    icon: doc.icon,
    description: doc.description,
    fields: [...doc.fields],
    views: doc.views,
    board: doc.board,
    standard: false,
  };
}

/** Load all object docs for a project, indexed by slug. */
async function loadDocs(
  projectId: string,
): Promise<Map<string, SabcrmObjectDoc>> {
  const col = await sabcrmObjects();
  const docs = await col.find({ projectId }).toArray();
  const map = new Map<string, SabcrmObjectDoc>();
  for (const doc of docs) map.set(doc.slug, doc);
  return map;
}

/**
 * Build the document `fields` array for a standard-object overlay: the
 * authoritative standard fields followed by the project's custom additions.
 */
function buildStandardDocFields(
  base: ObjectMetadata,
  customFields: FieldMetadata[],
): FieldMetadata[] {
  const baseKeys = new Set(base.fields.map((f) => f.key));
  const additions = customFields.filter((f) => !baseKeys.has(f.key));
  return [...base.fields, ...additions];
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * List every object visible to a project: all STANDARD_OBJECTS (with any
 * persisted custom fields merged in) plus any fully-custom objects.
 */
export async function listObjects(projectId: string): Promise<ObjectMetadata[]> {
  const docs = await loadDocs(projectId);
  const standardSlugs = new Set(STANDARD_OBJECTS.map((o) => o.slug));

  // Standard objects (with overlays merged), in their declared order.
  const standard = STANDARD_OBJECTS.map((base) =>
    mergeStandardOverlay(base, docs.get(base.slug)),
  );

  // Fully-custom objects: docs whose slug is not a standard object.
  const custom: ObjectMetadata[] = [];
  for (const [slug, doc] of docs) {
    if (standardSlugs.has(slug)) continue;
    custom.push(docToObject(doc));
  }
  custom.sort((a, b) => a.labelPlural.localeCompare(b.labelPlural));

  return [...standard, ...custom];
}

/**
 * Resolve a single object (standard or custom) for a project, with any
 * persisted custom fields merged. Returns null if no such object exists.
 */
export async function getObject(
  projectId: string,
  slug: string,
): Promise<ObjectMetadata | null> {
  const base = getStandardObject(slug);

  const col = await sabcrmObjects();
  const doc = await col.findOne({ projectId, slug });

  if (base) {
    return mergeStandardOverlay(base, doc);
  }
  if (doc) {
    return docToObject(doc);
  }
  return null;
}

/**
 * Idempotently ensure overlay rows exist for every standard object in a
 * project. Materialises a row per standard object (seeded with the canonical
 * standard fields) so custom fields have a home and the catalogue is
 * discoverable. Never overwrites existing custom fields — safe to call
 * repeatedly.
 */
export async function ensureStandardObjects(projectId: string): Promise<void> {
  const col = await sabcrmObjects();
  const ts = nowIso();

  await Promise.all(
    STANDARD_OBJECTS.map((base) =>
      col.updateOne(
        { projectId, slug: base.slug },
        {
          $setOnInsert: {
            projectId,
            slug: base.slug,
            labelSingular: base.labelSingular,
            labelPlural: base.labelPlural,
            icon: base.icon,
            description: base.description,
            views: base.views,
            board: base.board,
            standard: base.standard,
            extendsStandard: true,
            fields: [...base.fields],
            createdAt: ts,
          },
          $set: { updatedAt: ts },
        },
        { upsert: true },
      ),
    ),
  );
}

/**
 * Add a custom field to an object (standard or custom) for a project.
 *
 * Validates the field key, rejects collisions with existing fields (standard,
 * system, or previously-added custom), and persists the field onto the
 * object's document. Returns the resolved object after the change.
 */
export async function addCustomField(
  projectId: string,
  slug: string,
  field: FieldMetadata,
): Promise<ObjectMetadata> {
  if (!field || typeof field.key !== "string" || !field.key) {
    throw new Error("Custom field requires a non-empty key.");
  }
  if (!isValidFieldKey(field.key)) {
    throw new Error(
      `Invalid field key "${field.key}". Use camelCase starting with a letter; reserved keys are not allowed.`,
    );
  }

  // The object must exist (standard or already-persisted custom).
  const existing = await getObject(projectId, slug);
  if (!existing) {
    throw new Error(`Object "${slug}" not found in this project.`);
  }
  if (existing.fields.some((f) => f.key === field.key)) {
    throw new Error(`Field "${field.key}" already exists on "${slug}".`);
  }

  // A custom field is never a system field.
  const customField: FieldMetadata = { ...field, system: false };

  const col = await sabcrmObjects();
  const ts = nowIso();
  const base = getStandardObject(slug);
  const isStandard = !!base;

  // On first write we must materialise the full document. For a standard
  // object that means seeding the canonical standard fields; the new custom
  // field is appended via $push, so $setOnInsert seeds only the base fields.
  const seedFields: FieldMetadata[] = isStandard ? [...base!.fields] : [];

  await col.updateOne(
    { projectId, slug },
    {
      $setOnInsert: {
        projectId,
        slug,
        labelSingular: existing.labelSingular,
        labelPlural: existing.labelPlural,
        icon: existing.icon,
        description: existing.description,
        views: existing.views,
        board: existing.board,
        standard: isStandard,
        extendsStandard: isStandard,
        fields: seedFields,
        createdAt: ts,
      },
      $set: { updatedAt: ts },
      $push: { fields: customField },
    },
    { upsert: true },
  );

  const updated = await getObject(projectId, slug);
  if (!updated) {
    throw new Error(`Failed to resolve "${slug}" after adding field.`);
  }
  return updated;
}

/**
 * Remove a custom field from an object for a project.
 *
 * Standard / system fields cannot be removed — only user-added custom fields.
 * Returns the resolved object after the change.
 */
export async function removeCustomField(
  projectId: string,
  slug: string,
  fieldKey: string,
): Promise<ObjectMetadata> {
  if (!fieldKey) {
    throw new Error("A field key is required.");
  }

  // Guard against removing standard fields of a built-in object.
  const base = getStandardObject(slug);
  if (base && base.fields.some((f) => f.key === fieldKey)) {
    throw new Error(
      `Field "${fieldKey}" is a standard field and cannot be removed.`,
    );
  }

  const col = await sabcrmObjects();
  const ts = nowIso();
  const doc = await col.findOne({ projectId, slug });

  if (!doc) {
    throw new Error(`Object "${slug}" has no custom fields in this project.`);
  }

  const target = doc.fields.find((f) => f.key === fieldKey);
  if (!target) {
    throw new Error(`Custom field "${fieldKey}" not found on "${slug}".`);
  }
  // System fields (and, for custom objects, the original built-in fields)
  // cannot be removed once persisted.
  if (target.system) {
    throw new Error(
      `Field "${fieldKey}" is a system field and cannot be removed.`,
    );
  }

  await col.updateOne(
    { projectId, slug },
    {
      $set: { updatedAt: ts },
      $pull: { fields: { key: fieldKey } },
    },
  );

  const updated = await getObject(projectId, slug);
  if (!updated) {
    throw new Error(`Failed to resolve "${slug}" after removing field.`);
  }
  return updated;
}
