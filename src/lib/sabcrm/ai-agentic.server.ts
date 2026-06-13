import 'server-only';

/**
 * SabCRM — agentic helpers runtime (server-only).
 *
 * Two LLM-backed, RBAC-safe helpers. The deterministic parsing / validation
 * lives in `./ai-agentic` (pure, unit-tested); this module adds the Mongo
 * retrieval, the shared `generateSabcrmText` call, and the `data.*` write-back.
 * Everything here is re-exported from `./ai-agentic` so action callers import
 * only from this file.
 *
 * ## (a) nlBuildList — natural-language list building
 *
 * The user's request + the object's field catalogue go to the LLM, which
 * returns JSON. We validate that JSON leaf-by-leaf against the records engine's
 * OWN operator vocabulary + the object's allowed field keys (`nlToFilterSpec`),
 * then run the resulting typed conditions through the SAME owner-scoped
 * `listRecords` aggregation path the dashboard uses — never a hand-built Mongo
 * query — so tenancy + per-owner ACL are enforced by the engine, not by us.
 *
 * ## (b) qualifyLead — AI lead qualification
 *
 * For one record we gather grounding context (semantic retrieval with keyword
 * fallback — the SAME ACL-hydrated path as crm-rag), ask the LLM for a verdict,
 * normalise it (`parseQualification`), and write the scalar envelope DIRECT to
 * Mongo `sabcrm_records`: `data.aiQualification` (the verdict string the records
 * engine can filter/sort/group with zero change) plus the reserved
 * `data.__aiqual` meta — dotted `$set` only, NO top-level `updatedAt` bump
 * (mirrors `./ai-fields.server.ts` + `./scoring.server.ts`, so a qualification
 * write never resets idle clocks or re-triggers record-change workflows).
 *
 * Honest degradation: no AI provider key → `generateSabcrmText` returns
 * `{ ok:false }` and we surface it; no embeddings → keyword grounding. The LLM
 * is NEVER faked. Saved segments persist the validated spec in a dedicated
 * `sabcrm_segments` config collection (its own `updatedAt` may bump).
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getObject } from './objects.server';
import { listRecords, getRecord } from './records.server';
import { generateSabcrmText } from './ai-llm.server';
import { semanticSearch } from './embeddings.server';
import {
  rankCandidates,
  buildGroundingContext,
  type RagCandidate,
} from './crm-rag';
import {
  nlToFilterSpec,
  parseQualification,
  buildNlListPrompt,
  NL_LIST_SYSTEM,
  QUALIFY_SYSTEM,
  type FilterSpec,
  type QualificationResult,
} from './ai-agentic';
import type { CrmRecordWithLabel, FieldMetadata } from './types';

export {
  nlToFilterSpec,
  validateCondition,
  parseQualification,
  normalizeVerdict,
  clampConfidence,
  buildNlListPrompt,
  QUAL_VERDICTS,
  QUALIFY_SYSTEM,
  NL_LIST_SYSTEM,
  type FilterSpec,
  type FilterSpecResult,
  type QualificationResult,
  type QualVerdict,
} from './ai-agentic';

const RECORDS_COLL = 'sabcrm_records';
const SEGMENTS_COLL = 'sabcrm_segments';

/** Field key the qualification verdict scalar is written to. */
export const QUALIFICATION_FIELD = 'aiQualification';
/** Reserved meta subkey for qualification compute state. */
export const QUALIFICATION_META = '__aiqual';

/** Cap on records returned by an NL list run. */
const NL_LIST_PAGE_SIZE = 50;
/** Query-length guard (mirrors `nlToFilterTw`). */
const NL_QUERY_MAX = 500;
/** Grounding retrieval breadth for qualification. */
const QUAL_TOP_K = 8;

/** Field types excluded from the NL catalogue (not list-filterable). */
const NON_FILTERABLE: ReadonlySet<string> = new Set(['RELATION', 'FILE']);

/* -------------------------------------------------------------------------- */
/* (a) NL list building                                                        */
/* -------------------------------------------------------------------------- */

export interface NlListResult {
  /** The validated spec that was run (shown so the user can review/save it). */
  spec: FilterSpec;
  /** The object slug the spec ran against. */
  object: string;
  /** Matching records (owner-scoped page). */
  records: CrmRecordWithLabel[];
  /** Total matches (may exceed the returned page). */
  total: number;
}

export type NlBuildListOutcome =
  | { ok: true; data: NlListResult }
  | { ok: false; error: string };

/** Field catalogue shape the prompt builder consumes (key/label/type/options). */
function toCatalogue(fields: FieldMetadata[]): Array<{
  key: string;
  label: string;
  type: string;
  options?: Array<{ value: string; label: string }>;
}> {
  return fields
    .filter((f) => !NON_FILTERABLE.has(f.type))
    .map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      options: (f.options ?? []).map((o) => ({ value: o.value, label: o.label })),
    }));
}

