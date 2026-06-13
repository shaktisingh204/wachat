import 'server-only';

/**
 * SabCRM — calibrated, explainable, per-segment win-probability (server-only).
 *
 * An UPGRADE layer over `./predictive-scoring.server.ts`. The base predictor
 * trains ONE logistic model per object and writes a raw probability. This module
 * adds three things, all in-house (pure TS — no Python / ONNX / Rust / 3rd-party
 * ML), reusing `./ml-logreg.ts` for the fit and `./ml-calibration.ts` for the
 * post-processing:
 *
 *  1. PER-SEGMENT models. Deals are partitioned by a chosen categorical field
 *     (e.g. `pipeline`, `source`, `region`); each segment with enough labelled
 *     history gets its own logistic model. A GLOBAL model trained on all deals
 *     is the cold-start fallback for unseen / sparse segments.
 *
 *  2. CALIBRATION. Each model's raw scores are mapped through Platt scaling
 *     fitted on a held-out split, so `data.winProbability` reflects an honest
 *     probability. Brier + ECE on the holdout are stored for the settings UI.
 *
 *  3. EXPLAINABILITY. `scoreCalibrated` also writes `data.__winexplain` with the
 *     top positive / negative feature drivers behind the prediction (logistic
 *     "SHAP-like" decomposition).
 *
 * ## Storage
 * A single bundle doc per (project, object) in `sabcrm_models` under a NEW
 * `kind: 'win-calibrated'` — it never overwrites the base `kind: 'win'` model,
 * so the two can coexist. The bundle holds the global model + its calibrator,
 * the per-segment models + calibrators, the segment field, and quality metrics.
 *
 * ## Write-back envelope (mirrors scoring/AI fields)
 * Scalars go to `sabcrm_records` via dotted `$set` only — `data.winProbability`
 * (calibrated 0–100) + `data.__winexplain` (reserved meta) — with NO `updatedAt`
 * bump, so a score write never resets idle clocks or re-triggers workflows.
 * The bundle config doc in `sabcrm_models` MAY bump its own `updatedAt`.
 *
 * Everything is best-effort: a downed DB or thin history must never break the
 * record mutation that triggered a score.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { trainLogReg, predictProba, type LogRegModel } from './ml-logreg';
import { dealFeatures } from './predictive-scoring.server';
import {
  plattScaling,
  applyPlatt,
  brierScore,
  expectedCalibrationError,
  featureContributions,
  type PlattParams,
} from './ml-calibration';

const MODELS_COLL = 'sabcrm_models';
const RECORDS_COLL = 'sabcrm_records';
const KIND = 'win-calibrated' as const;

const MAX_TRAIN_RECORDS = 8000;
/** Minimum labelled deals (won+lost) to fit a per-SEGMENT model. */
const MIN_SEGMENT_SAMPLES = 25;
/** Minimum labelled deals to fit the GLOBAL fallback model. */
const MIN_GLOBAL_SAMPLES = 20;
/** Holdout fraction used to fit Platt calibration + measure quality. */
const HOLDOUT_FRACTION = 0.25;
/** Cap on segments fitted (avoids pathological high-cardinality fields). */
const MAX_SEGMENTS = 40;
const GLOBAL_SEGMENT = '__global__';

/** Human labels for `dealFeatures`, aligned with its return order. */
export const DEAL_FEATURE_LABELS: readonly string[] = [
  'Deal amount',
  'Deal age (days)',
  'Has close date',
  'Days to close',
  'Has owner',
];

/* -------------------------------------------------------------------------- */
/* Persisted shapes                                                           */
/* -------------------------------------------------------------------------- */

interface CalibratedSegmentModel {
  /** Segment key (the categorical value, or GLOBAL_SEGMENT for fallback). */
  segment: string;
  weights: number[];
  bias: number;
  mean: number[];
  std: number[];
  /** Number of training rows that fit this segment's model. */
  n: number;
  /** Fitted Platt calibration for this segment. */
  platt: PlattParams;
  /** Holdout Brier score (lower better); null when no holdout. */
  brier: number | null;
}

