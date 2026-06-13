import 'server-only';

/**
 * SabCRM — multichannel cadence ENROLLMENT runner (server-only).
 *
 * The cadence builder ({@link ./cadences.server}) stores templates and
 * {@link ./cadence-channels.server} dispatches a single step across email / SMS /
 * WhatsApp / task / wait. This module is the missing middle: it ENROLLS a record
 * into a cadence and ADVANCES due enrollments step-by-step on a cron.
 *
 * Why a dedicated runner: the legacy `sabcrm-sequences` Rust engine only knows
 * email/task/wait steps and has no TS advance hook, so the multichannel cadence
 * gets its own enrollment collection (`sabcrm_cadence_enrollments`) + cron
 * (`/api/cron/sabcrm-cadences`). Per-(enrollment, stepIndex) idempotency lives in
 * `dispatchCadenceStep` (the `sabcrm_cadence_sends` ledger), so a re-tick never
 * double-sends.
 *
 * Everything is best-effort and never throws out of the cron.
 */

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

import { getCadenceTemplate } from './cadences.server';
import { dispatchCadenceStep } from './cadence-channels.server';
import { firstStepRunAt, nextStepAfter } from './cadence-channels';

const ENROLLMENTS_COLL = 'sabcrm_cadence_enrollments';
const MAX_DUE_PER_RUN = 500;

export type CadenceEnrollmentStatus = 'active' | 'completed' | 'failed';

export interface CadenceEnrollment {
  id: string;
  projectId: string;
  cadenceId: string;
  objectSlug: string;
  recordId: string;
  /** Identity sends are attributed to (the enroller / project actor). */
  userId: string;
  currentStepIndex: number;
  nextRunAt: string;
  status: CadenceEnrollmentStatus;
  createdAt: string;
  updatedAt: string;
}

