import 'server-only';

/**
 * SabCRM — Next-Best-Action (NBA) work-queue runtime (server-only).
 *
 * Assembles the candidate actions a rep should take right now from the data
 * SabNode already has, ranks them with the pure math in `./nba.ts` (re-exported
 * here so callers only import this file), and returns an ordered work queue.
 *
 * This is a DERIVED, READ-ONLY surface (a forecast-style recomputed view) — it
 * persists nothing, bumps no `updatedAt`, and never mutates a record. Every read
 * is project-scoped, and every source is best-effort: a downed Rust engine or a
 * slow collection degrades the queue (fewer candidate kinds) rather than failing
 * the page (same resilience contract the Forecast page relies on).
 *
 * ## Candidate sources
 *
 *   - **overdue_task** — `sabcrm_activities` TASK rows with `dueAt < now` and
 *     `status != DONE`. The deep-link target is the task's `targetObject` /
 *     `targetRecordId`. Priority is read from the parent record's `data.priority`
 *     when present (best-effort enrichment).
 *   - **hot_lead** — open funnel records whose `data.score`,
 *     `data.winProbability` or `data.probability` clears a "hot" threshold
 *     (these scalars are the AI/scoring envelope written by `./scoring.server.ts`
 *     + `./predictive-scoring.server.ts`). Excludes won/lost stages.
 *   - **rotting_deal** — open funnel records idle in their current stage past the
 *     stage's `rottingDays` threshold (read from the project's pipelines via the
 *     Rust client, best-effort). Idle is measured from the most recent of the
 *     record's `updatedAt` / last activity, capped to never under-report.
 *   - **unreplied_inbound** — records whose most-recent inbound EMAIL activity
 *     (logged by `./email-inbound.ts` with a `"Email from …"` title) has no
 *     later member reply on the timeline.
 *   - **due_cadence_step** — active `sabcrm_sequence_enrollments` whose
 *     `nextRunAt <= now` (the EXISTING cadence engine's scheduling field — we
 *     read it, we never reschedule).
 *
 * All "funnel" objects (the ones carrying stages) are discovered from the
 * project's pipelines + the standard `leads` object, so a custom deal object is
 * picked up automatically once it has a pipeline.
 */

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  rankActions,
  summarizeQueue,
  type NbaAction,
  type RankedNbaAction,
  type NbaQueueSummary,
  type NbaSignals,
} from './nba';

export {
  scoreAction,
  rankActions,
  actionReason,
  urgencyTier,
  summarizeQueue,
  NBA_ACTION_KINDS,
  NBA_BASE_WEIGHT,
  NBA_KIND_LABEL,
  NBA_KIND_ICON,
  type NbaAction,
  type NbaActionKind,
  type NbaSignals,
  type NbaRecordRef,
  type RankedNbaAction,
  type NbaUrgencyTier,
  type NbaQueueSummary,
} from './nba';

const RECORDS_COLL = 'sabcrm_records';
const ACTIVITIES_COLL = 'sabcrm_activities';
const ENROLLMENTS_COLL = 'sabcrm_sequence_enrollments';

/** Standard funnel object that always carries stages. */
const STANDARD_FUNNEL_OBJECT = 'leads';
/** Stage field default (mirrors the Rust pipeline board default). */
const DEFAULT_STAGE_FIELD = 'stage';
/** Amount field default (mirrors the Rust pipeline board default). */
const DEFAULT_AMOUNT_FIELD = 'amount';

/** A lead is "hot" at/above any of these thresholds. */
const HOT_SCORE_MIN = 60;
const HOT_WIN_PROBABILITY_MIN = 60;
const HOT_PROBABILITY_MIN = 70;

/** Fallback rotting threshold (days) when a stage declares none but the deal
 * has clearly stalled — keeps stale deals from disappearing entirely. */
const DEFAULT_ROTTING_DAYS = 21;

/** Per-source candidate caps (bound the work even on huge projects). */
const MAX_TASKS = 500;
const MAX_FUNNEL_RECORDS = 1000;
const MAX_INBOUND_ACTIVITIES = 800;
const MAX_ENROLLMENTS = 500;

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/* -------------------------------------------------------------------------- */
/* Options + result                                                            */
/* -------------------------------------------------------------------------- */

