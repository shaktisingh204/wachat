/**
 * Attendance helpers — clock in/out, geofencing, shift assignment, OT calc.
 *
 * Pure functions — pass `now` to get deterministic behaviour in tests.
 */

import type { Attendance, Employee, Shift, ID } from './types';

export interface ClockEvent {
  employeeId: ID;
  at: string; // ISO
  lat?: number;
  lng?: number;
  accuracy?: number;
}

export interface Geofence {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lng points, in metres. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isWithinGeofence(point: { lat: number; lng: number }, fence: Geofence): boolean {
  return haversineMeters(point, { lat: fence.centerLat, lng: fence.centerLng }) <= fence.radiusMeters;
}

/** Normalises HH:mm to minutes since midnight in the shift's timezone. */
function shiftMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

/** Pick the shift whose start time is closest to the clock-in. */
export function assignShift(clockInISO: string, shifts: Shift[]): Shift | null {
  if (shifts.length === 0) return null;
  const t = new Date(clockInISO);
  const mins = t.getUTCHours() * 60 + t.getUTCMinutes();
  let best = shifts[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of shifts) {
    const dist = Math.abs(shiftMinutes(s.startTime) - mins);
    if (dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return best;
}

export interface ClockInResult {
  status: 'present' | 'half-day';
  late: boolean;
  lateMinutes: number;
  withinGeofence: boolean;
  shiftId?: ID;
}

export function recordClockIn(
  event: ClockEvent,
  shift: Shift | null,
  fence?: Geofence,
): ClockInResult {
  const at = new Date(event.at);
  const mins = at.getUTCHours() * 60 + at.getUTCMinutes();
  const withinGeofence =
    fence && event.lat != null && event.lng != null
      ? isWithinGeofence({ lat: event.lat, lng: event.lng }, fence)
      : true;
  if (!shift) {
    return { status: 'present', late: false, lateMinutes: 0, withinGeofence };
  }
  const start = shiftMinutes(shift.startTime);
  const lateBy = Math.max(0, mins - (start + shift.graceMinutes));
  const late = lateBy > 0;
  return {
    status: lateBy > 60 ? 'half-day' : 'present',
    late,
    lateMinutes: lateBy,
    withinGeofence,
    shiftId: shift.id,
  };
}

export interface ClockOutResult {
  workedMinutes: number;
  overtimeMinutes: number;
}

const OT_DAILY_THRESHOLD = 8 * 60;

export function recordClockOut(
  clockInISO: string,
  clockOutISO: string,
  shift: Shift | null,
): ClockOutResult {
  const inTs = new Date(clockInISO).getTime();
  const outTs = new Date(clockOutISO).getTime();
  if (outTs <= inTs) return { workedMinutes: 0, overtimeMinutes: 0 };
  const totalMinutes = Math.floor((outTs - inTs) / 60_000);
  const breakMinutes = shift?.breakMinutes ?? 0;
  const worked = Math.max(0, totalMinutes - breakMinutes);
  const expected = shift ? Math.max(1, shiftMinutes(shift.endTime) - shiftMinutes(shift.startTime) - breakMinutes) : OT_DAILY_THRESHOLD;
  const ot = Math.max(0, worked - expected);
  return { workedMinutes: worked, overtimeMinutes: ot };
}

/** Construct a finalised attendance record from clock-in/out events. */
export function buildAttendance(opts: {
  employee: Pick<Employee, 'id' | 'tenantId'>;
  date: string;
  clockIn: ClockEvent;
  clockOut?: ClockEvent;
  shift?: Shift | null;
  fence?: Geofence;
  isHoliday?: boolean;
  isWeekend?: boolean;
}): Attendance {
  const { employee, date, clockIn, clockOut, shift, fence, isHoliday, isWeekend } = opts;
  const ci = recordClockIn(clockIn, shift ?? null, fence);
  const co = clockOut ? recordClockOut(clockIn.at, clockOut.at, shift ?? null) : { workedMinutes: 0, overtimeMinutes: 0 };
  return {
    id: `att_${employee.id}_${date}`,
    tenantId: employee.tenantId,
    employeeId: employee.id,
    date,
    clockIn: clockIn.at,
    clockOut: clockOut?.at,
    shiftId: shift?.id,
    workedMinutes: co.workedMinutes,
    overtimeMinutes: co.overtimeMinutes,
    status: isHoliday ? 'holiday' : isWeekend ? 'weekend' : ci.status,
    geo:
      clockIn.lat != null && clockIn.lng != null
        ? { lat: clockIn.lat, lng: clockIn.lng, accuracy: clockIn.accuracy }
        : undefined,
    notes: !ci.withinGeofence ? 'outside-geofence' : undefined,
  };
}

export function summariseOvertime(attendance: Attendance[]): {
  totalMinutes: number;
  overtimeMinutes: number;
  daysWorked: number;
} {
  return attendance.reduce(
    (acc, a) => ({
      totalMinutes: acc.totalMinutes + a.workedMinutes,
      overtimeMinutes: acc.overtimeMinutes + a.overtimeMinutes,
      daysWorked: acc.daysWorked + (a.status === 'present' || a.status === 'half-day' ? 1 : 0),
    }),
    { totalMinutes: 0, overtimeMinutes: 0, daysWorked: 0 },
  );
}
