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

import { sabcrmObjects, sabcrmRecords, type SabcrmObjectDoc } from "./db";
import {
  STANDARD_OBJECTS,
  STANDARD_OBJECT_SLUGS,
  getStandardObject,
} from "./schema";
import type {
  FieldMetadata,
  FieldRelation,
  ObjectMetadata,
} from "./types";

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
 * Slug validity for custom objects: plural kebab-case (lowercase letters,
 * digits, single hyphens), starting with a letter. Mirrors the URL + collection
 * convention documented on {@link ObjectMetadata}. Standard slugs are reserved
 * and handled separately at the call sites.
 */
function isValidObjectSlug(slug: string): boolean {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug);
}

/** Field types that carry a finite option list. */
const OPTION_FIELD_TYPES: ReadonlySet<FieldMetadata["type"]> = new Set([
  "SELECT",
  "MULTI_SELECT",
]);

/**
 * Validate a single field definition for structural soundness, independent of
 * collisions (collisions are checked against the live object at the call site).
 * Throws with a user-facing message on the first problem.
 */
function assertValidField(field: FieldMetadata): void {
  if (!field || typeof field.key !== "string" || !field.key) {
    throw new Error("A field requires a non-empty key.");
  }
  if (!isValidFieldKey(field.key)) {
    throw new Error(
      `Invalid field key "${field.key}". Use camelCase starting with a letter; reserved keys are not allowed.`,
    );
  }
  if (typeof field.label !== "string" || !field.label.trim()) {
    throw new Error(`Field "${field.key}" requires a label.`);
  }
  if (typeof field.type !== "string") {
    throw new Error(`Field "${field.key}" requires a type.`);
  }
  if (OPTION_FIELD_TYPES.has(field.type)) {
    if (!Array.isArray(field.options) || field.options.length === 0) {
      throw new Error(
        `Field "${field.key}" of type ${field.type} requires at least one option.`,
      );
    }
  }
  if (field.type === "RELATION" && !field.relation?.targetObject) {
    throw new Error(
      `RELATION field "${field.key}" requires relation.targetObject.`,
    );
  }
}

