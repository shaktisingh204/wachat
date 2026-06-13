import 'server-only';

/**
 * SabCRM — rollup fields runtime (server-only).
 *
 * A rollup writes an aggregate of CHILD records onto a PARENT record's
 * `data.<fieldKey>` (count/sum/avg/min/max over a child field, where the child
 * points at the parent via `childRelationField`). Config in `sabcrm_rollups`
 * (native pattern of `./formula.server.ts`); values written DIRECT to
 * `sabcrm_records` (no `updatedAt` bump). Best-effort throughout.
 *
 * Recompute fires `recomputeRollupsAround(object, recordId)` on every record
 * write: the record is treated BOTH as a possible child (→ recompute its
 * parent's rollups) AND as a possible parent (→ recompute its own rollups from
 * existing children). Deletes / relation re-parenting reconcile on the next
 * scheduler backstop tick.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { computeRollup, type RollupField, type RollupFieldInput, type RollupOp } from './rollup';

export {
  computeRollup,
  ROLLUP_OPS,
  type RollupOp,
  type RollupField,
  type RollupFieldInput,
} from './rollup';

const ROLLUPS_COLL = 'sabcrm_rollups';
const RECORDS_COLL = 'sabcrm_records';
const MAX_CHILDREN = 5000;
const MAX_PARENTS_PER_SWEEP = 1000;

interface RollupDoc {
  _id: ObjectId | string;
  projectId: string;
  objectSlug: string;
  fieldKey: string;
  name?: string;
  childObject: string;
  childRelationField: string;
  op?: RollupOp;
  childTargetField?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toRollup(doc: RollupDoc): RollupField {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    fieldKey: doc.fieldKey,
    name: doc.name,
    childObject: doc.childObject,
    childRelationField: doc.childRelationField,
    op: (doc.op as RollupOp) || 'count',
    childTargetField: doc.childTargetField,
    enabled: doc.enabled !== false,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                        */
/* -------------------------------------------------------------------------- */

export async function listRollups(projectId: string): Promise<RollupField[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(ROLLUPS_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(300)
    .toArray()) as unknown as RollupDoc[];
  return docs.map(toRollup);
}

export async function getRollup(
  projectId: string,
  id: string,
): Promise<RollupField | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(ROLLUPS_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as RollupDoc | null;
  return doc ? toRollup(doc) : null;
}

async function listEnabledRollupsForChild(
  projectId: string,
  childObject: string,
): Promise<RollupField[]> {
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(ROLLUPS_COLL)
    .find({ projectId, childObject, enabled: { $ne: false } })
    .limit(100)
    .toArray()) as unknown as RollupDoc[];
  return docs.map(toRollup);
}

async function listEnabledRollupsForParent(
  projectId: string,
  objectSlug: string,
): Promise<RollupField[]> {
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(ROLLUPS_COLL)
    .find({ projectId, objectSlug, enabled: { $ne: false } })
    .limit(100)
    .toArray()) as unknown as RollupDoc[];
  return docs.map(toRollup);
}