interface EnrollmentDoc {
  _id: ObjectId | string;
  projectId: string;
  cadenceId: string;
  objectSlug: string;
  recordId: string;
  userId: string;
  currentStepIndex: number;
  nextRunAt: string;
  status: CadenceEnrollmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toEnrollment(doc: EnrollmentDoc): CadenceEnrollment {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    cadenceId: doc.cadenceId,
    objectSlug: doc.objectSlug,
    recordId: doc.recordId,
    userId: doc.userId,
    currentStepIndex: doc.currentStepIndex ?? 0,
    nextRunAt: doc.nextRunAt,
    status: doc.status,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

export type EnrollResult =
  | { ok: true; enrollment: CadenceEnrollment }
  | { ok: false; error: string };

/**
 * Enroll a record into a cadence. Idempotent: a record already ACTIVE in the
 * same cadence is returned as-is (never double-enrolled). The first step's
 * `nextRunAt` is `now + step0.delayHours`.
 */
export async function enrollRecordInCadence(
  projectId: string,
  cadenceId: string,
  objectSlug: string,
  recordId: string,
  userId: string,
  nowMs: number = Date.now(),
): Promise<EnrollResult> {
  if (!projectId || !cadenceId || !objectSlug || !recordId || !userId) {
    return { ok: false, error: 'Missing enrollment inputs.' };
  }
  try {
    const template = await getCadenceTemplate(projectId, cadenceId);
    if (!template) return { ok: false, error: 'Cadence not found.' };
    if (template.enabled === false) {
      return { ok: false, error: 'Cadence is disabled.' };
    }
    if (!template.steps || template.steps.length === 0) {
      return { ok: false, error: 'Cadence has no steps.' };
    }

    const { db } = await connectToDatabase();
    const existing = (await db.collection(ENROLLMENTS_COLL).findOne({
      projectId,
      cadenceId,
      objectSlug,
      recordId,
      status: 'active',
    })) as EnrollmentDoc | null;
    if (existing) return { ok: true, enrollment: toEnrollment(existing) };

    const now = new Date(nowMs).toISOString();
    const doc: Omit<EnrollmentDoc, '_id'> = {
      projectId,
      cadenceId,
      objectSlug,
      recordId,
      userId,
      currentStepIndex: 0,
      nextRunAt: firstStepRunAt(template.steps, nowMs),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const res = await db.collection(ENROLLMENTS_COLL).insertOne(doc);
    return { ok: true, enrollment: toEnrollment({ _id: res.insertedId, ...doc }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Enroll failed.' };
  }
}

/** Stop an active enrollment (e.g. on reply / manual unenroll). Best-effort. */
export async function unenrollFromCadence(
  projectId: string,
  enrollmentId: string,
): Promise<boolean> {
  try {
    if (!projectId || !ObjectId.isValid(enrollmentId)) return false;
    const { db } = await connectToDatabase();
    const res = await db.collection(ENROLLMENTS_COLL).updateOne(
      { _id: new ObjectId(enrollmentId), projectId, status: 'active' },
      { $set: { status: 'completed', updatedAt: new Date().toISOString() } },
    );
    return res.modifiedCount > 0;
  } catch {
    return false;
  }
}

/** Active enrollments for a record (for the record-timeline / unenroll UI). */
export async function listEnrollmentsForRecord(
  projectId: string,
  objectSlug: string,
  recordId: string,
): Promise<CadenceEnrollment[]> {
  try {
    if (!projectId || !objectSlug || !recordId) return [];
    const { db } = await connectToDatabase();
    const docs = (await db
      .collection(ENROLLMENTS_COLL)
      .find({ projectId, objectSlug, recordId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray()) as unknown as EnrollmentDoc[];
    return docs.map(toEnrollment);
  } catch {
    return [];
  }
}

/** Advance ONE due enrollment: dispatch its current step, then schedule next. */
async function advanceOne(
  db: Db,
  doc: EnrollmentDoc,
  nowMs: number,
): Promise<'sent' | 'completed' | 'failed' | 'skipped'> {
  const enr = toEnrollment(doc);
  const template = await getCadenceTemplate(enr.projectId, enr.cadenceId);
  if (!template || !template.steps || template.steps.length === 0) {
    await db.collection(ENROLLMENTS_COLL).updateOne(
      { _id: new ObjectId(idHex(doc._id)) },
      { $set: { status: 'completed', updatedAt: new Date(nowMs).toISOString() } },
    );
    return 'completed';
  }

  const idx = Math.max(0, enr.currentStepIndex);
  const step = template.steps[idx];
  if (!step) {
    await db.collection(ENROLLMENTS_COLL).updateOne(
      { _id: new ObjectId(idHex(doc._id)) },
      { $set: { status: 'completed', updatedAt: new Date(nowMs).toISOString() } },
    );
    return 'completed';
  }

  // Dispatch the current step (idempotent per enrollment+stepIndex).
  const res = await dispatchCadenceStep(
    enr.projectId,
    {
      id: enr.id,
      userId: enr.userId,
      projectId: enr.projectId,
      objectSlug: enr.objectSlug,
      recordId: enr.recordId,
      stepIndex: idx,
    },
    step,
  );

  // Schedule the next step regardless of a soft send failure (a single failed
  // step should not strand the whole cadence — the ledger records the outcome).
  const plan = nextStepAfter(template.steps, idx, nowMs);
  const now = new Date(nowMs).toISOString();
  if (plan.done || !plan.nextRunAt) {
    await db.collection(ENROLLMENTS_COLL).updateOne(
      { _id: new ObjectId(idHex(doc._id)) },
      { $set: { status: 'completed', currentStepIndex: idx, updatedAt: now } },
    );
    return res.ok ? 'completed' : 'failed';
  }
  await db.collection(ENROLLMENTS_COLL).updateOne(
    { _id: new ObjectId(idHex(doc._id)) },
    {
      $set: {
        currentStepIndex: plan.nextIndex,
        nextRunAt: plan.nextRunAt,
        updatedAt: now,
      },
    },
  );
  return res.ok ? 'sent' : 'failed';
}

/**
 * Process every ACTIVE enrollment whose `nextRunAt` is due. Capped per run.
 * Returns a small report for the cron response. Never throws.
 */
export async function runDueCadenceEnrollments(
  nowMs: number = Date.now(),
): Promise<{ due: number; sent: number; completed: number; failed: number }> {
  const report = { due: 0, sent: 0, completed: 0, failed: 0 };
  try {
    const { db } = await connectToDatabase();
    const nowIso = new Date(nowMs).toISOString();
    const due = (await db
      .collection(ENROLLMENTS_COLL)
      .find({ status: 'active', nextRunAt: { $lte: nowIso } })
      .sort({ nextRunAt: 1 })
      .limit(MAX_DUE_PER_RUN)
      .toArray()) as unknown as EnrollmentDoc[];
    report.due = due.length;
    for (const doc of due) {
      try {
        const outcome = await advanceOne(db, doc, nowMs);
        if (outcome === 'sent') report.sent += 1;
        else if (outcome === 'completed') report.completed += 1;
        else if (outcome === 'failed') report.failed += 1;
      } catch {
        report.failed += 1;
      }
    }
    return report;
  } catch {
    return report;
  }
}

/** Ensure the enrollment indexes (best-effort). */
export async function ensureCadenceEnrollmentIndexes(db: Db): Promise<void> {
  try {
    await db
      .collection(ENROLLMENTS_COLL)
      .createIndex({ status: 1, nextRunAt: 1 });
    await db
      .collection(ENROLLMENTS_COLL)
      .createIndex({ projectId: 1, objectSlug: 1, recordId: 1 });
  } catch {
    /* best-effort */
  }
}
