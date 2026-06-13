import 'server-only';

/**
 * SabCRM — win/loss outcome capture runtime (server-only).
 *
 * Persists one win/loss config per `projectId + objectSlug` in
 * `sabcrm_winloss_config` (the native-Mongo config pattern of
 * `./scoring.server.ts`) and, on a confirmed stage change, classifies the new
 * stage into an outcome and stamps the outcome scalars onto the record (the
 * pure logic in `./win-loss.ts`, re-exported here so callers only import from
 * this file).
 *
 * ## Write-back envelope (mirrors `./ai-fields.server.ts` + `./scoring.server.ts`)
 *
 * On an outcome CHANGE the data is written DIRECT to Mongo `sabcrm_records` as
 * dotted `$set` paths only:
 *
 *   data.outcome      — the SELECT value (`won` / `lost`), or null on → open
 *   data.outcomeAt    — ISO timestamp of the transition (cleared on → open)
 *   data.__winloss    — reserved capture meta `{ outcome, prevStage, newStage,
 *                       capturedAt, reason }`
 *
 * It deliberately does NOT bump the record's top-level `updatedAt`, so an
 * outcome stamp never resets `time.elapsed` / deal-rotting idle clocks or
 * re-triggers record-change workflows (same rationale as the AI-field, rotting
 * and scoring designs). Win/loss REASONS are written by the caller (the create/
 * update action that already owns the `data.winReason` / `data.lossReason`
 * patch) — this module only owns the derived outcome scalars + meta.
 *
 * Both stores point at the same `sabcrm_records` collection, so a scalar written
 * into `data` here is served by the Rust read path with zero crate change. The
 * SELECT field METADATA (outcome / winReason / lossReason) is provisioned via
 * the Rust path in the win-loss action, not here.
 *
 * Everything is best-effort: a downed DB must never break the record mutation
 * that triggered a capture.
 */

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  classifyOutcome,
  OUTCOME_FIELD,
  OUTCOME_AT_FIELD,
  WINLOSS_META_KEY,
  type WinLossConfig,
  type WinLossConfigInput,
  type WinLossOutcome,
  type WinLossReasonOption,
} from './win-loss';

export {
  classifyOutcome,
  isReasonRequired,
  validateOutcomeReason,
  OUTCOME_FIELD,
  OUTCOME_AT_FIELD,
  WIN_REASON_FIELD,
  LOSS_REASON_FIELD,
  WINLOSS_META_KEY,
  type WinLossOutcome,
  type WinLossReasonOption,
  type WinLossConfig,
  type WinLossConfigInput,
  type WinLossRules,
  type ReasonValidation,
} from './win-loss';

const CONFIG_COLL = 'sabcrm_winloss_config';
const RECORDS_COLL = 'sabcrm_records';

/** Field keys whose change indicates a deal stage move. */
const STAGE_FIELD_CANDIDATES = ['stage', 'status', 'dealStage', 'pipelineStage'];

/** Raw Mongo doc for a win/loss config. */
interface WinLossConfigDoc {
  _id: ObjectId | string;
  projectId: string;
  objectSlug: string;
  wonStages?: string[];
  lostStages?: string[];
  requireWonReason?: boolean;
  requireLostReason?: boolean;
  winReasonOptions?: WinLossReasonOption[];
  lossReasonOptions?: WinLossReasonOption[];
  createdAt?: string;
  updatedAt?: string;
}

/** Hex-stringify a Mongo `_id` regardless of stored type. */
function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** Defensive: coerce a value into a clean `string[]` (trimmed, de-duped). */
function toStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Defensive: coerce a value into a clean `WinLossReasonOption[]`. */
function toReasonOptions(v: unknown): WinLossReasonOption[] {
  if (!Array.isArray(v)) return [];
  const out: WinLossReasonOption[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const value =
      typeof o.value === 'string' && o.value.trim()
        ? o.value.trim()
        : typeof o.label === 'string'
          ? o.label.trim()
          : '';
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const label =
      typeof o.label === 'string' && o.label.trim() ? o.label.trim() : value;
    const color =
      typeof o.color === 'string' && o.color.trim() ? o.color.trim() : undefined;
    out.push({ value, label, color });
  }
  return out;
}

/** Normalize a persisted doc into the API {@link WinLossConfig} shape. */
function toConfig(doc: WinLossConfigDoc): WinLossConfig {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    wonStages: toStringList(doc.wonStages),
    lostStages: toStringList(doc.lostStages),
    requireWonReason: doc.requireWonReason === true,
    requireLostReason: doc.requireLostReason === true,
    winReasonOptions: toReasonOptions(doc.winReasonOptions),
    lossReasonOptions: toReasonOptions(doc.lossReasonOptions),
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* Config CRUD                                                                 */
/* -------------------------------------------------------------------------- */

/** All win/loss configs for a project (one per object; newest first). */
export async function listWinLossConfigs(
  projectId: string,
): Promise<WinLossConfig[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(CONFIG_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()) as unknown as WinLossConfigDoc[];
  return docs.map(toConfig);
}

/** The win/loss config for one object in a project, or null. */
export async function getWinLossConfig(
  projectId: string,
  objectSlug: string,
): Promise<WinLossConfig | null> {
  if (!projectId || !objectSlug) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(CONFIG_COLL)
    .findOne({ projectId, objectSlug })) as WinLossConfigDoc | null;
  return doc ? toConfig(doc) : null;
}