interface CalibratedBundleDoc {
  _id?: ObjectId;
  projectId: string;
  object: string;
  kind: typeof KIND;
  /** Categorical data field used to segment, or null for global-only. */
  segmentField: string | null;
  /** Global fallback model (always present once trained). */
  global: CalibratedSegmentModel;
  /** Per-segment models keyed by segment value. */
  segments: CalibratedSegmentModel[];
  /** Quality readout for the UI. */
  metrics: {
    /** Overall holdout Brier across all rows (calibrated). */
    brier: number | null;
    /** Overall holdout Expected Calibration Error (calibrated). */
    ece: number | null;
    /** Holdout Brier of the RAW (uncalibrated) global model — for contrast. */
    rawBrier: number | null;
    won: number;
    lost: number;
    n: number;
  };
  trainedAt: string;
  updatedAt: string;
}

/** Public training report (returned by the action). */
export interface CalibrationTrainReport {
  trained: boolean;
  segmentField: string | null;
  won: number;
  lost: number;
  n: number;
  brier: number | null;
  ece: number | null;
  rawBrier: number | null;
  /** Per-segment sample counts (incl. the global fallback). */
  segments: Array<{ segment: string; n: number; brier: number | null }>;
  reason?: string;
}

/** Public explanation payload (returned by getWinExplanationTw). */
export interface WinExplanation {
  probability: number; // 0–100 calibrated
  segment: string;
  usedFallback: boolean;
  topPositive: Array<{ name: string; contribution: number }>;
  topNegative: Array<{ name: string; contribution: number }>;
  scoredAt: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers (pure)                                                             */
/* -------------------------------------------------------------------------- */

/** Won/lost/open from a record's stage value (same heuristic as the base). */
function outcome(data: Record<string, unknown>): 'won' | 'lost' | 'open' {
  const s = String(data.stage ?? data.status ?? '').toLowerCase();
  if (!s) return 'open';
  if (/\bwon\b|customer|closed.?won|complete/.test(s)) return 'won';
  if (/\blost\b|closed.?lost|cancel|reject|dead/.test(s)) return 'lost';
  return 'open';
}

/** Read the segment value for a record from the chosen field (normalised). */
function segmentOf(
  data: Record<string, unknown>,
  segmentField: string | null,
): string {
  if (!segmentField) return GLOBAL_SEGMENT;
  const v = data[segmentField];
  if (v == null) return GLOBAL_SEGMENT;
  const s = String(typeof v === 'object' ? JSON.stringify(v) : v).trim();
  return s.length ? s : GLOBAL_SEGMENT;
}

/** Deterministic split index for a row (stable across train runs). */
function isHoldout(i: number, total: number): boolean {
  // every Nth row, where N ≈ 1/HOLDOUT_FRACTION, goes to the holdout.
  const stride = Math.max(2, Math.round(1 / HOLDOUT_FRACTION));
  return i % stride === 0 && total > 4;
}

interface LabelledRow {
  x: number[];
  y: number;
  segment: string;
}

/**
 * Fit one calibrated model from labelled rows: a logistic fit on the TRAIN
 * split, then Platt calibration + Brier on the HOLDOUT split. Returns null when
 * there isn't enough data or only one class is present.
 */
function fitCalibrated(
  rows: LabelledRow[],
  segment: string,
  minSamples: number,
): { model: CalibratedSegmentModel; holdout: LabelledRow[] } | null {
  if (rows.length < minSamples) return null;
  let won = 0;
  let lost = 0;
  for (const r of rows) (r.y >= 0.5 ? won++ : lost++);
  if (won === 0 || lost === 0) return null;

  const train: LabelledRow[] = [];
  const holdout: LabelledRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (isHoldout(i, rows.length)) holdout.push(rows[i]);
    else train.push(rows[i]);
  }
  // guard: if holdout starved a class out of train, just train on everything.
  let tw = 0;
  let tl = 0;
  for (const r of train) (r.y >= 0.5 ? tw++ : tl++);
  const effTrain = tw > 0 && tl > 0 ? train : rows;
  const effHoldout = tw > 0 && tl > 0 ? holdout : rows;

  const base: LogRegModel = trainLogReg(
    effTrain.map((r) => r.x),
    effTrain.map((r) => r.y),
    { epochs: 400, lr: 0.2, l2: 0.002 },
  );

