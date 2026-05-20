import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { jobStart, pushError, toErrorMessage } from '../utils';

interface AttendanceDoc extends Document {
  _id: ObjectId;
  employee_id?: ObjectId | string | null;
  shift_id?: ObjectId | string | null;
  clock_in_time?: Date | string | null;
  clock_out_time?: Date | string | null;
  clock_out_type?: string | null;
  date?: Date | string | null;
}

interface ShiftDoc extends Document {
  _id: ObjectId;
  office_start_time?: string | null;
  office_end_time?: string | null;
  /** Minutes after `office_end_time` at which an open attendance is force-closed. */
  auto_clock_out_time?: number | null;
}

/**
 * Combine a calendar date with an `HH:mm` shift time into a Date.
 * Returns `null` when the input is missing or malformed.
 */
function combineDateAndTime(
  base: Date | string | null | undefined,
  hhmm: string | null | undefined,
): Date | null {
  if (!base || !hhmm) return null;
  const dateObj = base instanceof Date ? new Date(base.getTime()) : new Date(base);
  if (Number.isNaN(dateObj.getTime())) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  dateObj.setHours(hours, minutes, 0, 0);
  return dateObj;
}

/**
 * Force-close every open attendance row whose shift has been over for at
 * least `auto_clock_out_time` minutes. Records the synthetic clock-out
 * timestamp and tags `clock_out_type = 'auto'`.
 */
export default async function runAutoClockOut(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('auto-clock-out');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let closed = 0;

  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    const open = await db
      .collection<AttendanceDoc>('crm_attendances')
      .find({ clock_out_time: null })
      .toArray();

    // Cache shifts so we don't re-fetch the same one for every employee.
    const shiftCache = new Map<string, ShiftDoc | null>();

    for (const att of open) {
      processed++;
      const ref = att._id.toHexString();
      try {
        if (!att.shift_id) continue;

        const shiftKey =
          typeof att.shift_id === 'string'
            ? att.shift_id
            : att.shift_id.toHexString();

        let shift = shiftCache.get(shiftKey);
        if (shift === undefined) {
          const shiftId =
            typeof att.shift_id === 'string'
              ? new ObjectId(att.shift_id)
              : att.shift_id;
          shift = await db
            .collection<ShiftDoc>('shifts')
            .findOne({ _id: shiftId });
          shiftCache.set(shiftKey, shift ?? null);
        }
        if (!shift) continue;

        const autoClockOutMinutes = shift.auto_clock_out_time ?? 0;
        if (autoClockOutMinutes <= 0) continue;

        const shiftEnd = combineDateAndTime(
          att.date ?? att.clock_in_time ?? now,
          shift.office_end_time,
        );
        if (!shiftEnd) continue;

        const elapsedMs = now.getTime() - shiftEnd.getTime();
        const thresholdMs = autoClockOutMinutes * 60 * 1000;
        if (elapsedMs < thresholdMs) continue;

        const clockOutAt = new Date(shiftEnd.getTime() + thresholdMs);

        await db.collection<AttendanceDoc>('crm_attendances').updateOne(
          { _id: att._id, clock_out_time: null },
          {
            $set: {
              clock_out_time: clockOutAt,
              clock_out_type: 'auto',
              updatedAt: new Date(),
            },
          },
        );
        closed++;
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
  log('end', { processed, closed, errors: errors.length, durationMs });
  return {
    processed,
    errors,
    durationMs,
    details: { closed },
  };
}
