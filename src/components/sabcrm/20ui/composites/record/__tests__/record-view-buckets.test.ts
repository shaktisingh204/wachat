/**
 * Unit tests for the pure calendar/map/timeline bucketing helpers.
 *
 * Run: npx tsx --test "src/components/sabcrm/20ui/composites/record/__tests__/record-view-buckets.test.ts"
 *
 * `record-view-buckets.ts` is React/DOM/CSS-free by contract, so these run
 * under the plain node test runner via tsx.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { CrmRecord, FieldMetadata } from '@/lib/sabcrm/types';
import {
  pickDateField,
  pickLocationField,
  toDateValue,
  dayKey,
  buildMonthGrid,
  defaultCalendarMonth,
  sortChronological,
  groupTimelinePeriods,
  parseLocationParts,
  locationLabel,
  groupByLocation,
} from '../record-view-buckets';

/* ------------------------------------------------------------- factories */

function rec(id: string, data: Record<string, unknown>): CrmRecord {
  return {
    _id: id,
    object: 'tests',
    userId: 'u1',
    data,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function field(key: string, type: FieldMetadata['type']): FieldMetadata {
  return { key, label: key, type };
}

/* ======================================================= field selection */

test('pickDateField: null when the object has no date field', () => {
  const fields = [field('name', 'TEXT'), field('amount', 'CURRENCY')];
  assert.equal(pickDateField(fields), null);
});

test('pickDateField: a valid preferred key wins', () => {
  const fields = [
    field('createdAt', 'DATE_TIME'),
    field('closeDate', 'DATE'),
  ];
  assert.equal(pickDateField(fields, 'closeDate')?.key, 'closeDate');
});

test('pickDateField: ignores a preferred key that is not a date field', () => {
  const fields = [field('name', 'TEXT'), field('closeDate', 'DATE')];
  // 'name' is not a date field → falls through to the first date field.
  assert.equal(pickDateField(fields, 'name')?.key, 'closeDate');
});

test('pickDateField: prefers conventional keys over metadata order', () => {
  const fields = [
    field('someOtherDate', 'DATE'),
    field('dueDate', 'DATE'),
  ];
  // 'dueDate' is conventional; 'someOtherDate' comes first in metadata.
  assert.equal(pickDateField(fields)?.key, 'dueDate');
});

test('pickDateField: falls back to first date field when none are conventional', () => {
  const fields = [field('phaseA', 'DATE'), field('phaseB', 'DATE')];
  assert.equal(pickDateField(fields)?.key, 'phaseA');
});

test('pickLocationField: null without an ADDRESS field', () => {
  assert.equal(pickLocationField([field('name', 'TEXT')]), null);
});

test('pickLocationField: first ADDRESS field, preferred wins', () => {
  const fields = [field('hq', 'ADDRESS'), field('billing', 'ADDRESS')];
  assert.equal(pickLocationField(fields)?.key, 'hq');
  assert.equal(pickLocationField(fields, 'billing')?.key, 'billing');
});

/* ============================================================ date parse */

test('toDateValue: parses strings, numbers, Dates; rejects junk', () => {
  assert.ok(toDateValue('2026-06-14') instanceof Date);
  assert.ok(toDateValue(1_700_000_000_000) instanceof Date);
  assert.ok(toDateValue(new Date()) instanceof Date);
  assert.equal(toDateValue(''), null);
  assert.equal(toDateValue('not a date'), null);
  assert.equal(toDateValue(null), null);
  assert.equal(toDateValue(undefined), null);
});

test('dayKey: local yyyy-mm-dd with zero padding', () => {
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 11, 31)), '2026-12-31');
});

/* ========================================================= calendar grid */

test('buildMonthGrid: always 42 Sunday-first cells', () => {
  const grid = buildMonthGrid([], 'date', 2026, 5, new Date(2026, 5, 14));
  assert.equal(grid.cells.length, 42);
  // June 2026: the 1st is a Monday → first cell is the preceding Sunday (May 31).
  assert.equal(grid.cells[0]?.inMonth, false);
  assert.equal(grid.cells[0]?.day, 31);
  // First in-month cell is June 1.
  const firstInMonth = grid.cells.find((c) => c.inMonth);
  assert.equal(firstInMonth?.day, 1);
});

test('buildMonthGrid: buckets records onto their day cell', () => {
  const records = [
    rec('a', { date: '2026-06-14' }),
    rec('b', { date: '2026-06-14' }),
    rec('c', { date: '2026-06-02' }),
    rec('d', { date: 'nope' }), // undated
    rec('e', {}), // undated (missing)
  ];
  const grid = buildMonthGrid(records, 'date', 2026, 5, new Date(2026, 5, 14));
  const jun14 = grid.cells.find((c) => c.key === '2026-06-14');
  const jun02 = grid.cells.find((c) => c.key === '2026-06-02');
  assert.equal(jun14?.records.length, 2);
  assert.equal(jun02?.records.length, 1);
  assert.equal(grid.undated.length, 2);
  assert.equal(grid.placedInMonth, 3);
  assert.equal(jun14?.isToday, true);
});

test('buildMonthGrid: marks today only for the matching cell', () => {
  const grid = buildMonthGrid([], 'date', 2026, 5, new Date(2026, 5, 14));
  const todayCells = grid.cells.filter((c) => c.isToday);
  assert.equal(todayCells.length, 1);
  assert.equal(todayCells[0]?.key, '2026-06-14');
});