export async function upsertRollup(
  projectId: string,
  input: RollupFieldInput,
): Promise<RollupField> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    objectSlug: input.objectSlug,
    fieldKey: input.fieldKey,
    name: input.name?.trim() || input.fieldKey,
    childObject: input.childObject,
    childRelationField: input.childRelationField,
    op: input.op || 'count',
    childTargetField: input.childTargetField,
    enabled: input.enabled !== false,
    updatedAt: now,
  };
  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(ROLLUPS_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getRollup(projectId, input.id);
    if (saved) return saved;
  }
  const res = await db
    .collection(ROLLUPS_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toRollup({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

export async function deleteRollup(projectId: string, id: string): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(ROLLUPS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Compute                                                                     */
/* -------------------------------------------------------------------------- */

async function computeRollupValue(
  projectId: string,
  rollup: RollupField,
  parentId: string,
): Promise<number> {
  const { db } = await connectToDatabase();
  const proj: Record<string, 1> =
    rollup.op === 'count' || !rollup.childTargetField
      ? { _id: 1 }
      : { [`data.${rollup.childTargetField}`]: 1 };
  const children = (await db
    .collection(RECORDS_COLL)
    .find({
      projectId,
      object: rollup.childObject,
      [`data.${rollup.childRelationField}`]: parentId,
      deletedAt: { $in: [null] },
    })
    .project(proj)
    .limit(MAX_CHILDREN)
    .toArray()) as Array<{ data?: Record<string, unknown> }>;
  const raw =
    rollup.op === 'count' || !rollup.childTargetField
      ? children
      : children.map((c) => (c.data ?? {})[rollup.childTargetField as string]);
  return computeRollup(rollup.op, raw);
}

async function recomputeRollupForParent(
  projectId: string,
  rollup: RollupField,
  parentId: string,
): Promise<boolean> {
  if (!ObjectId.isValid(parentId)) return false;
  const value = await computeRollupValue(projectId, rollup, parentId);
  const { db } = await connectToDatabase();
  await db
    .collection(RECORDS_COLL)
    .updateOne(
      { _id: new ObjectId(parentId), projectId },
      { $set: { [`data.${rollup.fieldKey}`]: value } },
    );
  return true;
}

/**
 * Recompute rollups touched by a write to (object, recordId): treat the record
 * as a child (→ recompute the parent it points at) AND as a parent (→ recompute
 * its own rollups from current children). Best-effort, never throws.
 */
export async function recomputeRollupsAround(
  projectId: string,
  objectSlug: string,
  recordId: string,
): Promise<void> {
  try {
    if (!projectId || !objectSlug || !recordId || !ObjectId.isValid(recordId)) return;

    // As CHILD: recompute the parent(s) this record rolls up into.
    const asChild = await listEnabledRollupsForChild(projectId, objectSlug);
    if (asChild.length > 0) {
      const { db } = await connectToDatabase();
      const rec = (await db
        .collection(RECORDS_COLL)
        .findOne({ _id: new ObjectId(recordId), projectId })) as {
        data?: Record<string, unknown>;
      } | null;
      const data = rec?.data ?? {};
      for (const rollup of asChild) {
        const pid = data[rollup.childRelationField];
        if (typeof pid === 'string' && ObjectId.isValid(pid)) {
          await recomputeRollupForParent(projectId, rollup, pid);
        }
      }
    }

    // As PARENT: recompute this record's own rollups.
    const asParent = await listEnabledRollupsForParent(projectId, objectSlug);
    for (const rollup of asParent) {
      await recomputeRollupForParent(projectId, rollup, recordId);
    }
  } catch {
    /* best-effort */
  }
}

/* -------------------------------------------------------------------------- */
/* Sweeps (backstop + on-save)                                                 */
/* -------------------------------------------------------------------------- */

export async function recomputeRollupsForObject(
  projectId: string,
  parentObject: string,
  limit = MAX_PARENTS_PER_SWEEP,
): Promise<{ scanned: number; updated: number }> {
  try {
    const rollups = await listEnabledRollupsForParent(projectId, parentObject);
    if (rollups.length === 0) return { scanned: 0, updated: 0 };
    const { db } = await connectToDatabase();
    const parents = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object: parentObject, deletedAt: { $in: [null] } })
      .project({ _id: 1 })
      .limit(Math.min(limit, MAX_PARENTS_PER_SWEEP))
      .toArray()) as Array<{ _id: ObjectId }>;
    for (const p of parents) {
      for (const rollup of rollups) {
        await recomputeRollupForParent(projectId, rollup, p._id.toHexString());
      }
    }
    return { scanned: parents.length, updated: parents.length };
  } catch {
    return { scanned: 0, updated: 0 };
  }
}

export async function recomputeAllProjectRollups(
  projectId: string,
  perObjectLimit = 500,
): Promise<Array<{ objectSlug: string; scanned: number; updated: number }>> {
  const out: Array<{ objectSlug: string; scanned: number; updated: number }> = [];
  try {
    const rollups = await listRollups(projectId);
    const parents = [...new Set(rollups.filter((r) => r.enabled).map((r) => r.objectSlug))];
    for (const objectSlug of parents) {
      out.push({
        objectSlug,
        ...(await recomputeRollupsForObject(projectId, objectSlug, perObjectLimit)),
      });
    }
  } catch {
    /* best-effort */
  }
  return out;
}

export async function listProjectsWithRollups(
  db: import('mongodb').Db,
): Promise<string[]> {
  try {
    const ids = (await db
      .collection(ROLLUPS_COLL)
      .distinct('projectId', { enabled: { $ne: false } })) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}
