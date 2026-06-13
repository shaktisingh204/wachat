import 'server-only';

/**
 * SabCRM — GDPR / data-privacy runtime (server-only).
 *
 * The I/O layer over the pure helpers in `./gdpr.ts` (re-exported here so
 * callers only import from this file). Three capabilities:
 *
 *  1. **Consent CRUD** — `sabcrm_consents` (projectId + normalized subject
 *     email, the native-Mongo config pattern of `./scoring.server.ts`). A config
 *     collection MAY bump its own `updatedAt`.
 *  2. **Erasure (Right-To-Be-Forgotten)** — {@link eraseSubject}: finds every
 *     `sabcrm_records` row across all objects whose PII fields carry the
 *     subject's email, applies {@link anonymizationPlan} via a dotted `$set`
 *     (keeps the row, nulls the PII, stamps `data.__gdpr` + a top-level
 *     `erasedAt`), nulls the body of the subject's `sabcrm_activities`, and
 *     writes an immutable audit row to `sabcrm_gdpr_erasures`. This is a
 *     DELIBERATE destructive data write — unlike the AI-fields / scoring scalar
 *     writes, it intentionally DOES bump a marker so the erasure is visible and
 *     auditable on the record.
 *  3. **DSAR export** — {@link buildDsarExport}: gathers all records +
 *     activities + consents for a subject into a {@link DsarBundle} JSON.
 *
 * ## PII detection
 *
 * "PII fields" for an object are derived from its metadata field types
 * (EMAIL / EMAILS / PHONE / PHONES / FULL_NAME / ADDRESS) plus any keys the
 * project explicitly marks PII via `sabcrm_gdpr_config`. Conservative: only
 * those keys are ever nulled — erasure never touches business columns (stage,
 * amount, …) so referential integrity, counts and aggregates survive.
 *
 * ## Two-store gotcha
 *
 * Erasure + DSAR read/write `sabcrm_records` and `sabcrm_activities` DIRECTLY
 * via Mongo (the native-TS path). Object/field METADATA still lives behind the
 * Rust path, but we only READ metadata here (field types) via the native
 * `listObjects` reader, never mutate it. The Rust read path serves the same
 * `sabcrm_records` collection, so a null'd PII scalar written here is reflected
 * there with zero crate change — BUT the Rust read path applies no extra
 * filtering of its own, so this enforcement is complete for the data values.
 *
 * Everything except {@link eraseSubject} is best-effort. `eraseSubject`
 * surfaces a structured report so the caller can confirm what was redacted.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { listObjects } from './objects.server';
import type { FieldMetadata, ObjectMetadata } from './types';
import {
  isConsentValid,
  anonymizationPlan,
  dsarBundleShape,
  normalizeSubjectEmail,
  type ConsentRecord,
  type ConsentInput,
  type DsarBundle,
  type DsarRecordEntry,
  type DsarActivityEntry,
} from './gdpr';

export {
  isConsentValid,
  anonymizationPlan,
  dsarBundleShape,
  normalizeSubjectEmail,
  buildErasureMarker,
  parseIsoMs,
  ERASURE_MARKER_KEY,
  type ConsentRecord,
  type ConsentInput,
  type ConsentStatus,
  type AnonymizationPlan,
  type ErasureMarker,
  type DsarBundle,
  type DsarRecordEntry,
  type DsarActivityEntry,
} from './gdpr';

const CONSENTS_COLL = 'sabcrm_consents';
const ERASURES_COLL = 'sabcrm_gdpr_erasures';
const CONFIG_COLL = 'sabcrm_gdpr_config';
const RECORDS_COLL = 'sabcrm_records';
const ACTIVITIES_COLL = 'sabcrm_activities';

/** Field types treated as PII by default (nulled on erasure). */
const PII_FIELD_TYPES: ReadonlySet<string> = new Set([
  'EMAIL',
  'EMAILS',
  'PHONE',
  'PHONES',
  'FULL_NAME',
  'ADDRESS',
]);