export interface BuildNbaQueueOptions {
  /** Cap on the returned queue length (default 50, max 200). */
  limit?: number;
  /**
   * When set, scope task / cadence candidates to actions owned by / assigned to
   * this member (the signed-in rep). Funnel candidates fall back to the project
   * book because deal ownership lives in many shapes; the queue still deep-links
   * straight to the record. Omit for a project-wide queue (manager view).
   */
  forUserId?: string;
}

export interface NbaQueueResult {
  queue: RankedNbaAction[];
  summary: NbaQueueSummary;
  /** ISO timestamp the queue was computed at (for the "as of" line). */
  computedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Value coercion helpers (the `data` map is free-form)                        */
/* -------------------------------------------------------------------------- */

function asText(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['label', 'name', 'title', 'value']) {
      const c = o[k];
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
  }
  return '';
}

function asNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['amount', 'value', 'amountMicros']) {
      const c = o[k];
      if (typeof c === 'number' && Number.isFinite(c)) {
        return k === 'amountMicros' ? c / 1_000_000 : c;
      }
      if (typeof c === 'string' && c.trim() !== '') {
        const n = Number(c);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return Number.NaN;
}

/** Parse a Date | ISO string | epoch to epoch ms (NaN when absent/unparseable). */
function toMs(v: unknown): number {
  if (!v) return Number.NaN;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : Number.NaN;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** Best-effort display label from a record's conventional label keys. */
function recordLabel(data: Record<string, unknown> | undefined, fallback: string): string {
  const d = data ?? {};
  for (const key of ['name', 'title', 'label', 'fullName', 'subject', 'email', 'company']) {
    const v = asText(d[key]);
    if (v) return v;
  }
  return fallback;
}

/** Whole non-negative days between two epoch-ms instants (0 when not after). */
function daysBetween(fromMs: number, toMsVal: number): number {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMsVal)) return 0;
  return Math.max(0, Math.floor((toMsVal - fromMs) / MS_PER_DAY));
}

/* -------------------------------------------------------------------------- */
/* Pipeline metadata (best-effort, via the Rust client)                        */
/* -------------------------------------------------------------------------- */

interface FunnelStageMeta {
  /** Stage id → rotting threshold in days (undefined = never rots). */
  rottingDays?: number;
  /** Stage classification. */
  kind: 'open' | 'won' | 'lost';
  /** Stage win probability percent, when declared. */
  probability?: number;
}

interface FunnelMeta {
  objectSlug: string;
  stageField: string;
  amountField: string;
  /** Stage id → metadata. */
  stages: Map<string, FunnelStageMeta>;
}

/**
 * Discover the project's funnel objects + per-stage rotting/kind metadata via
 * the Rust pipelines client. Best-effort: when the engine is unreachable we
 * still return the standard `leads` funnel (with no stage thresholds), so the
 * hot-lead source keeps working and rotting falls back to the default window.
 */
async function loadFunnels(projectId: string): Promise<Map<string, FunnelMeta>> {
  const funnels = new Map<string, FunnelMeta>();

  // Always include the standard leads funnel as a floor.
  funnels.set(STANDARD_FUNNEL_OBJECT, {
    objectSlug: STANDARD_FUNNEL_OBJECT,
    stageField: DEFAULT_STAGE_FIELD,
    amountField: DEFAULT_AMOUNT_FIELD,
    stages: new Map(),
  });

  try {
    const { sabcrmPipelinesApi } = await import('@/lib/rust-client/sabcrm-pipelines');
    const pipelines = await sabcrmPipelinesApi.list(projectId);
    for (const p of pipelines ?? []) {
      const objectSlug = p.object || STANDARD_FUNNEL_OBJECT;
      const existing = funnels.get(objectSlug);
      const stages: Map<string, FunnelStageMeta> = existing?.stages ?? new Map();
      for (const s of p.stages ?? []) {
        const id = String(s.id);
        if (!id) continue;
        const meta: FunnelStageMeta = {
          kind: s.kind === 'won' || s.kind === 'lost' ? s.kind : 'open',
        };
        if (typeof s.rottingDays === 'number' && Number.isFinite(s.rottingDays)) {
          meta.rottingDays = s.rottingDays;
        }
        if (typeof s.probability === 'number' && Number.isFinite(s.probability)) {
          meta.probability = s.probability;
        }
        stages.set(id, meta);
      }
      // The pipeline document does not carry stage/amount field overrides — the
      // Rust board defaults them to `stage` / `amount`, so we mirror that.
      funnels.set(objectSlug, {
        objectSlug,
        stageField: existing?.stageField || DEFAULT_STAGE_FIELD,
        amountField: existing?.amountField || DEFAULT_AMOUNT_FIELD,
        stages,
      });
    }
  } catch {
    /* engine down — keep the standard-funnel floor */
  }
  return funnels;
}