  // raw logit-space scores on the holdout for Platt fitting.
  const rawScores = effHoldout.map((r) => rawLogit(r.x, base));
  const labels = effHoldout.map((r) => r.y);
  const platt = plattScaling(rawScores, labels);
  const calibrated = rawScores.map((s) => applyPlatt(s, platt));
  const brier = labels.length ? brierScore(calibrated, labels) : null;

  return {
    model: {
      segment,
      weights: base.weights,
      bias: base.bias,
      mean: base.mean,
      std: base.std,
      n: rows.length,
      platt,
      brier,
    },
    holdout: effHoldout,
  };
}

/** Raw logit (pre-sigmoid) for a feature vector under a model. */
function rawLogit(features: number[], model: LogRegModel): number {
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j++) {
    const xs = (features[j] - (model.mean[j] ?? 0)) / (model.std[j] || 1);
    z += model.weights[j] * xs;
  }
  return z;
}

/** Calibrated probability in [0,1] for a feature vector under a segment model. */
function calibratedProba(
  features: number[],
  m: CalibratedSegmentModel,
): number {
  const z = rawLogit(features, {
    weights: m.weights,
    bias: m.bias,
    mean: m.mean,
    std: m.std,
    n: m.n,
  });
  return applyPlatt(z, m.platt);
}

/* -------------------------------------------------------------------------- */
/* Train                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Train (or retrain) the calibrated per-segment win model for an object.
 *
 * @param projectId    tenant scope
 * @param objectSlug   object to train on (e.g. the deal object)
 * @param segmentField categorical data field to segment by, or null/'' for
 *                     global-only. Segments with <{@link MIN_SEGMENT_SAMPLES}
 *                     labelled deals fall back to the global model at serving.
 *
 * Best-effort: returns `{ trained:false, reason }` rather than throwing.
 */
export async function trainCalibratedModel(
  projectId: string,
  objectSlug: string,
  segmentField?: string | null,
): Promise<CalibrationTrainReport> {
  const segField = segmentField && segmentField.trim() ? segmentField.trim() : null;
  const empty: CalibrationTrainReport = {
    trained: false,
    segmentField: segField,
    won: 0,
    lost: 0,
    n: 0,
    brier: null,
    ece: null,
    rawBrier: null,
    segments: [],
  };
  try {
    if (!projectId || !objectSlug) return { ...empty, reason: 'Missing project or object.' };
    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object: objectSlug, deletedAt: { $in: [null] } })
      .project({ data: 1, createdAt: 1 })
      .limit(MAX_TRAIN_RECORDS)
      .toArray()) as Array<{ data?: Record<string, unknown>; createdAt?: string }>;

    const now = Date.now();
    const all: LabelledRow[] = [];
    const bySegment = new Map<string, LabelledRow[]>();
    let won = 0;
    let lost = 0;
    for (const r of recs) {
      const data = r.data ?? {};
      const out = outcome(data);
      if (out === 'open') continue;
      const row: LabelledRow = {
        x: dealFeatures(data, r.createdAt, now),
        y: out === 'won' ? 1 : 0,
        segment: segmentOf(data, segField),
      };
      all.push(row);
      if (out === 'won') won++;
      else lost++;
      if (segField) {
        const arr = bySegment.get(row.segment) ?? [];
        arr.push(row);
        bySegment.set(row.segment, arr);
      }
    }

    // Global fallback (always attempted first — required for any serving).
    const globalFit = fitCalibrated(all, GLOBAL_SEGMENT, MIN_GLOBAL_SAMPLES);
    if (!globalFit) {
      return {
        ...empty,
        won,
        lost,
        n: all.length,
        reason: `Not enough labelled history to train (need ≥${MIN_GLOBAL_SAMPLES} deals with both won and lost; have ${won} won / ${lost} lost).`,
      };
    }

    // Per-segment models (skip the implicit global bucket; cap cardinality).
    const segments: CalibratedSegmentModel[] = [];
    const segReport: Array<{ segment: string; n: number; brier: number | null }> = [];
    if (segField) {
      const sortedSegs = [...bySegment.entries()]
        .filter(([k]) => k !== GLOBAL_SEGMENT)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, MAX_SEGMENTS);
      for (const [seg, rows] of sortedSegs) {
        const fit = fitCalibrated(rows, seg, MIN_SEGMENT_SAMPLES);
        if (fit) {
          segments.push(fit.model);
          segReport.push({ segment: seg, n: fit.model.n, brier: fit.model.brier });
        }
      }
    }
    segReport.unshift({
      segment: GLOBAL_SEGMENT,
      n: globalFit.model.n,
      brier: globalFit.model.brier,
    });

    // Overall holdout quality: route each global-holdout row through whichever
    // model would serve it (its segment model when present, else global).
    const segIndex = new Map(segments.map((s) => [s.segment, s]));
    const probs: number[] = [];
    const labels: number[] = [];
    const rawProbs: number[] = [];
    for (const r of globalFit.holdout) {
      const m = segIndex.get(r.segment) ?? globalFit.model;
      probs.push(calibratedProba(r.x, m));
      rawProbs.push(predictProba(r.x, {
        weights: globalFit.model.weights,
        bias: globalFit.model.bias,
        mean: globalFit.model.mean,
        std: globalFit.model.std,
        n: globalFit.model.n,
      }));
      labels.push(r.y);
    }
    const brier = labels.length ? brierScore(probs, labels) : null;
    const ece = labels.length ? expectedCalibrationError(probs, labels) : null;
    const rawBrier = labels.length ? brierScore(rawProbs, labels) : null;

    const nowIso = new Date().toISOString();
    const doc: CalibratedBundleDoc = {
      projectId,
      object: objectSlug,
      kind: KIND,
      segmentField: segField,
      global: globalFit.model,
      segments,
      metrics: { brier, ece, rawBrier, won, lost, n: all.length },
      trainedAt: nowIso,
      updatedAt: nowIso,
    };
    await db
      .collection(MODELS_COLL)
      .updateOne(
        { projectId, object: objectSlug, kind: KIND },
        { $set: doc },
        { upsert: true },
      );

    return {
      trained: true,
      segmentField: segField,
      won,
      lost,
      n: all.length,
      brier,
      ece,
      rawBrier,
      segments: segReport,
    };
  } catch (e) {
    return { ...empty, reason: e instanceof Error ? e.message : 'Training failed.' };
  }
}

