/**
 * Meeting / scheduling primitives.
 *
 * `getAvailability` produces free `MeetingSlot` candidates given working
 * hours and a list of busy events. `bookSlot` converts a free slot into a
 * booked slot for an attendee.
 */
import type { MeetingSlot } from './types';

export interface WorkingHours {
  /** 0 = Sunday, 6 = Saturday. */
  daysOfWeek: number[];
  /** "HH:MM" 24h. */
  startTime: string;
  endTime: string;
  timeZone?: string;
}

export interface AvailabilityOptions {
  /** Slot duration in minutes. */
  durationMinutes: number;
  /** Buffer between meetings in minutes. */
  bufferMinutes?: number;
  /** Working hours definition. */
  workingHours?: WorkingHours;
  /** Existing busy intervals. */
  busy?: { start: string; end: string }[];
  /** Maximum number of slots to return. */
  limit?: number;
}

const DEFAULT_HOURS: WorkingHours = {
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '17:00',
};

function parseHM(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(':').map(n => parseInt(n, 10));
  return { h: h || 0, m: m || 0 };
}

function setTime(d: Date, hm: string): Date {
  const { h, m } = parseHM(hm);
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function slotId(ownerId: string, start: Date): string {
  return `slot_${ownerId}_${start.getTime().toString(36)}`;
}

/**
 * Generate free `MeetingSlot` candidates for `userId` between `range.start`
 * and `range.end`. Slots are filtered to working hours and exclude any
 * overlap with the supplied busy intervals (plus buffer).
 */
export function getAvailability(
  userId: string,
  range: { start: string | Date; end: string | Date },
  options: AvailabilityOptions,
): MeetingSlot[] {
  const start = new Date(range.start);
  const end = new Date(range.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('invalid range');
  }
  if (options.durationMinutes <= 0) throw new Error('durationMinutes must be > 0');

  const hours = options.workingHours ?? DEFAULT_HOURS;
  const buffer = options.bufferMinutes ?? 0;
  const limit = options.limit ?? 50;
  const stepMs = options.durationMinutes * 60_000;

  const busy = (options.busy ?? []).map(b => ({
    start: new Date(b.start).getTime() - buffer * 60_000,
    end: new Date(b.end).getTime() + buffer * 60_000,
  }));

  const slots: MeetingSlot[] = [];
  const cursor = new Date(start);
  cursor.setSeconds(0, 0);

  while (cursor.getTime() < end.getTime() && slots.length < limit) {
    if (!hours.daysOfWeek.includes(cursor.getDay())) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const dayStart = setTime(cursor, hours.startTime);
    const dayEnd = setTime(cursor, hours.endTime);
    if (cursor.getTime() < dayStart.getTime()) {
      cursor.setTime(dayStart.getTime());
    }

    while (cursor.getTime() + stepMs <= dayEnd.getTime() && slots.length < limit) {
      const slotStart = cursor.getTime();
      const slotEnd = slotStart + stepMs;
      if (slotEnd > end.getTime()) break;
      const conflict = busy.some(b => overlaps(slotStart, slotEnd, b.start, b.end));
      if (!conflict) {
        const startDate = new Date(slotStart);
        slots.push({
          id: slotId(userId, startDate),
          ownerId: userId,
          start: startDate.toISOString(),
          end: new Date(slotEnd).toISOString(),
          status: 'free',
        });
      }
      cursor.setTime(slotEnd);
    }

    // Move cursor to next day at 00:00 to re-evaluate working hours.
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return slots;
}

export interface BookAttendee {
  email: string;
  name?: string;
  meetingType?: string;
  location?: string;
  videoLink?: string;
}

/**
 * Book a slot — returns a new booked `MeetingSlot` carrying attendee details.
 * Throws if the slot is not currently free.
 */
export function bookSlot(slot: MeetingSlot, attendee: BookAttendee): MeetingSlot {
  if (slot.status !== 'free') {
    throw new Error(`slot is not free (status=${slot.status})`);
  }
  if (!attendee.email) throw new Error('attendee.email is required');
  return {
    ...slot,
    status: 'booked',
    attendeeEmail: attendee.email,
    attendeeName: attendee.name,
    meetingType: attendee.meetingType,
    location: attendee.location,
    videoLink: attendee.videoLink,
  };
}

/**
 * Cancel a previously booked slot — returns it to `free` and clears attendee.
 */
export function cancelSlot(slot: MeetingSlot): MeetingSlot {
  return {
    ...slot,
    status: 'free',
    attendeeEmail: undefined,
    attendeeName: undefined,
    meetingType: undefined,
    location: undefined,
    videoLink: undefined,
  };
}