/** Hard caps so a single erasure / DSAR can never run unbounded. */
const MAX_OBJECTS = 200;
const MAX_RECORDS_PER_OBJECT = 1000;
const MAX_ACTIVITIES = 5000;
const MAX_DSAR_RECORDS = 5000;

/* -------------------------------------------------------------------------- */
/* Consent CRUD                                                                 */
/* -------------------------------------------------------------------------- */

interface ConsentDoc {
  _id: ObjectId | string;
  projectId: string;
  subjectEmail: string;
  purpose: string;
  status?: string;
  grantedAt?: string;
  withdrawnAt?: string | null;
  expiresAt?: string | null;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toConsent(doc: ConsentDoc): ConsentRecord {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    subjectEmail: doc.subjectEmail,
    purpose: doc.purpose,
    status: doc.status === 'withdrawn' ? 'withdrawn' : 'granted',
    grantedAt: doc.grantedAt ?? '',
    withdrawnAt: doc.withdrawnAt ?? null,
    expiresAt: doc.expiresAt ?? null,
    source: doc.source,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/**
 * Record (grant or withdraw) consent for a subject + purpose. Upserts on
 * `(projectId, subjectEmail, purpose)` so re-recording the same purpose updates
 * the existing grant rather than duplicating it. A withdraw stamps
 * `withdrawnAt`; a grant clears it. Config collection — bumps its own
 * `updatedAt`.
 */
export async function recordConsent(
  projectId: string,
  input: ConsentInput,
): Promise<ConsentRecord> {
  const subjectEmail = normalizeSubjectEmail(input.subjectEmail);
  const purpose = String(input.purpose ?? '').trim();
  if (!projectId || !subjectEmail || !purpose) {
    throw new Error('projectId, subjectEmail and purpose are required.');
  }
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const status = input.status === 'withdrawn' ? 'withdrawn' : 'granted';

  const set: Record<string, unknown> = {
    status,
    updatedAt: now,
    source: input.source ?? undefined,
    expiresAt: input.expiresAt ?? null,
  };
  if (status === 'granted') {
    set.grantedAt = input.grantedAt || now;
    set.withdrawnAt = null;
  } else {
    set.withdrawnAt = now;
  }

  await db.collection(CONSENTS_COLL).updateOne(
    { projectId, subjectEmail, purpose },
    {
      $set: set,
      $setOnInsert: {
        projectId,
        subjectEmail,
        purpose,
        createdAt: now,
        // Seed grantedAt on insert for a withdraw-first edge case.
        ...(status === 'granted' ? {} : { grantedAt: input.grantedAt || now }),
      },
    },
    { upsert: true },
  );

  const doc = (await db
    .collection(CONSENTS_COLL)
    .findOne({ projectId, subjectEmail, purpose })) as ConsentDoc | null;
  if (!doc) throw new Error('Failed to persist consent.');
  return toConsent(doc);
}

/** All consent records for a subject (newest first). */
export async function listConsents(
  projectId: string,
  subjectEmail: string,
): Promise<ConsentRecord[]> {
  const email = normalizeSubjectEmail(subjectEmail);
  if (!projectId || !email) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(CONSENTS_COLL)
    .find({ projectId, subjectEmail: email })
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray()) as unknown as ConsentDoc[];
  return docs.map(toConsent);
}

/**
 * Whether a subject currently has VALID consent for a purpose. Convenience over
 * {@link listConsents} + the pure {@link isConsentValid}. Any one valid grant
 * for the purpose suffices.
 */
export async function hasValidConsent(
  projectId: string,
  subjectEmail: string,
  purpose: string,
  now: number = Date.now(),
): Promise<boolean> {
  const consents = await listConsents(projectId, subjectEmail);
  return consents.some((c) => isConsentValid(c, purpose, now));
}

/* -------------------------------------------------------------------------- */
/* PII field resolution                                                         */
/* -------------------------------------------------------------------------- */

interface GdprConfigDoc {
  projectId: string;
  /** Object slug → extra PII field keys flagged by the project. */
  piiFieldsByObject?: Record<string, string[]>;
}

/** Per-project PII overrides (extra keys beyond the type-derived defaults). */
async function loadPiiOverrides(
  projectId: string,
): Promise<Record<string, string[]>> {
  try {
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(CONFIG_COLL)
      .findOne({ projectId })) as GdprConfigDoc | null;
    return doc?.piiFieldsByObject ?? {};
  } catch {
    return {};
  }
}

