import 'server-only';

/**
 * SabCRM — data-quality runtime (server-only).
 *
 * Three concerns, all best-effort and tenant-scoped:
 *
 *  1. **Validation rules** — persisted in `sabcrm_validation_rules` (the native
 *     config pattern of `./scoring.server.ts` / `./sequences.server.ts`).
 *     `validateRecordWrite` runs the enabled sets for an object against a
 *     record's (merged) data so the create/update actions can block an invalid
 *     save. The pure evaluator is `./validation.ts`.
 *
 *  2. **Merge relation re-parenting** — the Rust `merge_records` re-points
 *     activities + deletes the loser but leaves INBOUND relation fields
 *     dangling. `reparentInboundRelations` scans every RELATION field that
 *     targets the merged object and re-points `secondaryId → primaryId`
 *     (scalar MANY_TO_ONE via `$set`; array ONE_TO_MANY via `$pull` + `$addToSet`).
 *     Both stores share the `sabcrm_records` collection, so this direct write is
 *     visible to the Rust read path (same basis the AI-fields / scoring scalar
 *     writes rely on); it deliberately does not bump `updatedAt`.
 *
 *  3. **Fuzzy duplicates** — `findFuzzyDuplicates` reads up to `MAX_DEDUP_SCAN`
 *     records and clusters them by a chosen field with the pure `leven` +
 *     Jaro-Winkler matcher in `./dedup-match.ts` (O(n²); on-demand only).
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import {
  evaluateValidation,
  mergeValidationResults,
  type ValidationRuleSet,
  type ValidationRuleSetInput,
  type ValidationResult,
} from './validation';
import {
  clusterByField,
  type DedupRecord,
  type DedupCluster,
} from './dedup-match';

export {
  evaluateValidation,
  mergeValidationResults,
  type ValidationRule,
  type ValidationRuleSet,
  type ValidationRuleSetInput,
  type ValidationResult,
  type ValidationSeverity,
} from './validation';

const RULES_COLL = 'sabcrm_validation_rules';
const RECORDS_COLL = 'sabcrm_records';

/** Cap on records pulled into the O(n²) fuzzy scan. */
const MAX_DEDUP_SCAN = 500;

