import 'server-only';

/**
 * SabCRM — predictive deal win-probability (server-only, in-house).
 *
 * Trains a logistic-regression model (`./ml-logreg.ts`, pure TS — no Python /
 * ONNX / Rust) on the PROJECT'S OWN won vs lost deals, stores it in
 * `sabcrm_models`, and serves a win-probability written to
 * `data.winProbability` (no `updatedAt` bump — same envelope as scoring/AI
 * fields). Records are labelled won=1 / lost=0 by a stage heuristic; open deals
 * are unlabelled (excluded from training, scored at serving). Best-effort;
 * scoring on write is a no-op until a model is trained for the object.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { trainLogReg, predictProba, type LogRegModel } from './ml-logreg';

const MODELS_COLL = 'sabcrm_models';
const RECORDS_COLL = 'sabcrm_records';
const MAX_TRAIN_RECORDS = 5000;
const MIN_TRAIN_SAMPLES = 20;

interface ModelDoc {
  _id?: ObjectId;
  projectId: string;
  object: string;
  kind: 'win';
  weights: number[];
  bias: number;
  mean: number[];
  std: number[];
  n: number;
  trainedAt: string;
}

/** Coerce a (possibly composite) value to a number; 0 on failure. */
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['amount', 'value', 'amountMicros']) {
      const c = o[k];
      if (typeof c === 'number') return k === 'amountMicros' ? c / 1_000_000 : c;
    }
  }
  return 0;
}

/** Won/lost/open classification from a record's stage value (heuristic). */
function outcome(data: Record<string, unknown>): 'won' | 'lost' | 'open' {
  const s = String(data.stage ?? data.status ?? '').toLowerCase();
  if (!s) return 'open';
  if (/\bwon\b|customer|closed.?won|complete/.test(s)) return 'won';
  if (/\blost\b|closed.?lost|cancel|reject|dead/.test(s)) return 'lost';
  return 'open';
}

const DAY_MS = 86_400_000;

/**
 * Feature vector for one deal record. Deterministic; the same extraction is
 * used at train + serve time. `nowMs` keeps age features stable per batch.
 */
export function dealFeatures(
  data: Record<string, unknown>,
  createdAt: string | undefined,
  nowMs: number,
): number[] {
  const amount = num(data.amount);
  const created = createdAt ? Date.parse(createdAt) : NaN;
  const ageDays = Number.isFinite(created) ? Math.max(0, (nowMs - created) / DAY_MS) : 0;
  const closeRaw = data.closeDate ?? data.expectedCloseDate;
  const close = typeof closeRaw === 'string' ? Date.parse(closeRaw) : NaN;
  const hasClose = Number.isFinite(close) ? 1 : 0;
  const daysToClose = Number.isFinite(close) ? (close - nowMs) / DAY_MS : 0;
  const hasOwner = data.owner || data.assignedTo || data.ownerId ? 1 : 0;
  return [
    Math.log1p(Math.max(0, amount)),
    ageDays,
    hasClose,
    Math.max(-365, Math.min(365, daysToClose)),
    hasOwner,
  ];
}

/* -------------------------------------------------------------------------- */
/* Train                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Train (or retrain) the win model for an object from its won/lost history.
 * Returns the sample count, or `{ trained:false }` when there isn't enough
 * labelled data. Best-effort.
 */