/* -------------------------------------------------------------------------- */
/* Serve                                                                      */
/* -------------------------------------------------------------------------- */

async function getBundle(
  projectId: string,
  objectSlug: string,
): Promise<CalibratedBundleDoc | null> {
  try {
    const { db } = await connectToDatabase();
    return (await db
      .collection(MODELS_COLL)
      .findOne({ projectId, object: objectSlug, kind: KIND })) as CalibratedBundleDoc | null;
  } catch {
    return null;
  }
}

/** Pick the serving model + whether it's the global fallback. */
function pickModel(
  bundle: CalibratedBundleDoc,
  data: Record<string, unknown>,
): { model: CalibratedSegmentModel; segment: string; usedFallback: boolean } {
  const seg = segmentOf(data, bundle.segmentField);
  const segModel = bundle.segments.find((s) => s.segment === seg);
  if (segModel) return { model: segModel, segment: seg, usedFallback: false };
  return { model: bundle.global, segment: seg, usedFallback: true };
}

/** Build the explanation for one prediction (pure given a model + features). */
function explain(
  model: CalibratedSegmentModel,
  features: number[],
  segment: string,
  usedFallback: boolean,
  pct: number,
  scoredAt: string,
): WinExplanation {
  const bd = featureContributions(
    model.weights,
    model.bias,
    features,
    model.mean,
    model.std,
    DEAL_FEATURE_LABELS as string[],
    3,
  );
  const round = (n: number): number => Math.round(n * 1000) / 1000;
  return {
    probability: pct,
    segment,
    usedFallback,
    topPositive: bd.topPositive.map((c) => ({ name: c.name, contribution: round(c.contribution) })),
    topNegative: bd.topNegative.map((c) => ({ name: c.name, contribution: round(c.contribution) })),
    scoredAt,
  };
}

/**
 * Score one record's CALIBRATED win-probability and explanation, writing
 * `data.winProbability` (0–100) + `data.__winexplain` via the AI-fields
 * envelope (dotted `$set`, NO `updatedAt` bump). No-op when no calibrated bundle
 * exists for the object. Best-effort — never throws.
 */