/**
 * Natural language → validated spec → matching records, via the owner-scoped
 * `listRecords` path. The caller (action) handles the gate + metering; this
 * function performs the LLM call (so it is the metered unit) and the query.
 *
 * Returns the validated spec ALONGSIDE the records so the UI can show the user
 * exactly what filter ran (transparency + a one-click "save as segment").
 * Never throws.
 */
export async function nlBuildList(
  projectId: string,
  userId: string,
  objectSlug: string,
  nlQuery: string,
): Promise<NlBuildListOutcome> {
  const q = (nlQuery || '').trim();
  if (!q) return { ok: false, error: 'Describe the list you want to build.' };
  if (q.length > NL_QUERY_MAX) {
    return { ok: false, error: `Request too long (max ${NL_QUERY_MAX} characters).` };
  }

  const object = await getObject(projectId, objectSlug);
  if (!object) return { ok: false, error: 'Unknown object.' };

  const catalogue = toCatalogue(object.fields);
  if (catalogue.length === 0) {
    return { ok: false, error: 'This object has no filterable fields.' };
  }

  // LLM (shared ladder; honest "not configured" failure passes through).
  const llm = await generateSabcrmText({
    system: NL_LIST_SYSTEM,
    prompt: buildNlListPrompt(catalogue, q),
  });
  if (!llm.ok) return { ok: false, error: llm.error };

  // Validate, NEVER trust — against the catalogue's allowed field keys.
  const allowed = catalogue.map((f) => f.key);
  const parsed = nlToFilterSpec(llm.text, allowed);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // Run through the SAME owner-scoped aggregation path (tenancy + ACL enforced
  // inside buildFilter via {projectId, userId, object}); we never touch Mongo
  // directly here.
  try {
    const page = await listRecords(projectId, userId, {
      object: objectSlug,
      conditions: parsed.spec.conditions,
      pageSize: NL_LIST_PAGE_SIZE,
    });
    return {
      ok: true,
      data: {
        spec: parsed.spec,
        object: objectSlug,
        records: page.records,
        total: page.total,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not run the list.',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Saved segments                                                              */
/* -------------------------------------------------------------------------- */

export interface SavedSegment {
  id: string;
  projectId: string;
  object: string;
  name: string;
  /** The natural-language request that produced the spec (for re-editing). */
  query: string;
  /** The validated filter spec (re-runnable through `listRecords`). */
  spec: FilterSpec;
  createdAt: string;
  updatedAt: string;
}

interface SegmentDoc {
  _id: ObjectId;
  projectId: string;
  object: string;
  name: string;
  query?: string;
  spec: FilterSpec;
  createdAt: string;
  updatedAt: string;
}

function toSegment(doc: SegmentDoc): SavedSegment {
  return {
    id: doc._id.toHexString(),
    projectId: doc.projectId,
    object: doc.object,
    name: doc.name,
    query: doc.query ?? '',
    spec: doc.spec,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** List saved segments for a project (optionally one object), newest first. */
export async function listSegments(
  projectId: string,
  objectSlug?: string,
): Promise<SavedSegment[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { projectId };
  if (objectSlug) filter.object = objectSlug;
  const docs = (await db
    .collection(SEGMENTS_COLL)
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()) as unknown as SegmentDoc[];
  return docs.map(toSegment);
}

/**
 * Persist a validated spec as a named, re-runnable segment. This is a config
 * domain collection so it MAY carry its own `updatedAt`. The spec is re-validated
 * against the object's current fields before it is stored, so a stale/forged
 * spec can never be saved.
 */
export async function saveSegment(
  projectId: string,
  input: { object: string; name: string; query?: string; spec: FilterSpec },
): Promise<{ ok: true; segment: SavedSegment } | { ok: false; error: string }> {
  const name = (input.name || '').trim();
  const object = (input.object || '').trim();
  if (!object) return { ok: false, error: 'A segment must target an object.' };
  if (!name) return { ok: false, error: 'A segment name is required.' };

  const meta = await getObject(projectId, object);
  if (!meta) return { ok: false, error: 'Unknown object.' };

  // Re-validate the conditions against the live catalogue (defence in depth:
  // the client-supplied spec is never trusted).
  const allowed = toCatalogue(meta.fields).map((f) => f.key);
  const revalidated = nlToFilterSpec(
    JSON.stringify({ conditions: input.spec?.conditions ?? [], unresolved: input.spec?.unresolved }),
    allowed,
  );
  if (!revalidated.ok) return { ok: false, error: revalidated.error };

  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const doc: SegmentDoc = {
    _id: new ObjectId(),
    projectId,
    object,
    name,
    query: (input.query || '').slice(0, NL_QUERY_MAX),
    spec: revalidated.spec,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(SEGMENTS_COLL).insertOne(doc);
  return { ok: true, segment: toSegment(doc) };
}

/** Delete a saved segment by id (tenant-scoped). */
export async function deleteSegment(projectId: string, id: string): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(SEGMENTS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* (b) Lead qualification                                                      */
/* -------------------------------------------------------------------------- */

export type QualifyLeadOutcome =
  | { ok: true; data: QualificationResult & { computedAt: string } }
  | { ok: false; error: string };

/** Compact one record's data into a `key: value` block for the LLM prompt. */
function recordSummary(record: CrmRecordWithLabel): string {
  const lines: string[] = [`Record: ${record.label}`, `Object: ${record.object}`];
  for (const [k, v] of Object.entries(record.data ?? {})) {
    if (k.startsWith('__')) continue;
    if (v === null || v === undefined || v === '') continue;
    let val: string;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      val = String(v);
    } else if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const pick = o.label ?? o.name ?? o.value ?? o.title;
      if (pick === undefined) continue;
      val = String(pick);
    } else continue;
    if (val.length > 160) val = `${val.slice(0, 157)}…`;
    lines.push(`${k}: ${val}`);
  }
  return lines.join('\n');
}

/**
 * Gather grounding context for a lead: semantic retrieval (ACL-hydrated via
 * `semanticSearch`) seeded by the lead's own label, with a keyword fallback.
 * Excludes the lead itself. Best-effort — failures just mean less context.
 */
async function gatherContext(
  projectId: string,
  userId: string,
  record: CrmRecordWithLabel,
): Promise<string> {
  const seed = record.label || record.object;
  let ranked: RagCandidate[] = [];
  try {
    const semantic = await semanticSearch(projectId, userId, seed, { topK: QUAL_TOP_K });
    if (semantic && semantic.length > 0) {
      ranked = semantic;
    } else {
      // Keyword fallback over already-visible records of the same object.
      const page = await listRecords(projectId, userId, {
        object: record.object,
        search: seed,
        pageSize: QUAL_TOP_K,
      });
      ranked = rankCandidates(
        page.records.map((r) => ({ id: r._id, object: r.object, label: r.label, data: r.data ?? {} })),
        seed,
        QUAL_TOP_K,
      );
    }
  } catch {
    /* best-effort */
  }
  // Drop the lead itself from its own context.
  const others = ranked.filter((r) => r.id !== record._id);
  return buildGroundingContext(others, 2500);
}

/** Assemble the grounded qualification user prompt. */
function buildQualifyPrompt(record: CrmRecordWithLabel, context: string): string {
  const ctx = context.trim()
    ? `Related CRM records (context):\n${context}\n\n`
    : 'No related CRM records were found.\n\n';
  return (
    `${ctx}Lead to qualify:\n${recordSummary(record)}\n\n` +
    'Decide whether this lead is worth pursuing and reply with the JSON verdict.'
  );
}

/**
 * Qualify ONE lead/record: LLM verdict grounded on the record + retrieved
 * context, written to `data.aiQualification` + `data.__aiqual` via the scalar
 * envelope (dotted `$set`, NO `updatedAt` bump). The caller (action) owns the
 * gate + metering; this performs the metered LLM call. Never throws.
 */
export async function qualifyLead(
  projectId: string,
  userId: string,
  objectSlug: string,
  recordId: string,
): Promise<QualifyLeadOutcome> {
  if (!objectSlug || !recordId) {
    return { ok: false, error: 'Object and record are required.' };
  }
  if (!ObjectId.isValid(recordId)) return { ok: false, error: 'Invalid record id.' };

  // Owner-scoped read — a user can only qualify a record they can see.
  const record = await getRecord(projectId, userId, recordId);
  if (!record) return { ok: false, error: 'Record not found.' };

  const context = await gatherContext(projectId, userId, record);

  const llm = await generateSabcrmText({
    system: QUALIFY_SYSTEM,
    prompt: buildQualifyPrompt(record, context),
    maxTokens: 400,
  });
  if (!llm.ok) return { ok: false, error: llm.error };

  const result = parseQualification(llm.text);
  const computedAt = new Date().toISOString();

  // Scalar envelope write — dotted $set only, no updatedAt bump. Best-effort:
  // a downed DB must not lose the verdict we already computed (it is returned).
  try {
    const { db } = await connectToDatabase();
    await db.collection(RECORDS_COLL).updateOne(
      { _id: new ObjectId(recordId), projectId },
      {
        $set: {
          [`data.${QUALIFICATION_FIELD}`]: result.verdict,
          [`data.${QUALIFICATION_META}`]: {
            verdict: result.verdict,
            confidence: result.confidence,
            reason: result.reason,
            computedAt,
          },
        },
      },
    );
  } catch {
    /* best-effort — the verdict is still returned to the caller */
  }

  return { ok: true, data: { ...result, computedAt } };
}