/**
 * Classify a stage value as open/won/lost. Prefers the pipeline metadata; falls
 * back to label heuristics so legacy stages (and the down-engine case) still
 * resolve terminal stages correctly.
 */
function stageClass(meta: FunnelMeta, stageValue: string): 'open' | 'won' | 'lost' {
  const declared = meta.stages.get(stageValue);
  if (declared) return declared.kind;
  const v = stageValue.toUpperCase();
  if (/WON|CLOSED.?WON|CUSTOMER/.test(v)) return 'won';
  if (/LOST|CLOSED.?LOST|DISQUALIF|CANCEL/.test(v)) return 'lost';
  return 'open';
}

/* -------------------------------------------------------------------------- */
/* Candidate builders                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Overdue + due-today TASK activities (status != DONE, dueAt <= now). Optionally
 * scoped to a member (author OR assignee). Priority is enriched from the parent
 * record's `data.priority` in a single batched read.
 */
async function buildOverdueTasks(
  db: Db,
  projectId: string,
  nowMs: number,
  forUserId: string | undefined,
): Promise<NbaAction[]> {
  const filter: Record<string, unknown> = {
    projectId,
    type: 'TASK',
    status: { $ne: 'DONE' },
    dueAt: { $lte: new Date(nowMs) },
  };
  if (forUserId) {
    filter.$or = [{ assigneeId: forUserId }, { authorId: forUserId }];
  }

  const docs = (await db
    .collection(ACTIVITIES_COLL)
    .find(filter)
    .sort({ dueAt: 1 })
    .limit(MAX_TASKS)
    .toArray()) as unknown as Array<{
    _id: ObjectId | string;
    title?: string;
    targetObject?: string;
    targetRecordId?: string;
    dueAt?: Date | string;
  }>;
  if (docs.length === 0) return [];

  // Batch-load the parent records (for label + priority) in one pass per object.
  const byObject = new Map<string, Set<string>>();
  for (const d of docs) {
    const obj = String(d.targetObject ?? '');
    const rid = String(d.targetRecordId ?? '');
    if (!obj || !rid || !ObjectId.isValid(rid)) continue;
    const set = byObject.get(obj) ?? new Set<string>();
    set.add(rid);
    byObject.set(obj, set);
  }
  const recordIndex = await loadRecordIndex(db, projectId, byObject);

  const out: NbaAction[] = [];
  for (const d of docs) {
    const obj = String(d.targetObject ?? '');
    const rid = String(d.targetRecordId ?? '');
    if (!obj || !rid) continue;
    const dueMs = toMs(d.dueAt);
    const rec = recordIndex.get(`${obj}:${rid}`);
    const priorityRaw = asText(rec?.data?.priority).toUpperCase();
    const taskPriority =
      priorityRaw === 'LOW' || priorityRaw === 'MEDIUM' || priorityRaw === 'HIGH' || priorityRaw === 'URGENT'
        ? (priorityRaw as NbaSignals['taskPriority'])
        : undefined;
    const signals: NbaSignals = { overdueDays: daysBetween(dueMs, nowMs) };
    if (taskPriority) signals.taskPriority = taskPriority;
    out.push({
      id: `overdue_task:${idHex(d._id)}`,
      kind: 'overdue_task',
      record: {
        object: obj,
        recordId: rid,
        label: rec ? recordLabel(rec.data, asText(d.title) || 'Task') : asText(d.title) || 'Task',
      },
      signals,
      dueAt: Number.isFinite(dueMs) ? new Date(dueMs).toISOString() : undefined,
      detail: asText(d.title) || undefined,
    });
  }
  return out;
}

