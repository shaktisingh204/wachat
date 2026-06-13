import 'server-only';

/**
 * SabCRM — service-case (ticketing) runtime (server-only).
 *
 * Provides:
 *   - `ensureCaseObject(projectId)` — idempotently provisions the `cases`
 *     custom object (subject, status, priority, contact relation, slaStatus,
 *     firstResponseAt, resolvedAt, csatScore, …) via the Rust object path
 *     (two-store gotcha: METADATA goes through the engine).
 *   - per-project SLA policy CRUD in `sabcrm_case_policies` (the native-Mongo
 *     config pattern of `./scoring.server.ts` / `./sequences.server.ts`).
 *   - `recomputeSlaForCase(projectId, caseId)` — writes `data.slaStatus` +
 *     `data.__sla` via the AI-fields scalar envelope (dotted `$set`, NO
 *     `updatedAt` bump), mirroring `recomputeScoresForRecord`.
 *   - `scanSlaBreaches(projectId)` — the cron sweep across a project's cases.
 *   - CSAT survey plumbing: `issueCsatToken` (mint a public survey link for a
 *     case) and `recordCsat(token, score, comment)` (the ungated public submit,
 *     validated + IP-deduped, mirroring the project-rating action).
 *
 * Everything record-side is best-effort: a downed DB / Rust engine must never
 * break the record mutation that triggered an SLA recompute. Config CRUD MAY
 * bump its OWN collection's `updatedAt`.
 */