export async function scoreCalibrated(
  projectId: string,
  objectSlug: string,
  recordId: string,
): Promise<boolean> {
  try {
    if (!projectId || !objectSlug || !recordId || !ObjectId.isValid(recordId)) return false;
    const bundle = await getBundle(projectId, objectSlug);
    if (!bundle) return false;
    const { db } = await connectToDatabase();
    const rec = (await db
      .collection(RECORDS_COLL)
      .findOne({ _id: new ObjectId(recordId), projectId })) as {
      data?: Record<string, unknown>;
      createdAt?: string;
      deletedAt?: unknown;
    } | null;
    if (!rec || rec.deletedAt) return false;

    const data = rec.data ?? {};
    const features = dealFeatures(data, rec.createdAt, Date.now());
    const { model, segment, usedFallback } = pickModel(bundle, data);
    const p = calibratedProba(features, model);
    const pct = Math.round(p * 1000) / 10; // 0–100, 1dp
    const scoredAt = new Date().toISOString();
    const explanation = explain(model, features, segment, usedFallback, pct, scoredAt);

    await db.collection(RECORDS_COLL).updateOne(
      { _id: new ObjectId(recordId), projectId },
      {
        $set: {
          'data.winProbability': pct,
          'data.__winexplain': explanation,
        },
      },
    );
    return true;
  } catch {
    return false;
  }
}

/** Whether an object has a trained calibrated bundle (cheap write-hook guard). */
export async function hasCalibratedModel(
  projectId: string,
  objectSlug: string,
): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    return (
      (await db
        .collection(MODELS_COLL)
        .findOne(
          { projectId, object: objectSlug, kind: KIND },
          { projection: { _id: 1 } },
        )) !== null
    );
  } catch {
    return false;
  }
}

/**
 * Re-score up to `limit` live records of an object with the calibrated bundle
 * (used right after (re)training). Returns a small report. Best-effort.
 */
export async function scoreCalibratedForObject(
  projectId: string,
  objectSlug: string,
  limit = 2000,
): Promise<{ scanned: number; updated: number }> {
  try {
    const bundle = await getBundle(projectId, objectSlug);
    if (!bundle) return { scanned: 0, updated: 0 };
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
      const data = r.data ?? {};
      const features = dealFeatures(data, r.createdAt, now);
      const { model, segment, usedFallback } = pickModel(bundle, data);
      const p = calibratedProba(features, model);
      const pct = Math.round(p * 1000) / 10;
      const scoredAt = new Date().toISOString();
      const explanation = explain(model, features, segment, usedFallback, pct, scoredAt);
      await db.collection(RECORDS_COLL).updateOne(
        { _id: r._id, projectId },
        { $set: { 'data.winProbability': pct, 'data.__winexplain': explanation } },
      );
      updated += 1;
    }
    return { scanned: recs.length, updated };
  } catch {
    return { scanned: 0, updated: 0 };
  }
}

/**
 * Read the stored explanation for one record (no recompute). Falls back to a
 * live `scoreCalibrated` when none is cached yet. Returns null when no model.
 */
export async function getWinExplanation(
  projectId: string,
  objectSlug: string,
  recordId: string,
): Promise<WinExplanation | null> {
  try {
    if (!projectId || !objectSlug || !recordId || !ObjectId.isValid(recordId)) return null;
    const { db } = await connectToDatabase();
    const rec = (await db
      .collection(RECORDS_COLL)
      .findOne(
        { _id: new ObjectId(recordId), projectId },
        { projection: { 'data.__winexplain': 1 } },
      )) as { data?: { __winexplain?: WinExplanation } } | null;
    const cached = rec?.data?.__winexplain;
    if (cached && Array.isArray(cached.topPositive)) return cached;
    // none cached — compute on demand then re-read.
    const ok = await scoreCalibrated(projectId, objectSlug, recordId);
    if (!ok) return null;
    const fresh = (await db
      .collection(RECORDS_COLL)
      .findOne(
        { _id: new ObjectId(recordId), projectId },
        { projection: { 'data.__winexplain': 1 } },
      )) as { data?: { __winexplain?: WinExplanation } } | null;
    return fresh?.data?.__winexplain ?? null;
  } catch {
    return null;
  }
}
