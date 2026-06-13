import 'server-only';

/**
 * SabCRM — rule-based lead/deal scoring runtime (server-only).
 *
 * Persists scoring rule sets in `sabcrm_scoring_rules` (projectId-scoped, the
 * native-Mongo config pattern of `./sequences.server.ts`) and recomputes a
 * record's score by summing the points of every matching rule (the pure math
 * in `./scoring.ts`, re-exported here so callers only import from this file).
 *
 * ## Write-back envelope (mirrors `./ai-fields.server.ts`)
 *
 * The score is written DIRECT to Mongo `sabcrm_records` as dotted `$set` paths
 * only — `data.<scoreField>` (a NUMBER), `data.<tierField>` (the tier label, a
 * SELECT value) and the reserved `data.__score.<ruleSetId>` meta
 * (`{ inputsHash, computedAt, score, tier }`). It deliberately does NOT bump
 * the record's top-level `updatedAt`, so a score write never resets the
 * `time.elapsed` / deal-rotting idle clocks or re-triggers record-change
 * workflows (same rationale as the AI-field + rotting-tag designs).
 *
 * Both stores point at the same `sabcrm_records` collection, so a scalar
 * written into `data` here is served by the Rust read path with zero crate
 * change (the whole AI-fields feature relies on this). Object/field METADATA
 * must still go through the Rust path — that provisioning happens in the
 * scoring action, not here.
 *
 * Everything is best-effort: a downed DB must never break the record mutation
 * that triggered a recompute.
 */

import { createHash } from 'crypto';
import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  computeScore,
  scoringSourceFields,
  DEFAULT_SCORE_FIELD,
  DEFAULT_TIER_FIELD,
  type ScoringRuleSet,
  type ScoringRuleSetInput,
} from './scoring';

export {
  computeScore,
  evalCondition,
  resolveTier,
  scoringSourceFields,
  DEFAULT_SCORE_FIELD,
  DEFAULT_TIER_FIELD,
  type ScoringRule,
  type ScoreTier,
  type ScoringRuleSet,
  type ScoringRuleSetInput,
  type ScoreResult,
} from './scoring';

const RULES_COLL = 'sabcrm_scoring_rules';
const RECORDS_COLL = 'sabcrm_records';

/** Cap on records recomputed per object in one sweep (mirrors the AI pass). */
const MAX_RECORDS_PER_SWEEP = 1000;

/** Raw Mongo doc for a scoring rule set. */
interface ScoringRuleSetDoc {
  _id: ObjectId | string;
  projectId: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  rules?: ScoringRuleSet['rules'];
  tiers?: ScoringRuleSet['tiers'];
  scoreField?: string;
  tierField?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Hex-stringify a Mongo `_id` regardless of stored type. */
function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** Normalize a persisted doc into the API {@link ScoringRuleSet} shape. */
function toRuleSet(doc: ScoringRuleSetDoc): ScoringRuleSet {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    name: doc.name,
    enabled: doc.enabled !== false,
    rules: Array.isArray(doc.rules) ? doc.rules : [],
    tiers: Array.isArray(doc.tiers) ? doc.tiers : [],
    scoreField: doc.scoreField || DEFAULT_SCORE_FIELD,
    tierField: doc.tierField || DEFAULT_TIER_FIELD,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/**
 * sha256 hex (32 chars) over the rule-set definition + the referenced record
 * values — the dirty-check key that lets a sweep skip in-sync records (mirrors
 * `aiInputsHash`). Lives here (not in the pure module) so the client bundle
 * never pulls in `crypto`.
 */
export function scoreInputsHash(
  ruleSet: ScoringRuleSet,
  data: Record<string, unknown>,
): string {
  const values: Record<string, unknown> = {};
  for (const f of scoringSourceFields(ruleSet)) values[f] = data?.[f];
  return createHash('sha256')
    .update(
      JSON.stringify({ rules: ruleSet.rules, tiers: ruleSet.tiers, values }),
    )
    .digest('hex')
    .slice(0, 32);
}

/* -------------------------------------------------------------------------- */
/* Config CRUD                                                                 */
/* -------------------------------------------------------------------------- */

/** All scoring rule sets for a project (newest first). */
export async function listScoringRuleSets(
  projectId: string,
): Promise<ScoringRuleSet[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(RULES_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()) as unknown as ScoringRuleSetDoc[];
  return docs.map(toRuleSet);
}

/** One rule set by id (scoped to the project), or null. */
export async function getScoringRuleSet(
  projectId: string,
  id: string,
): Promise<ScoringRuleSet | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(RULES_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as ScoringRuleSetDoc | null;
  return doc ? toRuleSet(doc) : null;
}

/** Enabled rule sets that target a given object. */
export async function listEnabledRuleSetsForObject(
  projectId: string,
  objectSlug: string,
): Promise<ScoringRuleSet[]> {
  if (!projectId || !objectSlug) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(RULES_COLL)
    .find({ projectId, objectSlug, enabled: { $ne: false } })
    .limit(50)
    .toArray()) as unknown as ScoringRuleSetDoc[];
  return docs.map(toRuleSet);
}

/** Insert (no id) or update (valid id) a rule set; returns the saved shape. */
export async function upsertScoringRuleSet(
  projectId: string,
  input: ScoringRuleSetInput,
): Promise<ScoringRuleSet> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    objectSlug: input.objectSlug,
    name: input.name?.trim() || 'Untitled scoring',
    enabled: input.enabled !== false,
    rules: Array.isArray(input.rules) ? input.rules : [],
    tiers: Array.isArray(input.tiers) ? input.tiers : [],
    scoreField: input.scoreField || DEFAULT_SCORE_FIELD,
    tierField: input.tierField || DEFAULT_TIER_FIELD,
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
    const saved = await getScoringRuleSet(projectId, input.id);
    if (saved) return saved;
  }

  const res = await db
    .collection(RULES_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toRuleSet({
    _id: res.insertedId,
    projectId,
    createdAt: now,
    ...fields,
  });
}