/** Count persisted records for one object in a project. */
async function countRecords(projectId: string, slug: string): Promise<number> {
  const col = await sabcrmRecords();
  return col.countDocuments({ projectId, object: slug });
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

/* -------------------------------------------------------------------------- */
/*  Runtime metadata engine — object CRUD                                     */
/* -------------------------------------------------------------------------- */

/** Input accepted when creating a fully-custom object. */
export interface CreateCustomObjectInput {
  slug: string;
  labelSingular: string;
  labelPlural: string;
  icon: string;
  description?: string;
  /**
   * Optional starter fields. A label field is guaranteed: if none of the
   * supplied fields is flagged `isLabel`, a default `name` TEXT label field is
   * prepended. All supplied fields are validated and forced `system: false`.
   */
  fields?: FieldMetadata[];
  views?: Array<"table" | "board">;
  board?: ObjectMetadata["board"];
}

/**
 * Create a fully-custom object for a project.
 *
 * The slug is validated for format and uniqueness (it must not collide with a
 * standard object or an existing custom object in the project; the unique
 * `{projectId, slug}` index is the final backstop). Every object is guaranteed
 * exactly one `isLabel` field so the generic record runtime always has a title
 * to render. Returns the resolved {@link ObjectMetadata}.
 */
export async function createCustomObject(
  projectId: string,
  input: CreateCustomObjectInput,
): Promise<ObjectMetadata> {
  const slug = (input.slug ?? "").trim();
  if (!slug) throw new Error("An object slug is required.");
  if (!isValidObjectSlug(slug)) {
    throw new Error(
      `Invalid slug "${slug}". Use lowercase kebab-case starting with a letter, e.g. "support-tickets".`,
    );
  }
  if (STANDARD_OBJECT_SLUGS.has(slug)) {
    throw new Error(`"${slug}" is a reserved standard object slug.`);
  }
  if (!input.labelSingular?.trim() || !input.labelPlural?.trim()) {
    throw new Error("Both singular and plural labels are required.");
  }
  if (!input.icon?.trim()) {
    throw new Error("An icon is required.");
  }

  // Uniqueness within the project (standard overlays share this collection).
  const existing = await getObject(projectId, slug);
  if (existing) {
    throw new Error(`An object with slug "${slug}" already exists.`);
  }

  // Validate + normalise supplied fields, enforcing one-and-only-one label.
  const supplied = (input.fields ?? []).map((f) => ({ ...f, system: false }));
  const seenKeys = new Set<string>();
  for (const field of supplied) {
    assertValidField(field);
    if (seenKeys.has(field.key)) {
      throw new Error(`Duplicate field key "${field.key}".`);
    }
    seenKeys.add(field.key);
  }

  let fields: FieldMetadata[] = supplied;
  const labelFields = fields.filter((f) => f.isLabel);
  if (labelFields.length === 0) {
    // Guarantee a label: prepend a default `name` TEXT field.
    if (seenKeys.has("name")) {
      throw new Error(
        'No isLabel field supplied and the fallback key "name" is taken. Mark one field as isLabel.',
      );
    }
    const nameField: FieldMetadata = {
      key: "name",
      label: "Name",
      type: "TEXT",
      icon: "type",
      required: true,
      inTable: true,
      isLabel: true,
      system: false,
    };
    fields = [nameField, ...fields];
  } else if (labelFields.length > 1) {
    throw new Error("An object can have at most one isLabel field.");
  }

  const col = await sabcrmObjects();
  const ts = nowIso();
  const doc: Omit<SabcrmObjectDoc, "_id"> = {
    projectId,
    slug,
    labelSingular: input.labelSingular.trim(),
    labelPlural: input.labelPlural.trim(),
    icon: input.icon.trim(),
    description: input.description?.trim() || undefined,
    fields,
    views: input.views?.length ? input.views : ["table"],
    board: input.board,
    standard: false,
    extendsStandard: false,
    createdAt: ts,
    updatedAt: ts,
  };

  try {
    await col.insertOne(doc as SabcrmObjectDoc);
  } catch (e) {
    // Unique-index race: surface a friendly conflict.
    if (e instanceof Error && /duplicate key/i.test(e.message)) {
      throw new Error(`An object with slug "${slug}" already exists.`);
    }
    throw e;
  }

  const created = await getObject(projectId, slug);
  if (!created) {
    throw new Error(`Failed to resolve "${slug}" after creation.`);
  }
  return created;
}

/** Mutable identity/presentation attributes of an object. */
export interface UpdateObjectPatch {
  labelSingular?: string;
  labelPlural?: string;
  icon?: string;
  description?: string | null;
  views?: Array<"table" | "board">;
  board?: ObjectMetadata["board"] | null;
}

/**
 * Update the presentation metadata of an object (labels, icon, description,
 * views, board config).
 *
 * Standard objects are immutable except for adding custom fields — their
 * identity (slug, labels, icon, views, board) is owned by code and cannot be
 * patched here. Only custom objects accept this patch. Returns the resolved
 * object.
 */
export async function updateObject(
  projectId: string,
  slug: string,
  patch: UpdateObjectPatch,
): Promise<ObjectMetadata> {
  if (getStandardObject(slug)) {
    throw new Error(
      `"${slug}" is a standard object and its definition cannot be edited (only custom fields may be added).`,
    );
  }

  const col = await sabcrmObjects();
  const doc = await col.findOne({ projectId, slug });
  if (!doc) {
    throw new Error(`Custom object "${slug}" not found in this project.`);
  }

  const set: Partial<SabcrmObjectDoc> = { updatedAt: nowIso() };
  const unset: Record<string, ""> = {};

  if (patch.labelSingular !== undefined) {
    if (!patch.labelSingular.trim()) {
      throw new Error("Singular label cannot be empty.");
    }
    set.labelSingular = patch.labelSingular.trim();
  }
  if (patch.labelPlural !== undefined) {
    if (!patch.labelPlural.trim()) {
      throw new Error("Plural label cannot be empty.");
    }
    set.labelPlural = patch.labelPlural.trim();
  }
  if (patch.icon !== undefined) {
    if (!patch.icon.trim()) throw new Error("Icon cannot be empty.");
    set.icon = patch.icon.trim();
  }
  if (patch.description !== undefined) {
    const trimmed = patch.description?.trim();
    if (trimmed) set.description = trimmed;
    else unset.description = "";
  }
  if (patch.views !== undefined) {
    if (!patch.views.length) throw new Error("At least one view is required.");
    set.views = patch.views;
  }
  if (patch.board !== undefined) {
    if (patch.board) set.board = patch.board;
    else unset.board = "";
  }

  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(unset).length) update.$unset = unset;

  await col.updateOne({ projectId, slug }, update);

  const updated = await getObject(projectId, slug);
  if (!updated) {
    throw new Error(`Failed to resolve "${slug}" after update.`);
  }
  return updated;
}