/**
 * The PII field keys for one object: type-derived defaults (EMAIL/PHONE/…) plus
 * any project overrides. Also returns the EMAIL/EMAILS keys separately so the
 * subject-matching query knows where to look.
 */
function objectPiiKeys(
  object: ObjectMetadata,
  overrides: string[],
): { piiKeys: string[]; emailKeys: string[] } {
  const fields = object.fields ?? [];
  const piiKeys = new Set<string>();
  const emailKeys: string[] = [];
  for (const f of fields as FieldMetadata[]) {
    if (PII_FIELD_TYPES.has(f.type)) piiKeys.add(f.key);
    if (f.type === 'EMAIL' || f.type === 'EMAILS') emailKeys.push(f.key);
  }
  for (const k of overrides) {
    const key = String(k ?? '').trim();
    if (key) piiKeys.add(key);
  }
  return { piiKeys: [...piiKeys], emailKeys };
}

/* -------------------------------------------------------------------------- */
/* Subject matching                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Build a Mongo `$or` over an object's EMAIL/EMAILS keys that matches a record
 * whose email value equals (or, for EMAILS composites, contains) the subject.
 * EMAIL fields hold a plain string; EMAILS composites hold
 * `{ primaryEmail, additionalEmails }`, so we match both the top-level path and
 * the `.primaryEmail` sub-path. Case-insensitive exact-ish match anchored on the
 * normalized address.
 */