import { createHash, randomBytes } from 'crypto';
import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { createObjectTw, updateObjectTw } from '@/app/actions/sabcrm-objects.actions';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import { createActivity } from '@/lib/sabcrm/activities.server';
import type { ActionResult, ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import {
  computeSla,
  asCsatScore,
  aggregateCsat,
  DEFAULT_SLA_POLICY,
  CASE_PRIORITIES,
  CASE_STATUSES,
  type SlaPolicy,
  type SlaStatus,
  type CaseLike,
  type CsatAggregate,
} from './cases';

export {
  computeSla,
  slaStatus,
  slaTarget,
  firstResponseDue,
  resolutionDue,
  aggregateCsat,
  asCsatScore,
  DEFAULT_SLA_POLICY,
  CASE_PRIORITIES,
  CASE_STATUSES,
  type SlaPolicy,
  type SlaStatus,
  type SlaTarget,
  type SlaComputation,
  type CaseLike,
  type CsatAggregate,
} from './cases';

const RECORDS_COLL = 'sabcrm_records';
const POLICY_COLL = 'sabcrm_case_policies';
const CSAT_COLL = 'sabcrm_case_csat';

/** Cap on cases scanned per project in one SLA sweep. */
const MAX_CASES_PER_SWEEP = 2000;

/** The object slug — used everywhere case records are read/written. */
export const CASES_SLUG = 'cases' as const;

/** Stable field keys, centralised so the page + object def never drift. */
export const CASE_FIELDS = {
  subject: 'subject',
  status: 'status',
  priority: 'priority',
  contactId: 'contactId',
  accountId: 'accountId',
  description: 'description',
  assignee: 'assignee',
  firstResponseAt: 'firstResponseAt',
  resolvedAt: 'resolvedAt',
  slaStatus: 'slaStatus',
  csatScore: 'csatScore',
} as const;

/* -------------------------------------------------------------------------- */
/* Object definition                                                           */
/* -------------------------------------------------------------------------- */

/** Color tokens for the SLA SELECT swatches (kept in sync with the badge UI). */
const STATUS_OPTIONS: FieldMetadata['options'] = [
  { value: 'NEW', label: 'New', color: 'blue' },
  { value: 'OPEN', label: 'Open', color: 'yellow' },
  { value: 'PENDING', label: 'Pending', color: 'orange' },
  { value: 'RESOLVED', label: 'Resolved', color: 'green' },
  { value: 'CLOSED', label: 'Closed', color: 'gray' },
];

const PRIORITY_OPTIONS: FieldMetadata['options'] = [
  { value: 'LOW', label: 'Low', color: 'gray' },
  { value: 'MEDIUM', label: 'Medium', color: 'yellow' },
  { value: 'HIGH', label: 'High', color: 'orange' },
  { value: 'URGENT', label: 'Urgent', color: 'red' },
];

const SLA_OPTIONS: FieldMetadata['options'] = [
  { value: 'ok', label: 'On track', color: 'green' },
  { value: 'warning', label: 'At risk', color: 'orange' },
  { value: 'breached', label: 'Breached', color: 'red' },
];

/** The full `cases` object definition handed to `createObjectTw`. */
export const CASES_OBJECT: ObjectMetadata = {
  slug: CASES_SLUG,
  labelSingular: 'Case',
  labelPlural: 'Cases',
  icon: 'life-buoy',
  description: 'Support cases / tickets with SLA timers and CSAT.',
  standard: false,
  views: ['table', 'board'],
  board: { groupByField: CASE_FIELDS.status },
  fields: [
    {
      key: CASE_FIELDS.subject,
      label: 'Subject',
      type: 'TEXT',
      icon: 'life-buoy',
      required: true,
      inTable: true,
      isLabel: true,
      description: 'Short summary of the case.',
    },
    {
      key: CASE_FIELDS.status,
      label: 'Status',
      type: 'SELECT',
      icon: 'activity',
      required: true,
      inTable: true,
      description: 'Where the case is in its lifecycle.',
      options: STATUS_OPTIONS,
      defaultValue: 'NEW',
    },
    {
      key: CASE_FIELDS.priority,
      label: 'Priority',
      type: 'SELECT',
      icon: 'flag',
      required: true,
      inTable: true,
      description: 'Drives the SLA budget for this case.',
      options: PRIORITY_OPTIONS,
      defaultValue: 'MEDIUM',
    },
    {
      key: CASE_FIELDS.contactId,
      label: 'Contact',
      type: 'RELATION',
      icon: 'user',
      inTable: true,
      description: 'The person who raised the case.',
      relation: { targetObject: 'people', kind: 'MANY_TO_ONE', labelField: 'name' },
    },
    {
      key: CASE_FIELDS.accountId,
      label: 'Account',
      type: 'RELATION',
      icon: 'building-2',
      inTable: false,
      description: 'The company this case belongs to.',
      relation: { targetObject: 'companies', kind: 'MANY_TO_ONE', labelField: 'name' },
    },
    {
      key: CASE_FIELDS.assignee,
      label: 'Assignee',
      type: 'TEXT',
      icon: 'user-check',
      inTable: true,
      description: 'Agent responsible for the case.',
    },
    {
      key: CASE_FIELDS.firstResponseAt,
      label: 'First response at',
      type: 'DATE_TIME',
      icon: 'reply',
      inTable: false,
      description: 'When an agent first responded (stops the first-response SLA).',
    },
    {
      key: CASE_FIELDS.resolvedAt,
      label: 'Resolved at',
      type: 'DATE_TIME',
      icon: 'check-circle',
      inTable: false,
      description: 'When the case was resolved (stops the resolution SLA).',
    },
    {
      key: CASE_FIELDS.slaStatus,
      label: 'SLA',
      type: 'SELECT',
      icon: 'timer',
      inTable: true,
      description: 'Computed SLA health — On track / At risk / Breached.',
      options: SLA_OPTIONS,
    },
    {
      key: CASE_FIELDS.csatScore,
      label: 'CSAT',
      type: 'RATING',
      icon: 'smile-plus',
      inTable: true,
      description: 'Customer satisfaction (1–5) from the post-resolution survey.',
    },
    {
      key: CASE_FIELDS.description,
      label: 'Description',
      type: 'TEXT',
      icon: 'align-left',
      inTable: false,
      description: 'Full detail of the issue.',
    },
  ],
};

/**
 * Idempotently ensure the `cases` object exists for the active project. Mirrors
 * `ensureProjectsObjectTw`: checks the merged object list and only creates when
 * absent; if present, additively appends any canonical fields the stored object
 * is missing (schema reconcile). Creation gates on `edit` inside `createObjectTw`.
 */
export async function ensureCaseObject(
  projectId: string,
): Promise<ActionResult<{ ready: boolean; created: boolean }>> {
  if (!projectId) return { ok: false, error: 'No active project.' };
  let existing: ObjectMetadata | null = null;
  try {
    existing = await sabcrmObjectsApi.get(CASES_SLUG, projectId);
  } catch {
    existing = null; // not found / engine path — treat as absent
  }

  if (existing) {
    const have = new Set(existing.fields.map((f) => f.key));
    const missing = CASES_OBJECT.fields.filter((f) => !have.has(f.key));
    if (missing.length > 0) {
      const patched = await updateObjectTw(
        CASES_SLUG,
        { fields: [...existing.fields, ...missing] },
        projectId,
      );
      if (!patched.ok) return { ok: false, error: patched.error };
    }
    return { ok: true, data: { ready: true, created: false } };
  }

  const created = await createObjectTw(CASES_OBJECT, projectId);
  if (!created.ok) return { ok: false, error: created.error };
  return { ok: true, data: { ready: true, created: true } };
}

/* -------------------------------------------------------------------------- */
/* SLA policy config (per project)                                             */
/* -------------------------------------------------------------------------- */

interface PolicyDoc {
  projectId: string;
  policy?: Partial<SlaPolicy>;
  warningRatio?: number;
  updatedAt?: string;
  createdAt?: string;
}

/** Normalise a raw partial policy into a complete {@link SlaPolicy}. */
function normalizePolicy(raw?: Partial<SlaPolicy>): SlaPolicy {
  const out = {} as SlaPolicy;
  for (const p of CASE_PRIORITIES) {
    const def = DEFAULT_SLA_POLICY[p];
    const got = raw?.[p];
    const fr = Number(got?.firstResponseMins);
    const res = Number(got?.resolutionMins);
    out[p] = {
      firstResponseMins:
        Number.isFinite(fr) && fr > 0 ? Math.round(fr) : def.firstResponseMins,
      resolutionMins:
        Number.isFinite(res) && res > 0 ? Math.round(res) : def.resolutionMins,
    };
  }
  return out;
}

/** The project's SLA policy (filled with defaults) + the warning ratio. */
export async function getCasePolicy(
  projectId: string,
): Promise<{ policy: SlaPolicy; warningRatio: number }> {
  if (!projectId) return { policy: { ...DEFAULT_SLA_POLICY }, warningRatio: 0.8 };
  try {
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(POLICY_COLL)
      .findOne({ projectId })) as PolicyDoc | null;
    const ratio = Number(doc?.warningRatio);
    return {
      policy: normalizePolicy(doc?.policy),
      warningRatio: Number.isFinite(ratio) && ratio > 0 && ratio < 1 ? ratio : 0.8,
    };
  } catch {
    return { policy: { ...DEFAULT_SLA_POLICY }, warningRatio: 0.8 };
  }
}