interface ValidationRuleSetDoc {
  _id: ObjectId | string;
  projectId: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  rules?: ValidationRuleSet['rules'];
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toRuleSet(doc: ValidationRuleSetDoc): ValidationRuleSet {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    name: doc.name,
    enabled: doc.enabled !== false,
    rules: Array.isArray(doc.rules) ? doc.rules : [],
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* Validation config CRUD                                                      */
/* -------------------------------------------------------------------------- */

export async function listValidationRuleSets(
  projectId: string,
): Promise<ValidationRuleSet[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(RULES_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()) as unknown as ValidationRuleSetDoc[];
  return docs.map(toRuleSet);
}

export async function getValidationRuleSet(
  projectId: string,
  id: string,
): Promise<ValidationRuleSet | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(RULES_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as ValidationRuleSetDoc | null;
  return doc ? toRuleSet(doc) : null;
}

export async function listEnabledValidationSetsForObject(
  projectId: string,
  objectSlug: string,
): Promise<ValidationRuleSet[]> {
  if (!projectId || !objectSlug) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(RULES_COLL)
    .find({ projectId, objectSlug, enabled: { $ne: false } })
    .limit(50)
    .toArray()) as unknown as ValidationRuleSetDoc[];
  return docs.map(toRuleSet);
}

export async function upsertValidationRuleSet(
  projectId: string,
  input: ValidationRuleSetInput,
): Promise<ValidationRuleSet> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    objectSlug: input.objectSlug,
    name: input.name?.trim() || 'Untitled rules',
    enabled: input.enabled !== false,
    rules: Array.isArray(input.rules) ? input.rules : [],
    updatedAt: now,
  };
  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(RULES_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getValidationRuleSet(projectId, input.id);
    if (saved) return saved;
  }
  const res = await db
    .collection(RULES_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toRuleSet({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

export async function deleteValidationRuleSet(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(RULES_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Write-time validation                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Validate a record's (merged) data against every enabled rule set for its
 * object. Returns `{ ok: true, blocked: [], warnings: [] }` when no rule set
 * exists. Best-effort: a config-read failure must never block a legitimate
 * save, so it degrades to "ok".
 */
export async function validateRecordWrite(
  projectId: string,
  objectSlug: string,
  data: Record<string, unknown>,
): Promise<ValidationResult> {
  try {
    const sets = await listEnabledValidationSetsForObject(projectId, objectSlug);
    if (sets.length === 0) return { ok: true, blocked: [], warnings: [] };
    return mergeValidationResults(sets.map((s) => evaluateValidation(s, data)));
  } catch {
    return { ok: true, blocked: [], warnings: [] };
  }
}

/* -------------------------------------------------------------------------- */
/* Merge relation re-parenting                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Re-point every INBOUND relation from the merged-away `secondaryId` onto the
 * surviving `primaryId`, across all objects. Scalar MANY_TO_ONE relations are
 * `$set`; array ONE_TO_MANY relations are `$pull` + `$addToSet`. Returns the
 * number of records modified. Best-effort — never throws.
 *
 * Object/field METADATA is read via the Rust path (two-store rule); the record
 * re-points are direct `sabcrm_records` writes (same collection both stores
 * serve) and intentionally do NOT bump `updatedAt`.
 */
export async function reparentInboundRelations(
  projectId: string,
  objectSlug: string,
  secondaryId: string,
  primaryId: string,
): Promise<number> {
  try {
    if (!projectId || !objectSlug || !secondaryId || !primaryId) return 0;
    const objects = await sabcrmObjectsApi.list(projectId);
    const { db } = await connectToDatabase();
    let modified = 0;
    for (const obj of objects) {
      for (const f of obj.fields) {
        if (f.type !== 'RELATION' || !f.relation) continue;
        if (f.relation.targetObject !== objectSlug) continue;
        const path = `data.${f.key}`;
        if (f.relation.kind === 'ONE_TO_MANY') {
          const docs = (await db
            .collection(RECORDS_COLL)
            .find({ projectId, object: obj.slug, [path]: secondaryId })
            .project({ _id: 1 })
            .toArray()) as Array<{ _id: ObjectId }>;
          if (docs.length === 0) continue;
          const ids = docs.map((d) => d._id);
          await db
            .collection(RECORDS_COLL)
            .updateMany({ _id: { $in: ids } }, { $pull: { [path]: secondaryId } } as never);
          await db
            .collection(RECORDS_COLL)
            .updateMany({ _id: { $in: ids } }, { $addToSet: { [path]: primaryId } } as never);
          modified += ids.length;
        } else {
          const res = await db
            .collection(RECORDS_COLL)
            .updateMany(
              { projectId, object: obj.slug, [path]: secondaryId },
              { $set: { [path]: primaryId } },
            );
          modified += res.modifiedCount;
        }
      }
    }
    return modified;
  } catch {
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Fuzzy duplicate scan                                                        */
/* -------------------------------------------------------------------------- */

/** Serialisable cluster member for the duplicates UI. */
export interface FuzzyDupMember {
  id: string;
  value: string;
  data: Record<string, unknown>;
}

/** Serialisable fuzzy cluster. */
export interface FuzzyDupCluster {
  key: string;
  /** Best pairwise similarity in the cluster, 0–1. */
  score: number;
  members: FuzzyDupMember[];
}

/**
 * Fuzzy-cluster up to {@link MAX_DEDUP_SCAN} records of an object by `fieldKey`
 * similarity (`threshold` in 0–1). Reads records directly (aggregation path);
 * O(n²), on-demand only. Returns clusters of ≥ 2 likely-duplicate records.
 */
export async function findFuzzyDuplicates(
  projectId: string,
  objectSlug: string,
  fieldKey: string,
  threshold: number,
  kind?: 'text' | 'email' | 'phone',
): Promise<FuzzyDupCluster[]> {
  if (!projectId || !objectSlug || !fieldKey) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(RECORDS_COLL)
    .find({ projectId, object: objectSlug, deletedAt: { $in: [null] } })
    .limit(MAX_DEDUP_SCAN)
    .toArray()) as Array<{ _id: ObjectId; data?: Record<string, unknown> }>;

  const records: DedupRecord[] = docs.map((d) => ({
    id: d._id.toHexString(),
    data: d.data ?? {},
  }));

  const clusters: DedupCluster[] = clusterByField(
    records,
    fieldKey,
    Math.min(Math.max(threshold, 0.1), 1),
    kind,
  );

  return clusters.map((c) => ({
    key: c.key,
    score: Math.round(c.score * 100) / 100,
    members: c.members.map((m) => ({
      id: m.id,
      value: String(m.data[fieldKey] ?? ''),
      data: m.data,
    })),
  }));
}