/** Report on inbound relations pointing at an object. */
export interface InboundRelationRef {
  /** Slug of the object that owns the relation field. */
  fromObject: string;
  /** Field key on that object whose relation targets the deleted object. */
  fieldKey: string;
}

/** Result of a custom-object deletion. */
export interface DeleteCustomObjectResult {
  slug: string;
  /** Number of records that were deleted along with the object. */
  deletedRecords: number;
  /** Inbound RELATION fields that were detached from other objects. */
  detachedRelations: InboundRelationRef[];
}

/**
 * Find every RELATION field across the project that targets `slug`.
 * Used both as a delete guard and to cascade-detach inbound references.
 */
async function findInboundRelations(
  projectId: string,
  slug: string,
): Promise<InboundRelationRef[]> {
  const refs: InboundRelationRef[] = [];
  for (const object of await listObjects(projectId)) {
    if (object.slug === slug) continue;
    for (const field of object.fields) {
      if (
        field.type === "RELATION" &&
        field.relation?.targetObject === slug
      ) {
        refs.push({ fromObject: object.slug, fieldKey: field.key });
      }
    }
  }
  return refs;
}

/**
 * Delete a fully-custom object.
 *
 * Standard objects can never be deleted. By default the deletion is refused if
 * any records exist for the object; pass `{ force: true }` to cascade-delete
 * those records too. Inbound custom RELATION fields (on other custom objects)
 * are detached automatically; inbound relations declared on *standard* objects
 * live in code and cannot be detached here, so the deletion is refused unless
 * forced. Returns a summary of what was removed/detached.
 */
export async function deleteCustomObject(
  projectId: string,
  slug: string,
  opts: { force?: boolean } = {},
): Promise<DeleteCustomObjectResult> {
  if (getStandardObject(slug)) {
    throw new Error(`"${slug}" is a standard object and cannot be deleted.`);
  }

  const col = await sabcrmObjects();
  const doc = await col.findOne({ projectId, slug });
  if (!doc) {
    throw new Error(`Custom object "${slug}" not found in this project.`);
  }

  const force = opts.force === true;

  const recordCount = await countRecords(projectId, slug);
  if (recordCount > 0 && !force) {
    throw new Error(
      `"${slug}" has ${recordCount} record(s). Pass force to delete the object and its records.`,
    );
  }

  const inbound = await findInboundRelations(projectId, slug);
  const standardInbound = inbound.filter((r) => !!getStandardObject(r.fromObject));
  if (standardInbound.length > 0 && !force) {
    const list = standardInbound.map((r) => `${r.fromObject}.${r.fieldKey}`);
    throw new Error(
      `"${slug}" is referenced by standard object relation(s): ${list.join(
        ", ",
      )}. These cannot be auto-detached; pass force to delete anyway.`,
    );
  }

  // Detach inbound RELATION fields on custom-object overlays/docs.
  const recordsCol = await sabcrmRecords();
  const ts = nowIso();
  for (const ref of inbound) {
    await col.updateOne(
      { projectId, slug: ref.fromObject },
      {
        $set: { updatedAt: ts },
        $pull: { fields: { key: ref.fieldKey } },
      },
    );
    // Scrub the now-orphaned relation value from records of the referrer.
    await recordsCol.updateMany(
      { projectId, object: ref.fromObject },
      { $unset: { [`data.${ref.fieldKey}`]: "" } },
    );
  }

  let deletedRecords = 0;
  if (recordCount > 0) {
    const res = await recordsCol.deleteMany({ projectId, object: slug });
    deletedRecords = res.deletedCount ?? 0;
  }

  await col.deleteOne({ projectId, slug });

  return { slug, deletedRecords, detachedRelations: inbound };
}

