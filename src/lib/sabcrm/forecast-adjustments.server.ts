import 'server-only';

/**
 * SabCRM — manager forecast adjustments (server-only).
 *
 * A judgment overlay on the computed forecast: a manager can add (or subtract)
 * an amount to a forecast category for a pipeline (optionally scoped to a
 * period). Stored in `sabcrm_forecast_adjustments` (native config pattern of
 * `./scoring.server.ts`); applied additively on top of the computed
 * `commit / bestCase / pipeline` totals — the gross computed figures are never
 * mutated. Best-effort.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

const COLL = 'sabcrm_forecast_adjustments';

/** Which cumulative forecast total an adjustment applies to. */
export type ForecastAdjustmentCategory = 'commit' | 'bestCase' | 'pipeline';

export interface ForecastAdjustment {
  id: string;
  projectId: string;
  pipelineId: string;
  /** First day of the period the adjustment applies to, or '' for all-periods. */
  periodStart: string;
  category: ForecastAdjustmentCategory;
  /** Signed delta (may be negative). */
  amount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForecastAdjustmentInput {
  id?: string;
  pipelineId: string;
  periodStart?: string;
  category: ForecastAdjustmentCategory;
  amount: number;
  note?: string;
}

interface AdjustmentDoc {
  _id: ObjectId | string;
  projectId: string;
  pipelineId: string;
  periodStart?: string;
  category: ForecastAdjustmentCategory;
  amount?: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toAdjustment(doc: AdjustmentDoc): ForecastAdjustment {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    pipelineId: doc.pipelineId,
    periodStart: doc.periodStart ?? '',
    category: doc.category,
    amount: typeof doc.amount === 'number' ? doc.amount : 0,
    note: doc.note,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

export async function listForecastAdjustments(
  projectId: string,
): Promise<ForecastAdjustment[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray()) as unknown as AdjustmentDoc[];
  return docs.map(toAdjustment);
}

/** Adjustments for one pipeline (used by the forecast overlay). */
export async function listAdjustmentsForPipeline(
  projectId: string,
  pipelineId: string,
): Promise<ForecastAdjustment[]> {
  if (!projectId || !pipelineId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(COLL)
    .find({ projectId, pipelineId })
    .limit(500)
    .toArray()) as unknown as AdjustmentDoc[];
  return docs.map(toAdjustment);
}

export async function upsertForecastAdjustment(
  projectId: string,
  input: ForecastAdjustmentInput,
): Promise<ForecastAdjustment> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    pipelineId: input.pipelineId,
    periodStart: input.periodStart ?? '',
    category: input.category,
    amount: Number.isFinite(input.amount) ? Number(input.amount) : 0,
    note: input.note?.trim() || undefined,
    updatedAt: now,
  };
  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const { db: db2 } = await connectToDatabase();
    const doc = (await db2
      .collection(COLL)
      .findOne({ _id: new ObjectId(input.id), projectId })) as AdjustmentDoc | null;
    if (doc) return toAdjustment(doc);
  }
  const res = await db.collection(COLL).insertOne({ projectId, createdAt: now, ...fields });
  return toAdjustment({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

export async function deleteForecastAdjustment(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db.collection(COLL).deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/** Sum the signed adjustment deltas per category for a pipeline. */
export function sumAdjustmentsByCategory(
  adjustments: ForecastAdjustment[],
): Record<ForecastAdjustmentCategory, number> {
  const out: Record<ForecastAdjustmentCategory, number> = {
    commit: 0,
    bestCase: 0,
    pipeline: 0,
  };
  for (const a of adjustments) {
    if (a.category in out) out[a.category] += Number.isFinite(a.amount) ? a.amount : 0;
  }
  return out;
}
