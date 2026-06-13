import 'server-only';

/**
 * SabCRM — field dependencies (dependent picklists) runtime (server-only).
 *
 * Persists dependency rules in `sabcrm_field_dependencies` (projectId+object
 * scoped — the native config pattern of `./data-quality.server.ts` /
 * `./formula.server.ts`) and exposes:
 *
 *  - {@link validateDependencies} for the write path — given a record's (merged)
 *    `data`, every enabled rule whose controlling+dependent fields are BOTH set
 *    must hold a valid combo, else a violation is reported (the create/update
 *    action blocks the save). The pure predicate is `./field-deps.ts`.
 *  - {@link allowedOptionsFor} for the UI — the dependent values allowed for a
 *    given controlling value, so the record form can filter the dependent SELECT
 *    live. When no rule restricts the branch it returns the field's FULL option
 *    set (read via the Rust object path — the two-store-safe metadata source).
 *
 * No record scalars are written here, so the AI-fields envelope does not apply;
 * the config collection MAY bump its own `updatedAt` (records-only rule).
 * Best-effort throughout — a config-read failure never blocks a legitimate save.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import {
  allowedOptions,
  allowedOptionsOrNull,
  isComboValid,
  type DependencyRule,
} from './field-deps';

export {
  allowedOptions,
  allowedOptionsOrNull,
  isComboValid,
  type DependencyRule,
} from './field-deps';

const DEPS_COLL = 'sabcrm_field_dependencies';

/** A persisted field-dependency configuration document. */
export interface FieldDependency {
  id: string;
  projectId: string;
  objectSlug: string;
  /** Field key whose value drives the allowed options. */
  controllingField: string;
  /** Field key whose options are constrained. */
  dependentField: string;
  /** controlling value → allowed dependent values. */
  map: Record<string, string[]>;
  name?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Save-action input (server stamps id / timestamps / project). */
export interface FieldDependencyInput {
  id?: string;
  objectSlug: string;
  controllingField: string;
  dependentField: string;
  map: Record<string, string[]>;
  name?: string;
  enabled: boolean;
}

/** One blocked / advisory combo from {@link validateDependencies}. */
export interface DependencyViolation {
  dependencyId: string;
  controllingField: string;
  dependentField: string;
  message: string;
}

/** Outcome of validating a record's data against an object's dependencies. */
export interface DependencyValidationResult {
  ok: boolean;
  violations: DependencyViolation[];
}

interface FieldDependencyDoc {
  _id: ObjectId | string;
  projectId: string;
  objectSlug: string;
  controllingField: string;
  dependentField: string;
  map?: Record<string, string[]>;
  name?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** Coerce a persisted `map` to the strict `Record<string, string[]>` shape. */
function sanitizeMap(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    const vals = v
      .map((x) => (x === null || x === undefined ? '' : String(x)))
      .filter((x) => x.length > 0);
    out[String(k)] = [...new Set(vals)];
  }
  return out;
}

function toDependency(doc: FieldDependencyDoc): FieldDependency {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    controllingField: doc.controllingField,
    dependentField: doc.dependentField,
    map: sanitizeMap(doc.map),
    name: doc.name,
    enabled: doc.enabled !== false,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                        */
/* -------------------------------------------------------------------------- */

export async function listFieldDependencies(
  projectId: string,
): Promise<FieldDependency[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(DEPS_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(300)
    .toArray()) as unknown as FieldDependencyDoc[];
  return docs.map(toDependency);
}

export async function getFieldDependency(
  projectId: string,
  id: string,
): Promise<FieldDependency | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(DEPS_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as FieldDependencyDoc | null;
  return doc ? toDependency(doc) : null;
}

/** Enabled dependency rules for one object (the write-path + UI source). */
export async function getDependenciesForObject(
  projectId: string,
  objectSlug: string,
): Promise<FieldDependency[]> {
  if (!projectId || !objectSlug) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(DEPS_COLL)
    .find({ projectId, objectSlug, enabled: { $ne: false } })
    .limit(100)
    .toArray()) as unknown as FieldDependencyDoc[];
  return docs.map(toDependency);
}

export async function upsertFieldDependency(
  projectId: string,
  input: FieldDependencyInput,
): Promise<FieldDependency> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    objectSlug: input.objectSlug,
    controllingField: input.controllingField,
    dependentField: input.dependentField,
    map: sanitizeMap(input.map),
    name:
      input.name?.trim() ||
      `${input.controllingField} → ${input.dependentField}`,
    enabled: input.enabled !== false,
    updatedAt: now,
  };
  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(DEPS_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getFieldDependency(projectId, input.id);
    if (saved) return saved;
  }
  const res = await db
    .collection(DEPS_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toDependency({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

export async function deleteFieldDependency(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(DEPS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Write-time validation                                                       */
/* -------------------------------------------------------------------------- */

/** Project a {@link FieldDependency} onto the pure {@link DependencyRule}. */
function toRule(dep: FieldDependency): DependencyRule {
  return {
    object: dep.objectSlug,
    controllingField: dep.controllingField,
    dependentField: dep.dependentField,
    map: dep.map,
  };
}

/**
 * Validate a record's (merged) data against every enabled dependency rule for
 * its object. A violation is reported when the dependent value is NOT in the
 * allow-list implied by the controlling value. Returns
 * `{ ok: true, violations: [] }` when no rule restricts the data (or none
 * exists). Best-effort: a config-read failure degrades to "ok".
 */
export async function validateDependencies(
  projectId: string,
  objectSlug: string,
  data: Record<string, unknown>,
): Promise<DependencyValidationResult> {
  try {
    const deps = await getDependenciesForObject(projectId, objectSlug);
    if (deps.length === 0) return { ok: true, violations: [] };
    const violations: DependencyViolation[] = [];
    for (const dep of deps) {
      const controllingValue = data?.[dep.controllingField];
      const dependentValue = data?.[dep.dependentField];
      if (!isComboValid(controllingValue, dependentValue, dep.map)) {
        const allowed = allowedOptions(controllingValue, dep.map);
        violations.push({
          dependencyId: dep.id,
          controllingField: dep.controllingField,
          dependentField: dep.dependentField,
          message:
            `“${String(dependentValue)}” is not a valid ${dep.dependentField} ` +
            `when ${dep.controllingField} is “${String(controllingValue)}”` +
            (allowed.length > 0 ? ` (allowed: ${allowed.join(', ')}).` : '.'),
        });
      }
    }
    return { ok: violations.length === 0, violations };
  } catch {
    return { ok: true, violations: [] };
  }
}

/* -------------------------------------------------------------------------- */
/* UI option filtering                                                         */
/* -------------------------------------------------------------------------- */

/** The full option-value set of a SELECT/MULTI_SELECT field (Rust metadata). */
async function fieldOptionValues(
  projectId: string,
  objectSlug: string,
  fieldKey: string,
): Promise<string[]> {
  try {
    const meta = await sabcrmObjectsApi.get(objectSlug, projectId);
    const field = meta.fields.find((f) => f.key === fieldKey);
    const opts = field?.options;
    if (!Array.isArray(opts)) return [];
    return opts
      .map((o) => (o?.value === null || o?.value === undefined ? '' : String(o.value)))
      .filter((v) => v.length > 0);
  } catch {
    return [];
  }
}

/**
 * The dependent values the record form should offer when the controlling field
 * holds `value`. When a dependency rule restricts the branch, returns exactly
 * the allow-list (intersected with the field's real options so a stale map entry
 * can't surface a removed option); otherwise returns the field's FULL option set
 * (no restriction). The dependent field is identified by the matching rule.
 *
 * Object/field METADATA is read via the Rust path (two-store rule).
 */
export async function allowedOptionsFor(
  projectId: string,
  objectSlug: string,
  controllingField: string,
  value: unknown,
): Promise<{ dependentField: string; options: string[] }[]> {
  if (!projectId || !objectSlug || !controllingField) return [];
  const deps = (await getDependenciesForObject(projectId, objectSlug)).filter(
    (d) => d.controllingField === controllingField,
  );
  if (deps.length === 0) return [];

  const out: { dependentField: string; options: string[] }[] = [];
  for (const dep of deps) {
    const all = await fieldOptionValues(projectId, objectSlug, dep.dependentField);
    const restricted = allowedOptionsOrNull(value, dep.map);
    if (restricted === null) {
      out.push({ dependentField: dep.dependentField, options: all });
    } else if (all.length === 0) {
      // No field metadata to intersect with — trust the authored allow-list.
      out.push({ dependentField: dep.dependentField, options: restricted });
    } else {
      const allowed = new Set(restricted);
      out.push({
        dependentField: dep.dependentField,
        options: all.filter((o) => allowed.has(o)),
      });
    }
  }
  return out;
}

/** Convenience: the allowed values for ONE dependent field of a controller. */
export async function allowedOptionsForField(
  projectId: string,
  objectSlug: string,
  controllingField: string,
  dependentField: string,
  value: unknown,
): Promise<string[]> {
  const all = await allowedOptionsFor(projectId, objectSlug, controllingField, value);
  return all.find((r) => r.dependentField === dependentField)?.options ?? [];
}

/** Used by a scheduler/backstop to discover projects with dependencies. */
export async function listProjectsWithDependencies(
  db: import('mongodb').Db,
): Promise<string[]> {
  try {
    const ids = (await db
      .collection(DEPS_COLL)
      .distinct('projectId', { enabled: { $ne: false } })) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}