/* -------------------------------------------------------------------------- */
/*  Runtime metadata engine — field CRUD + reorder                            */
/* -------------------------------------------------------------------------- */

/**
 * Add a field to an object. Thin, validated alias over {@link addCustomField}
 * exposed under the engine's field-CRUD vocabulary. Runs full structural
 * validation (label, type, options, relation target presence) before delegating.
 */
export async function addField(
  projectId: string,
  slug: string,
  field: FieldMetadata,
): Promise<ObjectMetadata> {
  assertValidField(field);
  // isLabel uniqueness: a new field may not introduce a second label.
  if (field.isLabel) {
    const object = await getObject(projectId, slug);
    if (object?.fields.some((f) => f.isLabel)) {
      throw new Error(
        `"${slug}" already has a label field; only one isLabel field is allowed.`,
      );
    }
  }
  return addCustomField(projectId, slug, field);
}

/** Mutable attributes of a field. The `key` and `type` are immutable. */
export interface UpdateFieldPatch {
  label?: string;
  icon?: string | null;
  description?: string | null;
  required?: boolean;
  inTable?: boolean;
  isLabel?: boolean;
  options?: FieldMetadata["options"];
  defaultValue?: unknown;
  relation?: FieldRelation;
}

/**
 * Update a custom field's editable attributes in place.
 *
 * Standard and system fields are immutable. The field `key` and `type` cannot
 * be changed (a type change would require a record-data migration that this
 * engine deliberately does not perform implicitly — drop and re-add instead).
 * `isLabel` is kept unique across the object. Returns the resolved object.
 */
export async function updateField(
  projectId: string,
  slug: string,
  fieldKey: string,
  patch: UpdateFieldPatch,
): Promise<ObjectMetadata> {
  if (!fieldKey) throw new Error("A field key is required.");

  const base = getStandardObject(slug);
  if (base?.fields.some((f) => f.key === fieldKey)) {
    throw new Error(
      `Field "${fieldKey}" is a standard field and cannot be edited.`,
    );
  }

  const col = await sabcrmObjects();
  const doc = await col.findOne({ projectId, slug });
  if (!doc) {
    throw new Error(`Object "${slug}" has no editable fields in this project.`);
  }
  const target = doc.fields.find((f) => f.key === fieldKey);
  if (!target) {
    throw new Error(`Custom field "${fieldKey}" not found on "${slug}".`);
  }
  if (target.system) {
    throw new Error(`Field "${fieldKey}" is a system field and cannot be edited.`);
  }

  // Merge the patch over the existing field, preserving immutable attributes.
  const merged: FieldMetadata = { ...target };
  if (patch.label !== undefined) {
    if (!patch.label.trim()) throw new Error("Field label cannot be empty.");
    merged.label = patch.label.trim();
  }
  if (patch.icon !== undefined) merged.icon = patch.icon?.trim() || undefined;
  if (patch.description !== undefined) {
    merged.description = patch.description?.trim() || undefined;
  }
  if (patch.required !== undefined) merged.required = patch.required;
  if (patch.inTable !== undefined) merged.inTable = patch.inTable;
  if (patch.options !== undefined) merged.options = patch.options;
  if (patch.defaultValue !== undefined) merged.defaultValue = patch.defaultValue;
  if (patch.relation !== undefined) merged.relation = patch.relation;
  if (patch.isLabel !== undefined) merged.isLabel = patch.isLabel;

  // Re-validate the merged shape (key/type are unchanged from `target`).
  assertValidField(merged);

  // Enforce single-label invariant when promoting to a label.
  if (patch.isLabel === true) {
    const existingLabel = doc.fields.find(
      (f) => f.isLabel && f.key !== fieldKey,
    );
    if (!existingLabel && base) {
      // Standard objects own their label in code; check the merged view too.
      const object = await getObject(projectId, slug);
      if (object?.fields.some((f) => f.isLabel && f.key !== fieldKey)) {
        throw new Error(`"${slug}" already has a label field.`);
      }
    } else if (existingLabel) {
      throw new Error(`"${slug}" already has a label field.`);
    }
  }

  const nextFields = doc.fields.map((f) => (f.key === fieldKey ? merged : f));

  await col.updateOne(
    { projectId, slug },
    { $set: { fields: nextFields, updatedAt: nowIso() } },
  );

  const updated = await getObject(projectId, slug);
  if (!updated) {
    throw new Error(`Failed to resolve "${slug}" after updating field.`);
  }
  return updated;
}