test('defaultCalendarMonth: anchors on earliest upcoming, else latest, else now', () => {
  const now = new Date(2026, 5, 14);
  // Upcoming wins.
  assert.deepEqual(
    defaultCalendarMonth(
      [rec('a', { date: '2026-08-01' }), rec('b', { date: '2026-01-01' })],
      'date',
      now,
    ),
    { year: 2026, month: 7 },
  );
  // No upcoming → latest past.
  assert.deepEqual(
    defaultCalendarMonth(
      [rec('a', { date: '2026-01-01' }), rec('b', { date: '2026-03-01' })],
      'date',
      now,
    ),
    { year: 2026, month: 2 },
  );
  // No dated records → now's month.
  assert.deepEqual(defaultCalendarMonth([rec('a', {})], 'date', now), {
    year: 2026,
    month: 5,
  });
});

/* ============================================================== timeline */

test('sortChronological: desc newest-first, undated split out', () => {
  const records = [
    rec('old', { date: '2026-01-01' }),
    rec('new', { date: '2026-12-01' }),
    rec('mid', { date: '2026-06-01' }),
    rec('none', { date: null }),
  ];
  const { entries, undated } = sortChronological(records, 'date', 'desc');
  assert.deepEqual(
    entries.map((e) => e.record._id),
    ['new', 'mid', 'old'],
  );
  assert.deepEqual(
    undated.map((r) => r._id),
    ['none'],
  );
});

test('sortChronological: asc oldest-first', () => {
  const records = [
    rec('a', { date: '2026-03-01' }),
    rec('b', { date: '2026-01-01' }),
  ];
  const { entries } = sortChronological(records, 'date', 'asc');
  assert.deepEqual(
    entries.map((e) => e.record._id),
    ['b', 'a'],
  );
});

test('sortChronological: stable for equal dates (incoming order kept)', () => {
  const records = [
    rec('first', { date: '2026-06-01' }),
    rec('second', { date: '2026-06-01' }),
    rec('third', { date: '2026-06-01' }),
  ];
  const { entries } = sortChronological(records, 'date', 'desc');
  assert.deepEqual(
    entries.map((e) => e.record._id),
    ['first', 'second', 'third'],
  );
});

test('groupTimelinePeriods: buckets into relative period headers', () => {
  const now = new Date(2026, 5, 14, 12, 0, 0); // Sun Jun 14 2026
  const records = [
    rec('today', { date: '2026-06-14T08:00:00' }),
    rec('yest', { date: '2026-06-13T08:00:00' }),
    rec('week', { date: '2026-06-10T08:00:00' }),
    rec('older', { date: '2026-02-01T08:00:00' }),
  ];
  const { entries } = sortChronological(records, 'date', 'desc');
  const periods = groupTimelinePeriods(entries, now);
  const keys = periods.map((p) => p.key);
  assert.deepEqual(keys, ['today', 'yesterday', 'week', '2026-02']);
  assert.equal(periods[0]?.label, 'Today');
  assert.equal(periods[0]?.entries.length, 1);
});

/* =================================================================== map */

test('parseLocationParts: tolerates object, twenty keys, bare string', () => {
  assert.deepEqual(parseLocationParts({ city: 'Pune', state: 'MH', country: 'IN' }), {
    city: 'Pune',
    state: 'MH',
    country: 'IN',
  });
  assert.deepEqual(
    parseLocationParts({ addressCity: 'Austin', addressState: 'TX' }),
    { city: 'Austin', state: 'TX', country: '' },
  );
  assert.deepEqual(parseLocationParts('Remote'), {
    city: 'Remote',
    state: '',
    country: '',
  });
  assert.deepEqual(parseLocationParts(null), { city: '', state: '', country: '' });
});

test('locationLabel: composes a readable label', () => {
  assert.equal(locationLabel({ city: 'Pune', state: 'MH', country: 'IN' }), 'Pune, MH');
  assert.equal(locationLabel({ city: 'Pune', state: '', country: 'IN' }), 'Pune, IN');
  assert.equal(locationLabel({ city: '', state: '', country: 'IN' }), 'IN');
  assert.equal(locationLabel({ city: '', state: '', country: '' }), '');
});

test('groupByLocation: buckets by location, sorted by count then label', () => {
  const records = [
    rec('a', { addr: { city: 'Pune', state: 'MH' } }),
    rec('b', { addr: { city: 'Pune', state: 'MH' } }),
    rec('c', { addr: { city: 'Austin', state: 'TX' } }),
    rec('d', { addr: {} }), // no location
    rec('e', { addr: 'Pune, MH' }), // bare string → same bucket via label
  ];
  const { groups, noLocation } = groupByLocation(records, 'addr');
  // Pune bucket (3: a, b, e) before Austin (1).
  assert.equal(groups[0]?.label, 'Pune, MH');
  assert.equal(groups[0]?.records.length, 3);
  assert.equal(groups[1]?.label, 'Austin, TX');
  assert.equal(groups[1]?.records.length, 1);
  assert.equal(noLocation.length, 1);
  assert.equal(noLocation[0]?._id, 'd');
});

test('groupByLocation: case-insensitive bucket keys', () => {
  const records = [
    rec('a', { addr: { city: 'Pune' } }),
    rec('b', { addr: { city: 'pune' } }),
  ];
  const { groups } = groupByLocation(records, 'addr');
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.records.length, 2);
});