export async function trainWinModel(
  projectId: string,
  objectSlug: string,
): Promise<{ trained: boolean; won: number; lost: number; n: number }> {
  try {
    if (!projectId || !objectSlug) return { trained: false, won: 0, lost: 0, n: 0 };
    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object: objectSlug, deletedAt: { $in: [null] } })
      .project({ data: 1, createdAt: 1 })
      .limit(MAX_TRAIN_RECORDS)
      .toArray()) as Array<{ data?: Record<string, unknown>; createdAt?: string }>;

    const now = Date.now();
    const X: number[][] = [];
    const y: number[] = [];
    let won = 0;
    let lost = 0;
    for (const r of recs) {
      const data = r.data ?? {};
      const out = outcome(data);
      if (out === 'open') continue;
      X.push(dealFeatures(data, r.createdAt, now));
      y.push(out === 'won' ? 1 : 0);
      if (out === 'won') won += 1;
      else lost += 1;
    }
    if (X.length < MIN_TRAIN_SAMPLES || won === 0 || lost === 0) {
      return { trained: false, won, lost, n: X.length };
    }
    const model = trainLogReg(X, y, { epochs: 400, lr: 0.2, l2: 0.002 });
    const doc: ModelDoc = {
      projectId,
      object: objectSlug,
      kind: 'win',
      weights: model.weights,
      bias: model.bias,
      mean: model.mean,
      std: model.std,
      n: model.n,
      trainedAt: new Date().toISOString(),
    };
    await db
      .collection(MODELS_COLL)
      .updateOne({ projectId, object: objectSlug, kind: 'win' }, { $set: doc }, { upsert: true });
    return { trained: true, won, lost, n: X.length };
  } catch {
    return { trained: false, won: 0, lost: 0, n: 0 };
  }
}

async function getWinModel(
  projectId: string,
  objectSlug: string,
): Promise<LogRegModel | null> {
  try {
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(MODELS_COLL)
      .findOne({ projectId, object: objectSlug, kind: 'win' })) as ModelDoc | null;
    if (!doc) return null;
    return { weights: doc.weights, bias: doc.bias, mean: doc.mean, std: doc.std, n: doc.n };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Serve                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Score one record's win-probability and write it to `data.winProbability`
 * (0–100, no `updatedAt` bump). No-op when no model is trained for the object.
 * Best-effort — never throws.
 */
export async function scoreWinForRecord(
  projectId: string,
  objectSlug: string,
  recordId: string,
): Promise<boolean> {
  try {
    if (!projectId || !objectSlug || !recordId || !ObjectId.isValid(recordId)) return false;
    const model = await getWinModel(projectId, objectSlug);
    if (!model) return false;
    const { db } = await connectToDatabase();
    const rec = (await db
      .collection(RECORDS_COLL)
      .findOne({ _id: new ObjectId(recordId), projectId })) as {
      data?: Record<string, unknown>;
      createdAt?: string;
      deletedAt?: unknown;
    } | null;
    if (!rec || rec.deletedAt) return false;
    const p = predictProba(dealFeatures(rec.data ?? {}, rec.createdAt, Date.now()), model);
    const pct = Math.round(p * 1000) / 10; // 0–100, 1dp
    await db.collection(RECORDS_COLL).updateOne(
      { _id: new ObjectId(recordId), projectId },
      {
        $set: {
          'data.winProbability': pct,
          'data.__win': { probability: pct, scoredAt: new Date().toISOString() },
        },
      },
    );
    return true;
  } catch {
    return false;
  }
}

/** Whether an object has a trained win model (cheap guard for write hooks). */
export async function hasWinModel(projectId: string, objectSlug: string): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    return (
      (await db
        .collection(MODELS_COLL)
        .findOne({ projectId, object: objectSlug, kind: 'win' }, { projection: { _id: 1 } })) !== null
    );
  } catch {
    return false;
  }
}

/** Re-score up to `limit` live records of an object (used after (re)training). */
export async function scoreWinForObject(
  projectId: string,
  objectSlug: string,
  limit = 1000,
): Promise<{ scanned: number; updated: number }> {
  try {
    const model = await getWinModel(projectId, objectSlug);
    if (!model) return { scanned: 0, updated: 0 };
    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object: objectSlug, deletedAt: { $in: [null] } })
      .project({ data: 1, createdAt: 1 })
      .limit(limit)
      .toArray()) as Array<{ _id: ObjectId; data?: Record<string, unknown>; createdAt?: string }>;
    const now = Date.now();
    let updated = 0;
    for (const r of recs) {
      const p = predictProba(dealFeatures(r.data ?? {}, r.createdAt, now), model);
      const pct = Math.round(p * 1000) / 10;
      await db.collection(RECORDS_COLL).updateOne(
        { _id: r._id, projectId },
        { $set: { 'data.winProbability': pct, 'data.__win': { probability: pct, scoredAt: new Date().toISOString() } } },
      );
      updated += 1;
    }
    return { scanned: recs.length, updated };
  } catch {
    return { scanned: 0, updated: 0 };
  }
}