/** A loaded record (id-indexed) used to enrich task / inbound candidates. */
interface LoadedRecord {
  data?: Record<string, unknown>;
  updatedAt?: string | Date;
}

/** Batch-load records by object → id set, returned keyed by `object:id`. */
async function loadRecordIndex(
  db: Db,
  projectId: string,
  byObject: Map<string, Set<string>>,
): Promise<Map<string, LoadedRecord>> {
  const index = new Map<string, LoadedRecord>();
  for (const [object, idSet] of byObject) {
    const oids = [...idSet].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (oids.length === 0) continue;
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object, _id: { $in: oids } })
      .limit(oids.length)
      .toArray()) as unknown as Array<{
      _id: ObjectId;
      data?: Record<string, unknown>;
      updatedAt?: string | Date;
    }>;
    for (const r of recs) {
      index.set(`${object}:${idHex(r._id)}`, { data: r.data, updatedAt: r.updatedAt });
    }
  }
  return index;
}

/**
 * Hot leads + rotting deals from one funnel object. Both walk the same live
 * record scan so the funnel is read once. A record may yield BOTH a hot-lead and
 * a rotting-deal action (different kinds → both survive de-dupe).
 */
async function buildFunnelActions(
  db: Db,
  projectId: string,
  nowMs: number,
  funnel: FunnelMeta,
): Promise<NbaAction[]> {
  const recs = (await db
    .collection(RECORDS_COLL)
    .find({ projectId, object: funnel.objectSlug, deletedAt: { $in: [null] } })
    .limit(MAX_FUNNEL_RECORDS)
    .toArray()) as unknown as Array<{
    _id: ObjectId;
    data?: Record<string, unknown>;
    updatedAt?: string | Date;
    createdAt?: string | Date;
  }>;
  if (recs.length === 0) return [];

  const out: NbaAction[] = [];
  for (const r of recs) {
    const data = r.data ?? {};
    const stageValue = asText(data[funnel.stageField]);
    const klass = stageValue ? stageClass(funnel, stageValue) : 'open';
    if (klass !== 'open') continue; // won/lost deals need no next action

    const rid = idHex(r._id);
    const label = recordLabel(data, 'Untitled');
    const amount = asNumber(data[funnel.amountField]);

    // --- hot lead ---------------------------------------------------------
    const score = asNumber(data.score);
    const winProbability = asNumber(data.winProbability);
    const probability = asNumber(data.probability);
    const isHot =
      (Number.isFinite(score) && score >= HOT_SCORE_MIN) ||
      (Number.isFinite(winProbability) && winProbability >= HOT_WIN_PROBABILITY_MIN) ||
      (Number.isFinite(probability) && probability >= HOT_PROBABILITY_MIN);
    if (isHot) {
      const signals: NbaSignals = {};
      if (Number.isFinite(score)) signals.leadScore = score;
      // Prefer the predicted win-prob; fall back to the manual probability field.
      if (Number.isFinite(winProbability)) signals.winProbability = winProbability;
      else if (Number.isFinite(probability)) signals.winProbability = probability;
      if (Number.isFinite(amount) && amount > 0) signals.amount = amount;
      out.push({
        id: `hot_lead:${funnel.objectSlug}:${rid}`,
        kind: 'hot_lead',
        record: { object: funnel.objectSlug, recordId: rid, label },
        signals,
      });
    }

    // --- rotting deal -----------------------------------------------------
    // Idle measured from the last meaningful touch. `updatedAt` reflects real
    // edits (score / rank / AI writes deliberately do NOT bump it — see the
    // scalar-envelope rules), so it is a sound idle clock.
    const lastTouchMs = toMs(r.updatedAt) || toMs(r.createdAt);
    const idleDays = daysBetween(lastTouchMs, nowMs);
    const declared = stageValue ? funnel.stages.get(stageValue) : undefined;
    const threshold =
      typeof declared?.rottingDays === 'number' ? declared.rottingDays : DEFAULT_ROTTING_DAYS;
    if (threshold > 0 && idleDays > threshold) {
      const signals: NbaSignals = {
        idleDays: idleDays - threshold,
        rottingThresholdDays: threshold,
      };
      if (Number.isFinite(amount) && amount > 0) signals.amount = amount;
      out.push({
        id: `rotting_deal:${funnel.objectSlug}:${rid}`,
        kind: 'rotting_deal',
        record: { object: funnel.objectSlug, recordId: rid, label },
        signals,
        dueAt: Number.isFinite(lastTouchMs) ? new Date(lastTouchMs).toISOString() : undefined,
        detail: stageValue ? `Stage: ${stageValue}` : undefined,
      });
    }
  }
  return out;
}

