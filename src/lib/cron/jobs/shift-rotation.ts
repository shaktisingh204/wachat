import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { jobStart, pushError, toErrorMessage } from '../utils';

interface AutomateShiftDoc extends Document {
  _id: ObjectId;
  employee_id?: ObjectId | string | null;
  current_shift_id?: ObjectId | string | null;
  sequence_id?: ObjectId | string | null;
  rotation_interval_days?: number;
  nextRotationAt?: Date | null;
  status?: string;
}

interface ShiftRotationSequenceDoc extends Document {
  _id: ObjectId;
  shifts?: Array<ObjectId | string>;
  rotation_interval_days?: number;
}

/**
 * Step every overdue shift rotation forward by one slot in its
 * `shift_rotation_sequences.shifts` array, looping back to index 0 when
 * the end is reached, then bump `nextRotationAt`.
 */
export default async function runShiftRotation(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('shift-rotation');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let rotated = 0;

  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    const due = await db
      .collection<AutomateShiftDoc>('automate_shifts')
      .find({
        status: { $ne: 'inactive' },
        nextRotationAt: { $lte: now },
      })
      .toArray();

    for (const assignment of due) {
      processed++;
      const ref = assignment._id.toHexString();
      try {
        if (!assignment.sequence_id) continue;

        const seqId =
          typeof assignment.sequence_id === 'string'
            ? new ObjectId(assignment.sequence_id)
            : assignment.sequence_id;

        const sequence = await db
          .collection<ShiftRotationSequenceDoc>('shift_rotation_sequences')
          .findOne({ _id: seqId });

        if (!sequence || !sequence.shifts || sequence.shifts.length === 0) {
          continue;
        }

        const shifts = sequence.shifts.map((s) =>
          typeof s === 'string' ? s : s.toHexString(),
        );
        const currentId = assignment.current_shift_id
          ? typeof assignment.current_shift_id === 'string'
            ? assignment.current_shift_id
            : assignment.current_shift_id.toHexString()
          : null;

        const currentIdx = currentId ? shifts.indexOf(currentId) : -1;
        const nextIdx = (currentIdx + 1) % shifts.length;
        const nextShiftId = sequence.shifts[nextIdx];

        const intervalDays =
          assignment.rotation_interval_days ??
          sequence.rotation_interval_days ??
          7;
        const nextRotationAt = new Date(
          now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
        );

        await db
          .collection<AutomateShiftDoc>('automate_shifts')
          .updateOne(
            { _id: assignment._id },
            {
              $set: {
                current_shift_id: nextShiftId,
                nextRotationAt,
                updatedAt: new Date(),
              },
            },
          );
        rotated++;
      } catch (err) {
        pushError(errors, err, ref);
        log('error', { ref, message: toErrorMessage(err) });
      }
    }
  } catch (err) {
    pushError(errors, err);
    log('fatal', { message: toErrorMessage(err) });
  }

  const durationMs = Date.now() - startedAt.getTime();
  log('end', { processed, rotated, errors: errors.length, durationMs });
  return {
    processed,
    errors,
    durationMs,
    details: { rotated },
  };
}