/** Persist the project's SLA policy. Bumps the config doc's own `updatedAt`. */
export async function saveCasePolicy(
  projectId: string,
  input: { policy?: Partial<SlaPolicy>; warningRatio?: number },
): Promise<{ policy: SlaPolicy; warningRatio: number }> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const policy = normalizePolicy(input.policy);
  const ratioRaw = Number(input.warningRatio);
  const warningRatio =
    Number.isFinite(ratioRaw) && ratioRaw > 0 && ratioRaw < 1 ? ratioRaw : 0.8;
  await db.collection(POLICY_COLL).updateOne(
    { projectId },
    {
      $set: { projectId, policy, warningRatio, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  return { policy, warningRatio };
}

/** Discover projects that have configured a case policy (for the cron sweep). */
export async function listProjectsWithCasePolicy(db: Db): Promise<string[]> {
  try {
    const ids = (await db.collection(POLICY_COLL).distinct('projectId')) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* SLA recompute (AI-fields scalar envelope — NO updatedAt bump)              */
/* -------------------------------------------------------------------------- */

interface CaseRecordDoc {
  _id: ObjectId;
  data?: Record<string, unknown>;
  createdAt?: unknown;
  deletedAt?: unknown;
}

/**
 * Extract the {@link CaseLike} slice the SLA math needs from a record. The
 * case's open time prefers an explicit `data.createdAt` but falls back to the
 * record's top-level `createdAt` (records always have one).
 */
function caseLikeFromRecord(rec: CaseRecordDoc): CaseLike {
  const data = rec.data ?? {};
  return {
    priority: data[CASE_FIELDS.priority],
    status: data[CASE_FIELDS.status],
    createdAt: data.createdAt ?? rec.createdAt,
    firstResponseAt: data[CASE_FIELDS.firstResponseAt],
    resolvedAt: data[CASE_FIELDS.resolvedAt],
  };
}

/** sha256 (16 chars) over the SLA-relevant inputs — the dirty-check key. */
function slaInputsHash(c: CaseLike, status: SlaStatus): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        p: c.priority,
        s: c.status,
        o: c.createdAt,
        f: c.firstResponseAt,
        r: c.resolvedAt,
        status,
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

/**
 * Build the dotted `$set` for one case's SLA scalars, or `{}` when in sync.
 * Skips a write when the stored `data.__sla.status` already matches AND the
 * inputs hash is unchanged — so a no-op sweep is free of writes.
 */
function buildSlaSet(
  rec: CaseRecordDoc,
  nowMs: number,
  policy: SlaPolicy,
  warningRatio: number,
): Record<string, unknown> {
  const c = caseLikeFromRecord(rec);
  const r = computeSla(c, nowMs, policy, warningRatio);
  const data = rec.data ?? {};
  const meta = (data.__sla ?? {}) as { status?: string; inputsHash?: string };
  const hash = slaInputsHash(c, r.status);
  // For a CLOSED case the status is terminal — if hash + status both match,
  // nothing can change, so skip. For an OPEN case the warning/breach edge can
  // flip purely with the passage of time, so we only skip when the status is
  // identical (cheap) — the hash guards against missed input changes.
  if (meta.inputsHash === hash && meta.status === r.status) return {};
  return {
    [`data.${CASE_FIELDS.slaStatus}`]: r.status,
    'data.__sla': {
      status: r.status,
      firstResponseDue: r.firstResponseDue,
      resolutionDue: r.resolutionDue,
      closed: r.closed,
      computedAt: new Date(nowMs).toISOString(),
      inputsHash: hash,
    },
  };
}

/**
 * Recompute + persist one case's SLA scalars (no `updatedAt` bump). Best-effort
 * — never throws. Called inline from the create/update record actions (via the
 * twenty-actions hook) and from the cron sweep.
 */
export async function recomputeSlaForCase(
  projectId: string,
  caseId: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  try {
    if (!projectId || !caseId || !ObjectId.isValid(caseId)) return false;
    const { db } = await connectToDatabase();
    const rec = (await db.collection(RECORDS_COLL).findOne({
      _id: new ObjectId(caseId),
      projectId,
      object: CASES_SLUG,
    })) as CaseRecordDoc | null;
    if (!rec || rec.deletedAt) return false;
    const { policy, warningRatio } = await getCasePolicy(projectId);
    const set = buildSlaSet(rec, nowMs, policy, warningRatio);
    if (Object.keys(set).length === 0) return false;
    await db
      .collection(RECORDS_COLL)
      .updateOne({ _id: rec._id, projectId }, { $set: set });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read one case record and return the {@link CaseLike} slice for the SLA math,
 * or null when the case is missing / deleted. Used by the gated `getCaseSlaTw`
 * action to compute a live SLA picture without writing.
 */
export async function caseLikeForId(
  projectId: string,
  caseId: string,
): Promise<CaseLike | null> {
  try {
    if (!projectId || !caseId || !ObjectId.isValid(caseId)) return null;
    const { db } = await connectToDatabase();
    const rec = (await db.collection(RECORDS_COLL).findOne({
      _id: new ObjectId(caseId),
      projectId,
      object: CASES_SLUG,
    })) as CaseRecordDoc | null;
    if (!rec || rec.deletedAt) return null;
    return caseLikeFromRecord(rec);
  } catch {
    return null;
  }
}

/**
 * Cron sweep: recompute SLA for up to {@link MAX_CASES_PER_SWEEP} live cases of
 * a project. Catches cases that crossed a warning/breach edge purely with time
 * (no record mutation fires for that). Returns a small report. Best-effort.
 */
export async function scanSlaBreaches(
  projectId: string,
  nowMs: number = Date.now(),
): Promise<{ scanned: number; updated: number; breached: number; atRisk: number }> {
  const report = { scanned: 0, updated: 0, breached: 0, atRisk: 0 };
  try {
    if (!projectId) return report;
    const { db } = await connectToDatabase();
    const { policy, warningRatio } = await getCasePolicy(projectId);
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({
        projectId,
        object: CASES_SLUG,
        deletedAt: { $in: [null] },
        // Only open cases can change SLA with time; closed ones are terminal.
        'data.status': { $nin: ['RESOLVED', 'CLOSED'] },
      })
      .limit(MAX_CASES_PER_SWEEP)
      .toArray()) as unknown as CaseRecordDoc[];
    report.scanned = recs.length;
    for (const rec of recs) {
      const c = caseLikeFromRecord(rec);
      const r = computeSla(c, nowMs, policy, warningRatio);
      if (r.status === 'breached') report.breached += 1;
      else if (r.status === 'warning') report.atRisk += 1;
      const set = buildSlaSet(rec, nowMs, policy, warningRatio);
      if (Object.keys(set).length === 0) continue;
      await db
        .collection(RECORDS_COLL)
        .updateOne({ _id: rec._id, projectId }, { $set: set });
      report.updated += 1;
      // Log a timeline activity the first time a case tips into breach so an
      // agent sees it in the record timeline. Best-effort; never fatal.
      if (r.status === 'breached') {
        await logBreachActivity(projectId, String(rec._id)).catch(() => undefined);
      }
    }
    return report;
  } catch {
    return report;
  }
}

/** Whole-fleet sweep across every project that configured a case policy. */
export async function scanAllSlaBreaches(
  nowMs: number = Date.now(),
): Promise<{ projects: number; updated: number; breached: number }> {
  const out = { projects: 0, updated: 0, breached: 0 };
  try {
    const { db } = await connectToDatabase();
    const projectIds = await listProjectsWithCasePolicy(db);
    for (const projectId of projectIds) {
      const r = await scanSlaBreaches(projectId, nowMs);
      out.projects += 1;
      out.updated += r.updated;
      out.breached += r.breached;
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/**
 * Append a NOTE-type timeline activity recording an SLA breach. De-duped via
 * the `data.__sla.breachLoggedAt` marker so a sweep logs at most one breach
 * note per case. Best-effort.
 */
async function logBreachActivity(projectId: string, caseId: string): Promise<void> {
  const { db } = await connectToDatabase();
  if (!ObjectId.isValid(caseId)) return;
  const rec = (await db.collection(RECORDS_COLL).findOne(
    { _id: new ObjectId(caseId), projectId },
    { projection: { 'data.__sla.breachLoggedAt': 1, 'data.subject': 1 } },
  )) as { data?: { __sla?: { breachLoggedAt?: unknown }; subject?: unknown } } | null;
  if (!rec) return;
  if (rec.data?.__sla?.breachLoggedAt) return; // already logged
  await createActivity({
    projectId,
    type: 'NOTE',
    title: 'SLA breached',
    body: `The SLA on “${String(rec.data?.subject ?? 'this case')}” has been breached.`,
    targetObject: CASES_SLUG,
    targetRecordId: caseId,
    authorId: 'system',
  });
  await db
    .collection(RECORDS_COLL)
    .updateOne(
      { _id: new ObjectId(caseId), projectId },
      { $set: { 'data.__sla.breachLoggedAt': new Date().toISOString() } },
    );
}

/* -------------------------------------------------------------------------- */
/* CSAT survey (public)                                                        */
/* -------------------------------------------------------------------------- */

interface CsatDoc {
  _id: ObjectId;
  token: string;
  projectId: string;
  caseId: string;
  score?: number | null;
  comment?: string | null;
  submittedAt?: string | null;
  respondentIp?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Public view of a CSAT survey, returned to the `/share/csat/[token]` page. */
export interface CsatSurveyView {
  token: string;
  caseSubject: string;
  alreadySubmitted: boolean;
  existing?: { score: number; comment: string };
}

/** 32-char lowercase hex token shape guard (matches the public-hash format). */
export function isValidCsatToken(token: unknown): token is string {
  return typeof token === 'string' && /^[a-f0-9]{32}$/.test(token);
}

/**
 * Mint (or reuse) a CSAT survey token for a case and return the public path.
 * Idempotent per (projectId, caseId): an existing unsubmitted survey is reused
 * so re-sending doesn't strand prior links. Bumps the survey doc's `updatedAt`.
 */
export async function issueCsatToken(
  projectId: string,
  caseId: string,
): Promise<{ token: string; path: string } | null> {
  try {
    if (!projectId || !caseId || !ObjectId.isValid(caseId)) return null;
    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    const existing = (await db
      .collection(CSAT_COLL)
      .findOne({ projectId, caseId, submittedAt: { $in: [null] } })) as CsatDoc | null;
    if (existing?.token) {
      return { token: existing.token, path: `/share/csat/${existing.token}` };
    }
    const token = randomBytes(16).toString('hex');
    await db.collection(CSAT_COLL).insertOne({
      token,
      projectId,
      caseId,
      score: null,
      comment: null,
      submittedAt: null,
      respondentIp: null,
      createdAt: now,
      updatedAt: now,
    });
    return { token, path: `/share/csat/${token}` };
  } catch {
    return null;
  }
}

/** Resolve a CSAT token into the public survey view, or null when invalid. */
export async function getCsatSurvey(token: string): Promise<CsatSurveyView | null> {
  try {
    if (!isValidCsatToken(token)) return null;
    const { db } = await connectToDatabase();
    const doc = (await db.collection(CSAT_COLL).findOne({ token })) as CsatDoc | null;
    if (!doc) return null;
    let caseSubject = 'your case';
    if (ObjectId.isValid(doc.caseId)) {
      const rec = (await db.collection(RECORDS_COLL).findOne(
        { _id: new ObjectId(doc.caseId), projectId: doc.projectId },
        { projection: { 'data.subject': 1 } },
      )) as { data?: { subject?: unknown } } | null;
      if (rec?.data?.subject) caseSubject = String(rec.data.subject);
    }
    return {
      token,
      caseSubject,
      alreadySubmitted: Boolean(doc.submittedAt),
      existing: doc.submittedAt
        ? { score: Number(doc.score) || 0, comment: String(doc.comment ?? '') }
        : undefined,
    };
  } catch {
    return null;
  }
}

/** Result of a public CSAT submit. */
export type RecordCsatResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Public, UNGATED-but-validated CSAT submit (mirrors `submitProjectRating`).
 * Validates the token shape + the score range, rejects a second submission for
 * the same token, then writes the score onto the survey doc AND back onto the
 * case record's `data.csatScore` (AI-fields scalar envelope — NO `updatedAt`
 * bump) and logs a timeline note. Best-effort beyond the survey write.
 */
export async function recordCsat(
  token: string,
  score: unknown,
  comment: unknown,
  respondentIp?: string | null,
): Promise<RecordCsatResult> {
  if (!isValidCsatToken(token)) return { ok: false, error: 'Invalid survey link.' };
  const s = asCsatScore(score);
  if (s === null) return { ok: false, error: 'Please pick a rating from 1 to 5.' };
  try {
    const { db } = await connectToDatabase();
    const doc = (await db.collection(CSAT_COLL).findOne({ token })) as CsatDoc | null;
    if (!doc) return { ok: false, error: 'Survey not found.' };
    if (doc.submittedAt) {
      return { ok: false, error: 'This survey has already been submitted.' };
    }
    const now = new Date().toISOString();
    const cleanComment = String(comment ?? '').slice(0, 4000) || null;
    await db.collection(CSAT_COLL).updateOne(
      { token, submittedAt: { $in: [null] } },
      {
        $set: {
          score: s,
          comment: cleanComment,
          submittedAt: now,
          respondentIp: respondentIp ?? null,
          updatedAt: now,
        },
      },
    );
    // Reflect onto the case record (scalar envelope, no updatedAt bump).
    if (ObjectId.isValid(doc.caseId)) {
      await db
        .collection(RECORDS_COLL)
        .updateOne(
          { _id: new ObjectId(doc.caseId), projectId: doc.projectId, object: CASES_SLUG },
          {
            $set: {
              [`data.${CASE_FIELDS.csatScore}`]: s,
              'data.__csat': { score: s, comment: cleanComment, submittedAt: now },
            },
          },
        )
        .catch(() => undefined);
      await createActivity({
        projectId: doc.projectId,
        type: 'NOTE',
        title: `CSAT received: ${s}/5`,
        body: cleanComment ? `“${cleanComment}”` : 'No comment provided.',
        targetObject: CASES_SLUG,
        targetRecordId: doc.caseId,
        authorId: 'system',
      }).catch(() => undefined);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save feedback.' };
  }
}

/**
 * Aggregate a project's submitted CSAT scores into a {@link CsatAggregate} for
 * the settings / analytics surface. Best-effort.
 */
export async function aggregateProjectCsat(
  projectId: string,
  limit = 5000,
): Promise<CsatAggregate> {
  try {
    if (!projectId) return aggregateCsat([]);
    const { db } = await connectToDatabase();
    const docs = (await db
      .collection(CSAT_COLL)
      .find({ projectId, submittedAt: { $nin: [null] } })
      .project({ score: 1 })
      .limit(limit)
      .toArray()) as Array<{ score?: unknown }>;
    return aggregateCsat(docs.map((d) => d.score));
  } catch {
    return aggregateCsat([]);
  }
}

/** Ensure the CSAT + policy indexes (best-effort). */
export async function ensureCaseIndexes(db: Db): Promise<void> {
  try {
    await db.collection(CSAT_COLL).createIndex({ token: 1 }, { unique: true });
    await db.collection(CSAT_COLL).createIndex({ projectId: 1, caseId: 1 });
    await db.collection(POLICY_COLL).createIndex({ projectId: 1 }, { unique: true });
  } catch {
    /* best-effort */
  }
}
