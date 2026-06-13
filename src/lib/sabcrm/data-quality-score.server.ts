import 'server-only';

/**
 * SabCRM — data-quality scoring runtime (server-only).
 *
 * Grades the records of an object on completeness / validity / freshness (the
 * pure math in `./data-quality-score.ts`, re-exported here so callers import
 * only from this file) and rolls them up into a per-object health summary for
 * the `/sabcrm/data-quality` dashboard.
 *
 * It reads its inputs from where each canonically lives — exactly the
 * two-store discipline of `./scoring.server.ts` + `./data-quality.server.ts`:
 *
 *   - **field metadata** through the Rust path (`sabcrmObjectsApi`) — object /
 *     field METADATA must never be read straight from Mongo;
 *   - **validation rules** from the native `sabcrm_validation_rules` config
 *     collection (the same place `./data-quality.server.ts` persists them);
 *   - **records** straight from `sabcrm_records` (the shared collection both
 *     stores serve), capped at {@link MAX_HEALTH_SCAN}.
 *
 * ## Write-back envelope (mirrors `./ai-fields.server.ts` + `./scoring.server.ts`)
 *
 * For each scored record it best-effort `$set`s the reserved meta subkey
 * `data.__dq` — `{ completeness, validity, freshness, overall, issues,
 * computedAt }` — as a dotted path on `sabcrm_records`. It deliberately does
 * NOT bump the record's top-level `updatedAt`, so a health write never resets
 * the deal-rotting / `time.elapsed` idle clocks or re-triggers record-change
 * workflows (same rationale as the AI-field, scoring + rotting-tag designs).
 * `data.__dq` is a SYSTEM namespace — only ever replace the whole subkey, never
 * write a sibling scalar that would collide with a user field.
 *
 * Everything is best-effort: a downed DB / engine must never throw — the scan
 * degrades to an empty/partial summary and the per-record write is skipped.
 */

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import type { FieldMetadata } from './types';
import { sabcrmRecordLabel, type LabelObjectLike } from './record-label';
import { listEnabledValidationSetsForObject } from './data-quality.server';
import type { ValidationRule } from './validation';
import {
  scoreRecord,
  summarizeObjectHealth,
  type ObjectHealthSummary,
  type ScoredRecordRow,
  type DataQualityScore,
} from './data-quality-score';

export {
  scoreRecord,
  scoreCompleteness,
  scoreValidity,
  scoreFreshness,
  summarizeObjectHealth,
  completenessFields,
  isValueEmpty,
  issueSeverity,
  DEFAULT_HEALTH_WEIGHTS,
  FRESHNESS_HALF_LIFE_DAYS,
  FRESHNESS_STALE_DAYS,
  type DataQualityScore,
  type DataQualityIssue,
  type DataQualityIssueKind,
  type ObjectHealthSummary,
  type WorstRecord,
  type ScoredRecordRow,
  type ScorableRecord,
} from './data-quality-score';

const RECORDS_COLL = 'sabcrm_records';

/** Cap on records pulled into one object health scan (mirrors the AI/score sweeps). */
const MAX_HEALTH_SCAN = 1000;

/** How many worst records the summary surfaces for the table. */
const WORST_LIMIT = 25;

/** Raw `sabcrm_records` doc fields the scan reads. */
interface HealthRecordDoc {
  _id: ObjectId | string;
  object?: string;
  data?: Record<string, unknown>;
  updatedAt?: string | null;
  deletedAt?: unknown;
}

/** Hex-stringify a Mongo `_id` regardless of stored type. */
function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** Flatten every enabled validation rule set for an object into one rule list. */
async function loadValidationRules(
  projectId: string,
  objectSlug: string,
): Promise<ValidationRule[]> {
  try {
    const sets = await listEnabledValidationSetsForObject(projectId, objectSlug);
    return sets.flatMap((s) => s.rules ?? []);
  } catch {
    return [];
  }
}

/** Build the `LabelObjectLike` shape the canonical label helper needs. */
function toLabelObject(
  objectSlug: string,
  fields: FieldMetadata[],
  labelSingular?: string,
): LabelObjectLike {
  return {
    slug: objectSlug,
    labelSingular,
    fields: fields.map((f) => ({ key: f.key, type: f.type, isLabel: f.isLabel })),
  };
}

/**
 * Best-effort `$set` of the per-record `data.__dq` meta (no `updatedAt` bump).
 * Stores only the breakdown + the four issue messages the table shows (keeping
 * the meta small). Never throws.
 */
async function writeDqMeta(
  db: Db,
  projectId: string,
  recordId: string,
  score: DataQualityScore,
): Promise<void> {
  try {
    if (!ObjectId.isValid(recordId)) return;
    const meta = {
      completeness: score.completeness,
      validity: score.validity,
      freshness: score.freshness,
      overall: score.overall,
      issues: score.issues.slice(0, 4).map((i) => ({
        kind: i.kind,
        ref: i.ref,
        message: i.message,
      })),
      computedAt: new Date().toISOString(),
    };
    await db
      .collection(RECORDS_COLL)
      .updateOne(
        { _id: new ObjectId(recordId), projectId },
        { $set: { 'data.__dq': meta } },
      );
  } catch {
    /* best-effort — the summary is still returned */
  }
}