/**
 * Upsert the win/loss config for `input.objectSlug` (one config per
 * project+object). Returns the saved shape.
 */
export async function upsertWinLossConfig(
  projectId: string,
  input: WinLossConfigInput,
): Promise<WinLossConfig> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    wonStages: toStringList(input.wonStages),
    lostStages: toStringList(input.lostStages),
    requireWonReason: input.requireWonReason === true,
    requireLostReason: input.requireLostReason === true,
    winReasonOptions: toReasonOptions(input.winReasonOptions),
    lossReasonOptions: toReasonOptions(input.lossReasonOptions),
    updatedAt: now,
  };
  await db.collection(CONFIG_COLL).updateOne(
    { projectId, objectSlug: input.objectSlug },
    {
      $set: fields,
      $setOnInsert: { projectId, objectSlug: input.objectSlug, createdAt: now },
    },
    { upsert: true },
  );
  const saved = await getWinLossConfig(projectId, input.objectSlug);
  if (saved) return saved;
  // Should not happen (we just upserted) — return a synthetic in-memory shape.
  return {
    id: '',
    projectId,
    objectSlug: input.objectSlug,
    ...fields,
    createdAt: now,
  };
}

/** Delete the win/loss config for an object. Returns true when one was removed. */
export async function deleteWinLossConfig(
  projectId: string,
  objectSlug: string,
): Promise<boolean> {
  if (!projectId || !objectSlug) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(CONFIG_COLL)
    .deleteOne({ projectId, objectSlug });
  return res.deletedCount > 0;
}

/** Projects that have at least one win/loss config (for a scheduler backstop). */
export async function listProjectsWithWinLoss(db: Db): Promise<string[]> {
  try {
    const ids = (await db
      .collection(CONFIG_COLL)
      .distinct('projectId')) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Capture                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Pick the reason the caller's patch supplied for this outcome, if any.
 * `data` here is the FULL post-write record data (or the patch merged in), so
 * `data.winReason` / `data.lossReason` are read directly.
 */
function reasonFromData(
  outcome: WinLossOutcome,
  data: Record<string, unknown>,
): string | null {
  const key = outcome === 'won' ? 'winReason' : 'lossReason';
  const v = data?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Capture a win/loss outcome on a deal stage change.
 *
 * Compares the outcome of `prevStage` and `newStage` under the object's config;
 * when the outcome CHANGED, stamps the outcome scalars + capture meta onto the
 * record via the AI-fields envelope (dotted `$set`, NO `updatedAt` bump). When
 * the outcome did not change (or there is no config / no change to a terminal
 * state) nothing is written. Best-effort — never throws.
 *
 * `data` is the record's full data bag AFTER the write (used to read any
 * win/loss reason the same patch supplied). Returns the captured outcome when a
 * write happened, otherwise null.
 */
export async function captureOutcome(
  projectId: string,
  object: string,
  recordId: string,
  prevStage: string | null | undefined,
  newStage: string | null | undefined,
  data: Record<string, unknown>,
): Promise<WinLossOutcome | null> {
  try {
    if (!projectId || !object || !recordId || !ObjectId.isValid(recordId)) {
      return null;
    }
    const config = await getWinLossConfig(projectId, object);
    if (!config) return null;

    const before = classifyOutcome(prevStage, config.wonStages, config.lostStages);
    const after = classifyOutcome(newStage, config.wonStages, config.lostStages);
    if (before === after) return null; // outcome unchanged — nothing to stamp

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    const set: Record<string, unknown> = {};

    if (after === 'open') {
      // Reverted out of a terminal stage — clear the outcome scalars.
      set[`data.${OUTCOME_FIELD}`] = null;
      set[`data.${OUTCOME_AT_FIELD}`] = null;
      set[`data.${WINLOSS_META_KEY}`] = {
        outcome: 'open',
        prevStage: prevStage ?? null,
        newStage: newStage ?? null,
        capturedAt: now,
        reason: null,
      };
    } else {
      const reason = reasonFromData(after, data ?? {});
      set[`data.${OUTCOME_FIELD}`] = after; // 'won' | 'lost'
      set[`data.${OUTCOME_AT_FIELD}`] = now;
      set[`data.${WINLOSS_META_KEY}`] = {
        outcome: after,
        prevStage: prevStage ?? null,
        newStage: newStage ?? null,
        capturedAt: now,
        reason,
      };
    }

    await db
      .collection(RECORDS_COLL)
      .updateOne({ _id: new ObjectId(recordId), projectId }, { $set: set });
    return after;
  } catch {
    return null; // best-effort
  }
}

/**
 * Resolve the deal's stage value from a record data bag. Reads the first
 * populated stage-like field. Exposed so the create/update action can derive
 * `prevStage` / `newStage` without re-implementing the field-name heuristic.
 */
export function stageFromData(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data) return null;
  for (const key of STAGE_FIELD_CANDIDATES) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** True when a patch touches any stage-like field (cheap pre-check). */
export function patchTouchesStage(
  patch: Record<string, unknown> | null | undefined,
): boolean {
  if (!patch) return false;
  return STAGE_FIELD_CANDIDATES.some((k) =>
    Object.prototype.hasOwnProperty.call(patch, k),
  );
}