/** Delete a rule set by id. Returns true when a doc was removed. */
export async function deleteScoringRuleSet(
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
/* Recompute                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Build the dotted `$set` for one record across all enabled rule sets that
 * target its object. Skips a rule set whose inputs hash matches the stored
 * meta (record + rules unchanged). Returns an empty object when nothing
 * changed. Pure given `ruleSets` + `data` (no I/O).
 */
function buildScoreSet(
  ruleSets: ScoringRuleSet[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  const meta = (data.__score ?? {}) as Record<
    string,
    { inputsHash?: string } | undefined
  >;
  for (const rs of ruleSets) {
    const hash = scoreInputsHash(rs, data);
    if (meta[rs.id]?.inputsHash === hash) continue; // in sync — skip
    const { score, tier } = computeScore(rs, data);
    set[`data.${rs.scoreField}`] = score;
    set[`data.${rs.tierField}`] = tier ? tier.label : null;
    set[`data.__score.${rs.id}`] = {
      inputsHash: hash,
      computedAt: new Date().toISOString(),
      score,
      tier: tier?.label ?? null,
    };
  }
  return set;
}

/**
 * Recompute every enabled rule set's score for one record and persist the
 * deltas (no `updatedAt` bump). Best-effort — never throws. Called inline from
 * the create/update record actions and from the scheduler backstop.
 */
export async function recomputeScoresForRecord(
  projectId: string,
  objectSlug: string,
  recordId: string,
): Promise<boolean> {
  try {
    if (!projectId || !objectSlug || !recordId || !ObjectId.isValid(recordId)) {
      return false;
    }
    const ruleSets = await listEnabledRuleSetsForObject(projectId, objectSlug);
    if (ruleSets.length === 0) return false;
    const { db } = await connectToDatabase();
    const rec = (await db
      .collection(RECORDS_COLL)
      .findOne({ _id: new ObjectId(recordId), projectId })) as {
      data?: Record<string, unknown>;
      deletedAt?: unknown;
    } | null;
    if (!rec || rec.deletedAt) return false;
    const set = buildScoreSet(ruleSets, rec.data ?? {});
    if (Object.keys(set).length === 0) return false;
    await db
      .collection(RECORDS_COLL)
      .updateOne({ _id: new ObjectId(recordId), projectId }, { $set: set });
    return true;
  } catch {
    return false; // best-effort
  }
}

/**
 * Recompute scores for up to {@link MAX_RECORDS_PER_SWEEP} live records of an
 * object. Used after a rule set is saved (re-score the existing book) and by
 * the scheduler backstop (catch records changed out-of-band, e.g. imports /
 * the Rust write path). Returns a small report. Best-effort.
 */
export async function recomputeScoresForObject(
  projectId: string,
  objectSlug: string,
  limit = MAX_RECORDS_PER_SWEEP,
): Promise<{ scanned: number; updated: number }> {
  try {
    if (!projectId || !objectSlug) return { scanned: 0, updated: 0 };
    const ruleSets = await listEnabledRuleSetsForObject(projectId, objectSlug);
    if (ruleSets.length === 0) return { scanned: 0, updated: 0 };
    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object: objectSlug, deletedAt: { $in: [null] } })
      .limit(Math.min(limit, MAX_RECORDS_PER_SWEEP))
      .toArray()) as unknown as Array<{
      _id: ObjectId;
      data?: Record<string, unknown>;
    }>;
    let updated = 0;
    for (const rec of recs) {
      const set = buildScoreSet(ruleSets, rec.data ?? {});
      if (Object.keys(set).length === 0) continue;
      await db
        .collection(RECORDS_COLL)
        .updateOne({ _id: rec._id, projectId }, { $set: set });
      updated += 1;
    }
    return { scanned: recs.length, updated };
  } catch {
    return { scanned: 0, updated: 0 };
  }
}

/**
 * Recompute scores for EVERY object that has an enabled rule set in the
 * project. The scheduler backstop entry point. Returns a per-object report.
 */
export async function recomputeAllProjectScores(
  projectId: string,
  perObjectLimit = 500,
): Promise<Array<{ objectSlug: string; scanned: number; updated: number }>> {
  const out: Array<{ objectSlug: string; scanned: number; updated: number }> =
    [];
  try {
    const sets = await listScoringRuleSets(projectId);
    const objects = [
      ...new Set(sets.filter((s) => s.enabled).map((s) => s.objectSlug)),
    ];
    for (const objectSlug of objects) {
      const r = await recomputeScoresForObject(
        projectId,
        objectSlug,
        perObjectLimit,
      );
      out.push({ objectSlug, ...r });
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/** Used by the scheduler to discover every project that has scoring enabled. */
export async function listProjectsWithScoring(db: Db): Promise<string[]> {
  try {
    const ids = (await db
      .collection(RULES_COLL)
      .distinct('projectId', { enabled: { $ne: false } })) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}