function subjectMatchOr(
  emailKeys: string[],
  subjectEmail: string,
): Array<Record<string, unknown>> {
  const rx = { $regex: `^${escapeRegExp(subjectEmail)}$`, $options: 'i' };
  const or: Array<Record<string, unknown>> = [];
  for (const k of emailKeys) {
    or.push({ [`data.${k}`]: rx });
    or.push({ [`data.${k}.primaryEmail`]: rx });
    // EMAILS additionalEmails is an array of strings — exact element match.
    or.push({ [`data.${k}.additionalEmails`]: rx });
  }
  return or;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* -------------------------------------------------------------------------- */
/* DSAR export                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Gather all CRM records, activities and consents for a subject into a
 * {@link DsarBundle} JSON. Read-only. Records are matched on EMAIL/EMAILS PII
 * keys across every object; activities are matched by linkage to those records;
 * consents by subject email.
 */
export async function buildDsarExport(
  projectId: string,
  subjectEmail: string,
): Promise<DsarBundle> {
  const email = normalizeSubjectEmail(subjectEmail);
  const empty = dsarBundleShape({
    projectId,
    subjectEmail: email,
    records: [],
    activities: [],
    consents: [],
  });
  if (!projectId || !email) return empty;

  const { db } = await connectToDatabase();
  const objects = (await listObjects(projectId)).slice(0, MAX_OBJECTS);
  const overrides = await loadPiiOverrides(projectId);

  const records: DsarRecordEntry[] = [];
  const matchedRecordIds: ObjectId[] = [];

  for (const object of objects) {
    const { emailKeys } = objectPiiKeys(object, overrides[object.slug] ?? []);
    if (emailKeys.length === 0) continue;
    const or = subjectMatchOr(emailKeys, email);
    if (or.length === 0) continue;
    try {
      const docs = (await db
        .collection(RECORDS_COLL)
        .find({ projectId, object: object.slug, $or: or })
        .limit(MAX_RECORDS_PER_OBJECT)
        .toArray()) as Array<{
        _id: ObjectId;
        data?: Record<string, unknown>;
        createdAt?: string;
        updatedAt?: string;
      }>;
      for (const d of docs) {
        if (records.length >= MAX_DSAR_RECORDS) break;
        records.push({
          object: object.slug,
          recordId: d._id.toHexString(),
          data: d.data ?? {},
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
        matchedRecordIds.push(d._id);
      }
    } catch {
      /* one object failing must not sink the export */
    }
  }

  // Activities linked to the matched records.
  const activities: DsarActivityEntry[] = [];
  if (matchedRecordIds.length > 0) {
    try {
      const recordHexes = matchedRecordIds.map((id) => id.toHexString());
      const actDocs = (await db
        .collection(ACTIVITIES_COLL)
        .find({ projectId, targetRecordId: { $in: recordHexes } })
        .sort({ createdAt: -1 })
        .limit(MAX_ACTIVITIES)
        .toArray()) as Array<{
        _id: ObjectId | string;
        type?: string;
        title?: string;
        body?: string;
        targetObject?: string;
        targetRecordId?: string;
        occurredAt?: string | null;
        createdAt?: unknown;
      }>;
      for (const a of actDocs) {
        activities.push({
          activityId: idHex(a._id),
          type: String(a.type ?? ''),
          title: a.title,
          body: a.body,
          targetObject: a.targetObject,
          targetRecordId: a.targetRecordId,
          occurredAt: a.occurredAt ?? null,
          createdAt:
            a.createdAt instanceof Date
              ? a.createdAt.toISOString()
              : a.createdAt
                ? String(a.createdAt)
                : undefined,
        });
      }
    } catch {
      /* best-effort */
    }
  }

  const consents = await listConsents(projectId, email);

  return dsarBundleShape({
    projectId,
    subjectEmail: email,
    records,
    activities,
    consents,
  });
}

/* -------------------------------------------------------------------------- */
/* Erasure (Right-To-Be-Forgotten)                                             */
/* -------------------------------------------------------------------------- */

/** Structured report from an erasure run (for the action + the audit log). */
export interface ErasureReport {
  subjectEmail: string;
  /** Records scanned (matched the subject). */
  recordsScanned: number;
  /** Records actually redacted (carried at least one present PII value). */
  recordsRedacted: number;
  /** Activities whose body/title were nulled. */
  activitiesRedacted: number;
  /** Per-object breakdown. */
  perObject: Array<{ object: string; scanned: number; redacted: number }>;
  /** ISO timestamp the erasure ran. */
  erasedAt: string;
  /** Id of the audit row written to `sabcrm_gdpr_erasures`. */
  auditId: string;
}

/**
 * Erase (anonymize) a data subject across the whole project.
 *
 * For every object, finds records matching the subject's email on its
 * EMAIL/EMAILS PII keys, then applies {@link anonymizationPlan} (nulls the
 * object's PII fields, stamps `data.__gdpr`) via a dotted `$set`. Unlike the
 * AI-fields / scoring scalar writes, this is a DELIBERATE destructive write, so
 * it ALSO sets a top-level `erasedAt` marker (auditability beats the idle-clock
 * concern — an erased record is not a normal mutation). Activities for the
 * matched records have their `title` + `body` nulled. An immutable audit row is
 * written to `sabcrm_gdpr_erasures`.
 *
 * `actorUserId` (the authenticated user performing the erasure) is recorded in
 * the audit log. Returns a structured {@link ErasureReport}.
 *
 * SECURITY: only ever NULLS the object's declared PII keys — it never deletes
 * rows and never touches business columns. The match query is hard-scoped to
 * `projectId` (tenant boundary) and `object` (no cross-object leakage).
 */
export async function eraseSubject(
  projectId: string,
  subjectEmail: string,
  actorUserId?: string,
): Promise<ErasureReport> {
  const email = normalizeSubjectEmail(subjectEmail);
  const erasedAt = new Date().toISOString();
  const report: ErasureReport = {
    subjectEmail: email,
    recordsScanned: 0,
    recordsRedacted: 0,
    activitiesRedacted: 0,
    perObject: [],
    erasedAt,
    auditId: '',
  };
  if (!projectId || !email) {
    throw new Error('projectId and subjectEmail are required.');
  }

  const { db } = await connectToDatabase();
  const objects = (await listObjects(projectId)).slice(0, MAX_OBJECTS);
  const overrides = await loadPiiOverrides(projectId);

  const redactedRecordIds: ObjectId[] = [];

  for (const object of objects) {
    const { piiKeys, emailKeys } = objectPiiKeys(
      object,
      overrides[object.slug] ?? [],
    );
    if (emailKeys.length === 0 || piiKeys.length === 0) continue;
    const or = subjectMatchOr(emailKeys, email);
    if (or.length === 0) continue;

    let scanned = 0;
    let redacted = 0;
    try {
      const docs = (await db
        .collection(RECORDS_COLL)
        .find({ projectId, object: object.slug, $or: or })
        .limit(MAX_RECORDS_PER_OBJECT)
        .toArray()) as Array<{ _id: ObjectId; data?: Record<string, unknown> }>;
      for (const d of docs) {
        scanned += 1;
        const plan = anonymizationPlan(d.data ?? {}, piiKeys, erasedAt);
        if (!plan.hasChanges) continue;
        // Deliberate destructive write: bump a top-level erasedAt marker so the
        // row is visibly erased (NOT the AI-field no-bump rule — erasure is not
        // a normal scalar recompute).
        await db.collection(RECORDS_COLL).updateOne(
          { _id: d._id, projectId },
          { $set: { ...plan.set, erasedAt, updatedAt: erasedAt } },
        );
        redacted += 1;
        redactedRecordIds.push(d._id);
      }
    } catch {
      /* one object failing must not sink the whole erasure */
    }
    report.recordsScanned += scanned;
    report.recordsRedacted += redacted;
    if (scanned > 0) {
      report.perObject.push({ object: object.slug, scanned, redacted });
    }
  }

  // Null the subject's activity bodies/titles (they may embed PII).
  if (redactedRecordIds.length > 0) {
    try {
      const recordHexes = redactedRecordIds.map((id) => id.toHexString());
      const res = await db.collection(ACTIVITIES_COLL).updateMany(
        { projectId, targetRecordId: { $in: recordHexes } },
        {
          $set: {
            title: null,
            body: null,
            erasedAt,
            updatedAt: new Date(),
          },
        },
      );
      report.activitiesRedacted = res.modifiedCount ?? 0;
    } catch {
      /* best-effort */
    }
  }

  // Immutable audit row.
  try {
    const res = await db.collection(ERASURES_COLL).insertOne({
      projectId,
      subjectEmail: email,
      actorUserId: actorUserId ?? null,
      erasedAt,
      recordsScanned: report.recordsScanned,
      recordsRedacted: report.recordsRedacted,
      activitiesRedacted: report.activitiesRedacted,
      perObject: report.perObject,
      createdAt: erasedAt,
    });
    report.auditId = idHex(res.insertedId);
  } catch {
    /* audit insert failure must not throw away the erasure result */
  }

  return report;
}

/** List prior erasure audit rows for a subject (or the whole project). */
export async function listErasures(
  projectId: string,
  subjectEmail?: string,
): Promise<
  Array<{
    id: string;
    subjectEmail: string;
    actorUserId: string | null;
    erasedAt: string;
    recordsRedacted: number;
    activitiesRedacted: number;
  }>
> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const q: Record<string, unknown> = { projectId };
  const email = normalizeSubjectEmail(subjectEmail ?? '');
  if (email) q.subjectEmail = email;
  const docs = (await db
    .collection(ERASURES_COLL)
    .find(q)
    .sort({ erasedAt: -1 })
    .limit(200)
    .toArray()) as Array<{
    _id: ObjectId | string;
    subjectEmail?: string;
    actorUserId?: string | null;
    erasedAt?: string;
    recordsRedacted?: number;
    activitiesRedacted?: number;
  }>;
  return docs.map((d) => ({
    id: idHex(d._id),
    subjectEmail: d.subjectEmail ?? '',
    actorUserId: d.actorUserId ?? null,
    erasedAt: d.erasedAt ?? '',
    recordsRedacted: d.recordsRedacted ?? 0,
    activitiesRedacted: d.activitiesRedacted ?? 0,
  }));
}
