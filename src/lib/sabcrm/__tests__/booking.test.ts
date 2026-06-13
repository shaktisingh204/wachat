/**
 * Unit tests for the PURE booking slot math (`../booking`).
 *   npx tsx --test src/lib/sabcrm/__tests__/booking.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeSlots,
  findSlot,
  parseHHmm,
  tzOffsetMinutes,
  normaliseBusy,
  defaultWeeklyAvailability,
  slugify,
  type WeeklyAvailability,
} from '../booking';

// A fixed "now" well before the test dates so nothing is dropped as past.
const NOW = Date.parse('2025-01-01T00:00:00Z');

describe('parseHHmm', () => {
  it('parses valid times', () => {
    assert.equal(parseHHmm('09:00'), 540);
    assert.equal(parseHHmm('17:30'), 1050);
    assert.equal(parseHHmm('00:00'), 0);
    assert.equal(parseHHmm('24:00'), 1440);
  });
  it('rejects malformed values', () => {
    assert.equal(parseHHmm('9am'), null);
    assert.equal(parseHHmm('25:00'), null);
    assert.equal(parseHHmm(''), null);
    assert.equal(parseHHmm('12:99'), null);
  });
});

describe('tzOffsetMinutes', () => {
  it('returns the IANA offset east-positive', () => {
    // India is UTC+5:30 year-round.
    assert.equal(tzOffsetMinutes('Asia/Kolkata', NOW), 330);
    // UTC is 0.
    assert.equal(tzOffsetMinutes('UTC', NOW), 0);
  });
  it('falls back to 0 for an invalid tz (never throws)', () => {
    assert.equal(tzOffsetMinutes('Not/AZone', NOW), 0);
  });
});

describe('computeSlots — duration + windows', () => {
  // Wednesday 2025-01-08 is weekday 3.
  const avail: WeeklyAvailability = { 3: [{ start: '09:00', end: '11:00' }] };

  it('carves a window into back-to-back duration slots (UTC)', () => {
    const slots = computeSlots({
      weeklyAvailability: avail,
      durationMins: 30,
      dateRange: { from: '2025-01-08', to: '2025-01-08' },
      tz: 'UTC',
      now: NOW,
    });
    // 09:00–11:00 = 120 min / 30 = 4 slots.
    assert.equal(slots.length, 4);
    assert.equal(slots[0].startIso, '2025-01-08T09:00:00.000Z');
    assert.equal(slots[0].endIso, '2025-01-08T09:30:00.000Z');
    assert.equal(slots[3].startIso, '2025-01-08T10:30:00.000Z');
    assert.equal(slots[3].endIso, '2025-01-08T11:00:00.000Z');
  });

  it('respects the link timezone (Asia/Kolkata 09:00 = 03:30 UTC)', () => {
    const slots = computeSlots({
      weeklyAvailability: avail,
      durationMins: 60,
      dateRange: { from: '2025-01-08', to: '2025-01-08' },
      tz: 'Asia/Kolkata',
      now: NOW,
    });
    assert.equal(slots.length, 2); // 09:00, 10:00
    assert.equal(slots[0].startIso, '2025-01-08T03:30:00.000Z'); // 09:00 IST
    assert.equal(slots[1].startIso, '2025-01-08T04:30:00.000Z'); // 10:00 IST
  });

  it('drops the trailing partial slot that does not fit the duration', () => {
    const slots = computeSlots({
      weeklyAvailability: { 3: [{ start: '09:00', end: '10:15' }] },
      durationMins: 45,
      dateRange: { from: '2025-01-08', to: '2025-01-08' },
      tz: 'UTC',
      now: NOW,
    });
    // 75 min window, 45 min slots → only one slot (09:00–09:45) fits.
    assert.equal(slots.length, 1);
    assert.equal(slots[0].startIso, '2025-01-08T09:00:00.000Z');
  });

  it('honors a custom step (spacing between slots)', () => {
    const slots = computeSlots({
      weeklyAvailability: avail,
      durationMins: 30,
      stepMins: 60,
      dateRange: { from: '2025-01-08', to: '2025-01-08' },
      tz: 'UTC',
      now: NOW,
    });
    // 09:00 and 10:00 only (stepped by 60).
    assert.equal(slots.length, 2);
    assert.equal(slots[0].startIso, '2025-01-08T09:00:00.000Z');
    assert.equal(slots[1].startIso, '2025-01-08T10:00:00.000Z');
  });

  it('returns nothing for a closed weekday', () => {
    const slots = computeSlots({
      weeklyAvailability: avail, // only weekday 3 configured
      durationMins: 30,
      dateRange: { from: '2025-01-06', to: '2025-01-07' }, // Mon + Tue
      tz: 'UTC',
      now: NOW,
    });
    assert.equal(slots.length, 0);
  });
});

describe('computeSlots — busy exclusions', () => {
  const avail: WeeklyAvailability = { 3: [{ start: '09:00', end: '12:00' }] };

  it('excludes slots overlapping a busy interval', () => {
    const slots = computeSlots({
      weeklyAvailability: avail,
      durationMins: 60,
      dateRange: { from: '2025-01-08', to: '2025-01-08' },
      tz: 'UTC',
      now: NOW,
      busy: [
        // Busy 09:30–10:30 → kills the 09:00 and 10:00 slots (they overlap).
        { start: '2025-01-08T09:30:00Z', end: '2025-01-08T10:30:00Z' },
      ],
    });
    // 09:00 (overlaps), 10:00 (overlaps), 11:00 (free) → only 11:00 remains.
    assert.equal(slots.length, 1);
    assert.equal(slots[0].startIso, '2025-01-08T11:00:00.000Z');
  });

  it('keeps an exactly-abutting slot (half-open, no overlap)', () => {
    const slots = computeSlots({
      weeklyAvailability: avail,
      durationMins: 60,
      dateRange: { from: '2025-01-08', to: '2025-01-08' },
      tz: 'UTC',
      now: NOW,
      // Busy ends exactly when a slot starts → 10:00 slot is fine.
      busy: [{ start: '2025-01-08T09:00:00Z', end: '2025-01-08T10:00:00Z' }],
    });
    // 09:00 killed; 10:00 + 11:00 survive (abut, don't overlap).
    assert.equal(slots.length, 2);
    assert.equal(slots[0].startIso, '2025-01-08T10:00:00.000Z');
    assert.equal(slots[1].startIso, '2025-01-08T11:00:00.000Z');
  });
});

describe('computeSlots — past slots', () => {
  it('drops slots that have already started', () => {
    const avail: WeeklyAvailability = { 3: [{ start: '09:00', end: '12:00' }] };
    const slots = computeSlots({
      weeklyAvailability: avail,
      durationMins: 60,
      dateRange: { from: '2025-01-08', to: '2025-01-08' },
      tz: 'UTC',
      now: Date.parse('2025-01-08T10:30:00Z'), // now = 10:30
    });
    // 09:00 + 10:00 are in the past; only 11:00 remains.
    assert.equal(slots.length, 1);
    assert.equal(slots[0].startIso, '2025-01-08T11:00:00.000Z');
  });
});

describe('findSlot', () => {
  const cfg = {
    weeklyAvailability: { 3: [{ start: '09:00', end: '12:00' }] } as WeeklyAvailability,
    durationMins: 60,
    tz: 'UTC',
  };
  it('matches a real slot start', () => {
    const hit = findSlot('2025-01-08T10:00:00.000Z', cfg, [], NOW);
    assert.ok(hit);
    assert.equal(hit?.endIso, '2025-01-08T11:00:00.000Z');
  });
  it('rejects a time off the grid', () => {
    assert.equal(findSlot('2025-01-08T10:15:00.000Z', cfg, [], NOW), null);
  });
  it('rejects a slot blocked by busy', () => {
    const busy = [{ start: '2025-01-08T10:00:00Z', end: '2025-01-08T11:00:00Z' }];
    assert.equal(findSlot('2025-01-08T10:00:00.000Z', cfg, busy, NOW), null);
  });
  it('rejects a malformed iso', () => {
    assert.equal(findSlot('not-a-date', cfg, [], NOW), null);
  });
});

describe('normaliseBusy', () => {
  it('drops invalid / zero-length intervals and sorts', () => {
    const n = normaliseBusy([
      { start: '2025-01-08T11:00:00Z', end: '2025-01-08T12:00:00Z' },
      { start: 'bad', end: '2025-01-08T10:00:00Z' },
      { start: '2025-01-08T09:00:00Z', end: '2025-01-08T09:00:00Z' }, // zero-len
      { start: '2025-01-08T08:00:00Z', end: '2025-01-08T09:00:00Z' },
    ]);
    assert.equal(n.length, 2);
    assert.ok(n[0].start < n[1].start);
  });
});

describe('helpers', () => {
  it('defaultWeeklyAvailability covers Mon–Fri', () => {
    const a = defaultWeeklyAvailability();
    assert.ok(a[1] && a[5]);
    assert.equal(a[0], undefined); // Sunday closed
    assert.equal(a[6], undefined); // Saturday closed
  });
  it('slugify produces url-safe tokens', () => {
    assert.equal(slugify('My Demo Call!'), 'my-demo-call');
    assert.equal(slugify('  Multiple   Spaces  '), 'multiple-spaces');
  });
});