/**
 * Records with an unanswered inbound message. We scan inbound EMAIL activities
 * (logged by `email-inbound.ts` with a `"Email from …"` title) newest-first,
 * keep the most recent inbound per record, then drop any record that has a later
 * member-authored activity (a reply). Whatever inbound remains is "waiting".
 */
async function buildUnrepliedInbound(
  db: Db,
  projectId: string,
  nowMs: number,
): Promise<NbaAction[]> {
  // Pull recent EMAIL/CALL activities; we classify inbound by the email-inbound
  // title convention. Ordering newest-first lets us keep the latest per record.
  const docs = (await db
    .collection(ACTIVITIES_COLL)
    .find({ projectId, type: { $in: ['EMAIL', 'CALL'] } })
    .sort({ createdAt: -1 })
    .limit(MAX_INBOUND_ACTIVITIES)
    .toArray()) as unknown as Array<{
    _id: ObjectId | string;
    type?: string;
    title?: string;
    targetObject?: string;
    targetRecordId?: string;
    createdAt?: Date | string;
  }>;
  if (docs.length === 0) return [];

  // Per record: the most recent inbound time, and the most recent ANY time.
  interface RecState {
    object: string;
    recordId: string;
    inboundMs: number;
    latestAnyMs: number;
    title: string;
  }
  const byRecord = new Map<string, RecState>();
  for (const d of docs) {
    const obj = String(d.targetObject ?? '');
    const rid = String(d.targetRecordId ?? '');
    if (!obj || !rid) continue;
    const key = `${obj}:${rid}`;
    const ms = toMs(d.createdAt);
    if (!Number.isFinite(ms)) continue;
    const title = asText(d.title);
    // Inbound heuristic: the email-inbound router logs "Email from <sender>: …".
    const inbound = /^email from /i.test(title);
    const state = byRecord.get(key) ?? {
      object: obj,
      recordId: rid,
      inboundMs: 0,
      latestAnyMs: 0,
      title: '',
    };
    if (ms > state.latestAnyMs) state.latestAnyMs = ms;
    if (inbound && ms > state.inboundMs) {
      state.inboundMs = ms;
      state.title = title;
    }
    byRecord.set(key, state);
  }

  const out: NbaAction[] = [];
  for (const state of byRecord.values()) {
    if (state.inboundMs <= 0) continue; // no inbound at all
    // Replied if the latest activity of ANY kind is newer than the inbound.
    if (state.latestAnyMs > state.inboundMs) continue;
    const waitingHours = Math.max(0, Math.floor((nowMs - state.inboundMs) / MS_PER_HOUR));
    out.push({
      id: `unreplied_inbound:${state.object}:${state.recordId}`,
      kind: 'unreplied_inbound',
      record: {
        object: state.object,
        recordId: state.recordId,
        label: state.title.replace(/:.*$/, '').trim() || 'Inbound message',
      },
      signals: { waitingHours },
      dueAt: new Date(state.inboundMs).toISOString(),
      detail: state.title || undefined,
    });
  }
  return out;
}