/**
 * Remove a field from an object. Alias over {@link removeCustomField} exposed
 * under the engine's field-CRUD vocabulary.
 */
export async function removeField(
  projectId: string,
  slug: string,
  fieldKey: string,
): Promise<ObjectMetadata> {
  return removeCustomField(projectId, slug, fieldKey);
}

/**
 * Reorder the *custom* fields of an object.
 *
 * Standard fields always render first in their canonical code-declared order
 * (re-based by {@link mergeStandardOverlay} / {@link buildStandardDocFields}),
 * so only custom-field order is persistable. `orderedCustomKeys` must be a
 * permutation of exactly the object's custom field keys. The persisted doc
 * stores standard fields (if any) first, then custom fields in the requested
 * order. Returns the resolved object.
 */
export async function reorderFields(
  projectId: string,
  slug: string,
  orderedCustomKeys: string[],
): Promise<ObjectMetadata> {
  if (!Array.isArray(orderedCustomKeys)) {
    throw new Error("orderedCustomKeys must be an array of field keys.");
  }

  const col = await sabcrmObjects();
  const doc = await col.findOne({ projectId, slug });
  if (!doc) {
    throw new Error(`Object "${slug}" has no custom fields in this project.`);
  }

  const base = getStandardObject(slug);
  const standardKeys = new Set(base ? base.fields.map((f) => f.key) : []);

  const customFields = doc.fields.filter((f) => !standardKeys.has(f.key));
  const customByKey = new Map(customFields.map((f) => [f.key, f]));

  // The requested order must be an exact permutation of the custom keys.
  if (orderedCustomKeys.length !== customFields.length) {
    throw new Error(
      `Expected ${customFields.length} custom field key(s), got ${orderedCustomKeys.length}.`,
    );
  }
  const seen = new Set<string>();
  const reordered: FieldMetadata[] = [];
  for (const key of orderedCustomKeys) {
    const field = customByKey.get(key);
    if (!field) {
      throw new Error(`"${key}" is not a custom field of "${slug}".`);
    }
    if (seen.has(key)) throw new Error(`Duplicate key "${key}" in ordering.`);
    seen.add(key);
    reordered.push(field);
  }

  // Standard fields (in canonical code order) first, then reordered custom.
  const nextFields: FieldMetadata[] = base
    ? buildStandardDocFields(base, reordered)
    : reordered;

  await col.updateOne(
    { projectId, slug },
    { $set: { fields: nextFields, updatedAt: nowIso() } },
  );

  const updated = await getObject(projectId, slug);
  if (!updated) {
    throw new Error(`Failed to resolve "${slug}" after reordering fields.`);
  }
  return updated;
}

/* -------------------------------------------------------------------------- */
/*  Runtime metadata engine — relations                                       */
/* -------------------------------------------------------------------------- */

/** Result of defining a relation, including the reciprocal back-reference. */
export interface CreateRelationResult {
  /** The object that now owns the forward relation field. */
  from: ObjectMetadata;
  /** The target object that received the reciprocal field (if created). */
  to: ObjectMetadata;
  /** Field key of the reciprocal field created on the target object. */
  inverseFieldKey: string | null;
}

/**
 * Define a RELATION field on `fromSlug` and create its reciprocal
 * back-reference on the target object.
 *
 * - The forward field (`fieldKey`) is added to `fromSlug` with the supplied
 *   {@link FieldRelation}. Its `targetObject` must resolve to a real object in
 *   the project.
 * - A reciprocal field of the opposite cardinality is added to the target
 *   object, pointing back at `fromSlug`, so both sides are first-class fields
 *   (the read-time inverse scan in `relations.server.ts` still works, but an
 *   explicit reciprocal makes the relation editable/visible from either side).
 *
 * Adding RELATION fields to standard objects is allowed (the same way
 * {@link addCustomField} permits it). Pass `inverse: false` to skip creating
 * the reciprocal field. Returns both resolved objects.
 */
