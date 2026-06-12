import 'server-only';

/**
 * SabCRM — sequence (cadence) auto-unenroll runtime (server-only).
 *
 * Sequences (crate `sabcrm-sequences`, collections `sabcrm_sequences` +
 * `sabcrm_sequence_enrollments`) auto-unenroll a record when:
 *
 *   - **reply** — the record replied to a sequence email
 *     (sequence `settings.unenrollOnReply`, default `true`). Callable from
 *     email-reply ingestion once that lands.
 *   - **stage_changed** — the record's pipeline stage changed
 *     (sequence `settings.unenrollOnStageChange`: absent → never; `[]` →
 *     ANY stage change; non-empty → only when the NEW stage id is listed).
 *     Wired into the stage-change diff in `src/lib/sabcrm/runtime.ts`
 *     (`runRecordChangeWorkflows`).
 *
 * Everything here is **best-effort** and reads/writes Mongo directly (same
 * pattern as the scheduler's rotting pass) — a downed DB must never break
 * the record mutation that triggered the hook.
 */

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const SEQUENCES_COLL = 'sabcrm_sequences';
const ENROLLMENTS_COLL = 'sabcrm_sequence_enrollments';

/** Why a record is being auto-unenrolled. */
export type SabcrmUnenrollCause = 'reply' | 'stage_changed';

/** Optional context accompanying an auto-unenroll. */
export interface SabcrmUnenrollMeta {
  /** stage_changed: the stage value the record left. */
  fromValue?: unknown;
  /** stage_changed: the stage value the record entered. */
  toValue?: unknown;
  /** reply: message / thread identifier for the history line. */
  messageId?: string;
}

/** Loose sequence document shape (Mongo, read directly). */
interface SequenceDoc {
  _id: ObjectId | string;
  settings?: {
    unenrollOnReply?: boolean;
    unenrollOnStageChange?: string[];
  };
}

/** Loose enrollment document shape (Mongo, read directly). */
interface EnrollmentDoc {
  _id: ObjectId | string;
  sequenceId?: string;
}

/** Hex-stringify a Mongo `_id` regardless of stored type. */
function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/**
 * Does this sequence's settings ask for an unenroll on `cause`?
 *
 * - `reply` → `settings.unenrollOnReply` (default TRUE when absent —
 *   mirrors the Rust `SequenceSettings` serde default).
 * - `stage_changed` → `settings.unenrollOnStageChange`: absent/undefined →
 *   never; `[]` → any stage change; non-empty → only when the new stage
 *   value (`meta.toValue`, loosely stringified) is in the list.
 */
function shouldUnenroll(
  seq: SequenceDoc | undefined,
  cause: SabcrmUnenrollCause,
  meta?: SabcrmUnenrollMeta,
): boolean {
  const settings = seq?.settings ?? {};
  if (cause === 'reply') {
    return settings.unenrollOnReply !== false;
  }
  // stage_changed
  const stages = settings.unenrollOnStageChange;
  if (!Array.isArray(stages)) return false;
  if (stages.length === 0) return true;
  const to = String(meta?.toValue ?? '');
  return stages.some((s) => String(s) === to);
}

/**
 * Auto-unenroll every ACTIVE enrollment of `(objectSlug, recordId)` whose
 * sequence settings ask for it under `cause`. Appends a history line and
 * stamps `unenrollCause` / `unenrolledAt`. Best-effort — returns the number
 * of enrollments stopped and NEVER throws.
 *
 * Callers:
 * - `stage_changed` — `runRecordChangeWorkflows` in `src/lib/sabcrm/runtime.ts`
 *   (the existing stage-change diff spot);
 * - `reply` — email-reply ingestion (future wiring; the contract is stable).
 */
export async function unenrollSabcrmSequencesForRecord(
  projectId: string,
  objectSlug: string,
  recordId: string,
  cause: SabcrmUnenrollCause,
  meta?: SabcrmUnenrollMeta,
): Promise<number> {
  try {
    if (!projectId || !objectSlug || !recordId) return 0;
    const { db } = await connectToDatabase();

    const enrollments = (await db
      .collection(ENROLLMENTS_COLL)
      .find({ projectId, objectSlug, recordId, status: 'active' })
      .limit(100)
      .toArray()) as unknown as EnrollmentDoc[];
    if (enrollments.length === 0) return 0;

    // Load the distinct parent sequences once for their settings.
    const sequenceIds = [
      ...new Set(enrollments.map((e) => String(e.sequenceId ?? ''))),
    ].filter((id) => ObjectId.isValid(id));
    const sequences = (await db
      .collection(SEQUENCES_COLL)
      .find({
        projectId,
        _id: { $in: sequenceIds.map((id) => new ObjectId(id)) },
      })
      .toArray()) as unknown as SequenceDoc[];
    const byId = new Map(sequences.map((s) => [idHex(s._id), s]));

    const now = new Date().toISOString();
    const outcome =
      cause === 'stage_changed'
        ? `unenrolled:stage_changed (${String(meta?.fromValue ?? '')} → ${String(meta?.toValue ?? '')})`
        : `unenrolled:reply${meta?.messageId ? ` (${meta.messageId})` : ''}`;

    let stopped = 0;
    for (const enrollment of enrollments) {
      const seq = byId.get(String(enrollment.sequenceId ?? ''));
      if (!shouldUnenroll(seq, cause, meta)) continue;
      const res = await db.collection(ENROLLMENTS_COLL).updateOne(
        // Re-assert `status: 'active'` so a concurrent scheduler tick that
        // completed/failed the enrollment first wins.
        { _id: enrollment._id as ObjectId, status: 'active' },
        {
          $set: {
            status: 'unenrolled',
            unenrollCause: cause,
            unenrolledAt: now,
            updatedAt: now,
          },
          $push: {
            history: { stepId: null, at: now, outcome },
          } as never,
        },
      );
      if (res.modifiedCount > 0) stopped += 1;
    }
    return stopped;
  } catch {
    // best-effort: never throw out of a record-mutation side effect
    return 0;
  }
}