/**
 * Due cadence steps: active enrollments whose `nextRunAt <= now`. We READ the
 * EXISTING cadence engine's scheduling field — we never write it. The deep-link
 * targets the enrolled record; the label is enriched from the record in a
 * batched read.
 */
async function buildDueCadenceSteps(
  db: Db,
  projectId: string,
  nowMs: number,
): Promise<NbaAction[]> {
  const nowIso = new Date(nowMs).toISOString();
  const docs = (await db
    .collection(ENROLLMENTS_COLL)
    .find({
      projectId,
      status: 'active',
      nextRunAt: { $ne: null, $lte: nowIso },
    })
    .sort({ nextRunAt: 1 })
    .limit(MAX_ENROLLMENTS)
    .toArray()) as unknown as Array<{
    _id: ObjectId | string;
    objectSlug?: string;
    recordId?: string;
    currentStepIndex?: number;
    nextRunAt?: string | Date;
  }>;
  if (docs.length === 0) return [];

  const byObject = new Map<string, Set<string>>();
  for (const d of docs) {
    const obj = String(d.objectSlug ?? '');
    const rid = String(d.recordId ?? '');
    if (!obj || !rid || !ObjectId.isValid(rid)) continue;
    const set = byObject.get(obj) ?? new Set<string>();
    set.add(rid);
    byObject.set(obj, set);
  }
  const recordIndex = await loadRecordIndex(db, projectId, byObject);

  const out: NbaAction[] = [];
  for (const d of docs) {
    const obj = String(d.objectSlug ?? '');
    const rid = String(d.recordId ?? '');
    if (!obj || !rid) continue;
    const dueMs = toMs(d.nextRunAt);
    const rec = recordIndex.get(`${obj}:${rid}`);
    const stepNumber =
      typeof d.currentStepIndex === 'number' && Number.isFinite(d.currentStepIndex)
        ? d.currentStepIndex + 1
        : undefined;
    const signals: NbaSignals = {
      stepOverdueDays: daysBetween(dueMs, nowMs),
    };
    if (stepNumber) signals.stepNumber = stepNumber;
    out.push({
      id: `due_cadence_step:${idHex(d._id)}`,
      kind: 'due_cadence_step',
      record: {
        object: obj,
        recordId: rid,
        label: rec ? recordLabel(rec.data, 'Enrolled record') : 'Enrolled record',
      },
      signals,
      dueAt: Number.isFinite(dueMs) ? new Date(dueMs).toISOString() : undefined,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Build the ranked Next-Best-Action work queue for a project.
 *
 * Read-only + best-effort: each candidate source is awaited independently and a
 * failing source contributes zero actions rather than throwing. The pure
 * `rankActions` then scores, de-duplicates (one action per record+kind) and
 * orders the union into a single queue.
 */
export async function buildNbaQueue(
  projectId: string,
  userId: string,
  options: BuildNbaQueueOptions = {},
): Promise<NbaQueueResult> {
  const computedAt = new Date().toISOString();
  const nowMs = Date.parse(computedAt);
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  const empty: NbaQueueResult = {
    queue: [],
    summary: summarizeQueue([]),
    computedAt,
  };
  if (!projectId) return empty;

  try {
    const { db } = await connectToDatabase();
    const funnels = await loadFunnels(projectId);

    // Each source is independently best-effort.
    const sources: Array<Promise<NbaAction[]>> = [
      buildOverdueTasks(db, projectId, nowMs, options.forUserId).catch(() => []),
      buildUnrepliedInbound(db, projectId, nowMs).catch(() => []),
      buildDueCadenceSteps(db, projectId, nowMs).catch(() => []),
    ];
    for (const funnel of funnels.values()) {
      sources.push(buildFunnelActions(db, projectId, nowMs, funnel).catch(() => []));
    }

    const candidateGroups = await Promise.all(sources);
    const candidates = candidateGroups.flat();
    const queue = rankActions(candidates, { limit });
    return { queue, summary: summarizeQueue(queue), computedAt };
  } catch {
    return empty;
  }
}