export async function createRelation(
  projectId: string,
  fromSlug: string,
  fieldKey: string,
  relation: FieldRelation,
  opts: {
    inverse?: boolean;
    inverseFieldKey?: string;
    inverseLabel?: string;
    forwardLabel?: string;
    forwardLabelField?: string;
  } = {},
): Promise<CreateRelationResult> {
  if (!relation?.targetObject) {
    throw new Error("relation.targetObject is required.");
  }
  if (relation.kind !== "MANY_TO_ONE" && relation.kind !== "ONE_TO_MANY") {
    throw new Error("relation.kind must be MANY_TO_ONE or ONE_TO_MANY.");
  }
  if (!isValidFieldKey(fieldKey)) {
    throw new Error(`Invalid relation field key "${fieldKey}".`);
  }

  const fromObject = await getObject(projectId, fromSlug);
  if (!fromObject) {
    throw new Error(`Object "${fromSlug}" not found in this project.`);
  }
  const targetObject = await getObject(projectId, relation.targetObject);
  if (!targetObject) {
    throw new Error(
      `Relation target "${relation.targetObject}" not found in this project.`,
    );
  }

  // Build the forward field. Pick a sensible label-field default on the target.
  const targetLabelKey =
    relation.labelField ??
    targetObject.fields.find((f) => f.isLabel)?.key ??
    targetObject.fields[0]?.key;

  const forwardField: FieldMetadata = {
    key: fieldKey,
    label: opts.forwardLabel ?? targetObject.labelSingular,
    type: "RELATION",
    icon: "link",
    relation: { ...relation, labelField: targetLabelKey },
    system: false,
  };

  // Add the forward field (validates collisions + key against the live object).
  const from = await addCustomField(projectId, fromSlug, forwardField);

  const makeInverse = opts.inverse !== false;
  let inverseFieldKey: string | null = null;
  let to = targetObject;

  if (makeInverse && relation.targetObject !== fromSlug) {
    const inverseKind: FieldRelation["kind"] =
      relation.kind === "MANY_TO_ONE" ? "ONE_TO_MANY" : "MANY_TO_ONE";

    const candidate =
      opts.inverseFieldKey ??
      (inverseKind === "ONE_TO_MANY"
        ? `${fromSlug.replace(/-/g, "_")}Records`
        : fromObject.labelSingular.replace(/[^a-zA-Z0-9]/g, "") || "related");
    // Normalise to a valid camelCase key, falling back deterministically.
    let inverseKey = candidate.charAt(0).toLowerCase() + candidate.slice(1);
    if (!isValidFieldKey(inverseKey)) {
      inverseKey = `relatedFrom_${fromSlug.replace(/-/g, "_")}`;
    }

    // Skip if the target already carries a matching inverse field.
    const alreadyHasInverse = targetObject.fields.some(
      (f) =>
        f.type === "RELATION" &&
        f.relation?.kind === inverseKind &&
        f.relation.targetObject === fromSlug,
    );

    if (!alreadyHasInverse && !targetObject.fields.some((f) => f.key === inverseKey)) {
      const fromLabelKey =
        opts.forwardLabelField ??
        fromObject.fields.find((f) => f.isLabel)?.key ??
        fromObject.fields[0]?.key;

      const inverseField: FieldMetadata = {
        key: inverseKey,
        label:
          opts.inverseLabel ??
          (inverseKind === "ONE_TO_MANY"
            ? fromObject.labelPlural
            : fromObject.labelSingular),
        type: "RELATION",
        icon: "link",
        relation: {
          targetObject: fromSlug,
          kind: inverseKind,
          labelField: fromLabelKey,
        },
        system: false,
      };
      to = await addCustomField(projectId, relation.targetObject, inverseField);
      inverseFieldKey = inverseKey;
    }
  }

  return { from, to, inverseFieldKey };
}