/* -------------------------------------------------------------------------- */
/* Object scan                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Score up to {@link MAX_HEALTH_SCAN} live records of one object and roll them
 * up into an {@link ObjectHealthSummary}. Reads field defs via the Rust path,
 * validation rules from the native config, records from `sabcrm_records`; then
 * best-effort persists each record's `data.__dq` breakdown via the envelope.
 *
 * Best-effort end-to-end: any failure yields an empty summary for the object
 * rather than throwing (so the dashboard renders the other objects' cards and
 * the scheduler backstop never fails a tick).
 *
 * @param writeBack When false, computes the summary without persisting
 *   `data.__dq` (read-only dashboard path). Defaults to true (the sweep path).
 */
export async function scanObjectHealth(
  projectId: string,
  object: string,
  limit = MAX_HEALTH_SCAN,
  writeBack = true,
): Promise<ObjectHealthSummary> {
  const empty: ObjectHealthSummary = {
    objectSlug: object,
    count: 0,
    avgCompleteness: 0,
    avgValidity: 0,
    avgFreshness: 0,
    avgOverall: 0,
    worst: [],
  };
  try {
    if (!projectId || !object) return empty;

    // 1. Field metadata via the Rust path (two-store rule).
    let fields: FieldMetadata[] = [];
    let labelSingular: string | undefined;
    try {
      const meta = await sabcrmObjectsApi.get(object, projectId);
      fields = (meta.fields ?? []) as FieldMetadata[];
      labelSingular = meta.labelSingular;
    } catch {
      fields = [];
    }

    // 2. Validation rules from the native config collection.
    const rules = await loadValidationRules(projectId, object);

    // 3. Records from the shared collection.
    const { db } = await connectToDatabase();
    const docs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object, deletedAt: { $in: [null] } })
      .limit(Math.min(Math.max(1, limit), MAX_HEALTH_SCAN))
      .toArray()) as unknown as HealthRecordDoc[];

    if (docs.length === 0) return empty;

    const labelObject = toLabelObject(object, fields, labelSingular);
    const now = Date.now();
    const rows: ScoredRecordRow[] = [];

    for (const doc of docs) {
      const id = idHex(doc._id);
      const score = scoreRecord(
        { data: doc.data ?? {}, updatedAt: doc.updatedAt ?? null },
        fields,
        rules,
        now,
      );
      const label = sabcrmRecordLabel(labelObject, { id, data: doc.data ?? {} });
      rows.push({ id, label, score });
      if (writeBack) {
        // Sequential keeps the write pressure low; the scan is already capped.
        await writeDqMeta(db, projectId, id, score);
      }
    }

    return summarizeObjectHealth(object, rows, WORST_LIMIT);
  } catch {
    return empty;
  }
}

/**
 * Scan the health of EVERY non-system object in a project, newest-meaningful
 * first by record count is NOT guaranteed (object order follows the engine).
 * Best-effort; objects that error degrade to empty cards. Used by the dashboard
 * action and the scheduler backstop.
 *
 * @param writeBack Forwarded to {@link scanObjectHealth}.
 */
export async function scanProjectHealth(
  projectId: string,
  perObjectLimit = MAX_HEALTH_SCAN,
  writeBack = true,
): Promise<ObjectHealthSummary[]> {
  const out: ObjectHealthSummary[] = [];
  try {
    if (!projectId) return out;
    const objects = await sabcrmObjectsApi.list(projectId);
    for (const obj of objects) {
      // Skip internal/system objects (e.g. workspaceMembers) — they aren't
      // user-curated data the dashboard should grade.
      if ((obj as { isSystem?: boolean }).isSystem) continue;
      const summary = await scanObjectHealth(
        projectId,
        obj.slug,
        perObjectLimit,
        writeBack,
      );
      out.push(summary);
    }
  } catch {
    /* best-effort — return whatever scanned cleanly */
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Scheduler backstop discovery                                                */
/* -------------------------------------------------------------------------- */

/**
 * Every project that has at least one enabled validation rule set. The data-
 * health backstop only re-grades these (a project with no validation rules has
 * nothing the backstop needs to keep fresh beyond completeness/freshness, which
 * the dashboard recomputes on demand). Mirrors `listProjectsWithScoring`.
 */
export async function listProjectsWithDataHealth(db: Db): Promise<string[]> {
  try {
    const ids = (await db
      .collection('sabcrm_validation_rules')
      .distinct('projectId', { enabled: { $ne: false } })) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Recompute + persist `data.__dq` for every non-system object in a project. The
 * scheduler backstop entry point — keeps the stored per-record health meta in
 * sync with records changed out-of-band (CSV import / public API / Rust write
 * path). Returns a per-object `{ objectSlug, scanned, updated }` report shaped
 * like the scoring/formula sweeps so the scheduler can fold it into its report.
 */
export async function recomputeAllProjectHealth(
  projectId: string,
  perObjectLimit = 500,
): Promise<Array<{ objectSlug: string; scanned: number; updated: number }>> {
  const out: Array<{ objectSlug: string; scanned: number; updated: number }> =
    [];
  try {
    const summaries = await scanProjectHealth(projectId, perObjectLimit, true);
    for (const s of summaries) {
      // `scanObjectHealth` writes one `data.__dq` per scanned record, so
      // scanned === updated for the report (both are the graded count).
      out.push({ objectSlug: s.objectSlug, scanned: s.count, updated: s.count });
    }
  } catch {
    /* best-effort */
  }
  return out;
}
