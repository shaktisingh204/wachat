/**
 * Unit tests for the PURE notification-inbox helpers (`../notifications`).
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/notifications.test.ts`
 *
 * Covers only the I/O-free surface: kind validation, title/body/href builders
 * per kind, truncation, unread counting, and day-bucket grouping. The Mongo
 * CRUD in `../notifications.server.ts` is exercised by integration, not here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTIFICATION_KINDS,
  isNotificationKind,
  iconForKind,
  truncate,
  buildTitle,
  buildBody,
  buildHref,
  countUnread,
  dayBucketFor,
  groupByDay,
  type SabcrmInboxNotification,
  type NotifyInput,
} from '../notifications';

function row(
  over: Partial<SabcrmInboxNotification> = {},
): SabcrmInboxNotification {
  return {
    id: 'n1',
    projectId: 'p1',
    userId: 'u1',
    kind: 'system',
    title: 'Hi',
    read: false,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

/* -------------------------------------------------------------------------- */
/* Kind validation                                                            */
/* -------------------------------------------------------------------------- */

test('isNotificationKind accepts every known kind and rejects junk', () => {
  for (const k of NOTIFICATION_KINDS) assert.equal(isNotificationKind(k), true);
  assert.equal(isNotificationKind('mention'), true);
  assert.equal(isNotificationKind('nope'), false);
  assert.equal(isNotificationKind(''), false);
  assert.equal(isNotificationKind(undefined), false);
  assert.equal(isNotificationKind(42), false);
});

test('iconForKind returns a stable lucide name per kind, falling back', () => {
  assert.equal(iconForKind('mention'), 'AtSign');
  assert.equal(iconForKind('assignment'), 'UserCheck');
  assert.equal(iconForKind('sla_breach'), 'AlarmClock');
  assert.equal(iconForKind('approval'), 'ShieldCheck');
  // Every known kind maps to a non-empty name.
  for (const k of NOTIFICATION_KINDS) {
    assert.equal(typeof iconForKind(k), 'string');
    assert.ok(iconForKind(k).length > 0);
  }
});

/* -------------------------------------------------------------------------- */
/* truncate                                                                   */
/* -------------------------------------------------------------------------- */

test('truncate collapses whitespace and caps length with an ellipsis', () => {
  assert.equal(truncate('  a   b  c '), 'a b c');
  assert.equal(truncate(''), '');
  const long = 'x'.repeat(200);
  const t = truncate(long, 10);
  assert.equal(t.length, 10);
  assert.ok(t.endsWith('…'));
  // Short input is returned verbatim (after collapse).
  assert.equal(truncate('short', 50), 'short');
});

/* -------------------------------------------------------------------------- */
/* buildTitle                                                                 */
/* -------------------------------------------------------------------------- */

test('buildTitle honours an explicit title', () => {
  const input: NotifyInput = {
    projectId: 'p1',
    userId: 'u1',
    kind: 'mention',
    title: '  Custom  ',
  };
  assert.equal(buildTitle(input), 'Custom');
});

test('buildTitle derives per-kind verbs with and without an actor', () => {
  assert.equal(
    buildTitle({ projectId: 'p', userId: 'u', kind: 'mention', actorName: 'Priya' }),
    'Priya mentioned you',
  );
  assert.equal(
    buildTitle({ projectId: 'p', userId: 'u', kind: 'mention' }),
    'You were mentioned',
  );
  assert.equal(
    buildTitle({
      projectId: 'p',
      userId: 'u',
      kind: 'assignment',
      actorName: 'Sam',
      target: { object: 'leads', recordId: 'abc123def456', label: 'Acme renewal' },
    }),
    'Sam assigned you Acme renewal',
  );
  assert.equal(
    buildTitle({
      projectId: 'p',
      userId: 'u',
      kind: 'sla_breach',
      target: { object: 'service-cases', recordId: '0000001234abcd' },
    }),
    // humanizeSlug('service-cases') = 'Service cases'; tail = last 6 of id.
    'SLA breached on Service cases 34abcd',
  );
  assert.equal(
    buildTitle({ projectId: 'p', userId: 'u', kind: 'approval', actorName: 'Lee' }),
    'Lee requested your approval',
  );
});

/* -------------------------------------------------------------------------- */
/* buildBody                                                                  */
/* -------------------------------------------------------------------------- */

test('buildBody prefers explicit body, truncates, and derives from target', () => {
  assert.equal(
    buildBody({ projectId: 'p', userId: 'u', kind: 'comment', body: '  Ship it  ' }),
    'Ship it',
  );
  // Empty explicit body collapses to undefined (keeps the row single-line).
  assert.equal(
    buildBody({ projectId: 'p', userId: 'u', kind: 'comment', body: '   ' }),
    undefined,
  );
  // No body + a target → an "On <target>" line.
  assert.equal(
    buildBody({
      projectId: 'p',
      userId: 'u',
      kind: 'assignment',
      target: { object: 'leads', recordId: 'r1', label: 'Acme' },
    }),
    'On Acme',
  );
  // Nothing to add → undefined.
  assert.equal(buildBody({ projectId: 'p', userId: 'u', kind: 'system' }), undefined);
});

/* -------------------------------------------------------------------------- */
/* buildHref                                                                  */
/* -------------------------------------------------------------------------- */

test('buildHref prefers explicit href, else builds /sabcrm/<obj>/<id>', () => {
  assert.equal(
    buildHref({ projectId: 'p', userId: 'u', kind: 'info', href: '/x/y' }),
    '/x/y',
  );
  assert.equal(
    buildHref({
      projectId: 'p',
      userId: 'u',
      kind: 'assignment',
      target: { object: 'leads', recordId: 'r1' },
    }),
    '/sabcrm/leads/r1',
  );
  assert.equal(
    buildHref({ projectId: 'p', userId: 'u', kind: 'system' }),
    undefined,
  );
  // URL-encodes path components.
  assert.equal(
    buildHref({
      projectId: 'p',
      userId: 'u',
      kind: 'info',
      target: { object: 'a b', recordId: 'c/d' },
    }),
    '/sabcrm/a%20b/c%2Fd',
  );
});

/* -------------------------------------------------------------------------- */
/* countUnread                                                                */
/* -------------------------------------------------------------------------- */

test('countUnread counts only rows where read is falsy', () => {
  assert.equal(countUnread([]), 0);
  assert.equal(
    countUnread([row({ read: false }), row({ read: true }), row({ read: false })]),
    2,
  );
  assert.equal(countUnread([row({ read: true }), row({ read: true })]), 0);
});

/* -------------------------------------------------------------------------- */
/* dayBucketFor + groupByDay                                                  */
/* -------------------------------------------------------------------------- */

test('dayBucketFor classifies relative to start-of-day', () => {
  const now = new Date('2026-06-13T15:00:00.000Z').getTime();
  // A timestamp from earlier the same UTC day — but bucketing uses local
  // start-of-day, so assert via groupByDay below where it is deterministic
  // against the same `now`. Here just check the obvious far-past case.
  assert.equal(dayBucketFor('2020-01-01T00:00:00.000Z', now), 'Earlier');
  assert.equal(dayBucketFor('not-a-date', now), 'Earlier');
});

test('groupByDay buckets into Today/Yesterday/Earlier, dropping empties', () => {
  const now = Date.now();
  const today = new Date(now).toISOString();
  const yesterday = new Date(now - 26 * 3600_000).toISOString();
  const old = new Date(now - 10 * 86_400_000).toISOString();

  const groups = groupByDay(
    [
      row({ id: 'a', createdAt: today }),
      row({ id: 'b', createdAt: yesterday }),
      row({ id: 'c', createdAt: old }),
    ],
    now,
  );
  // All three buckets present, in canonical order.
  assert.deepEqual(
    groups.map((g) => g.bucket),
    ['Today', 'Yesterday', 'Earlier'],
  );
  assert.equal(groups[0].items[0].id, 'a');
  assert.equal(groups[1].items[0].id, 'b');
  assert.equal(groups[2].items[0].id, 'c');

  // Empty buckets are dropped.
  const onlyOld = groupByDay([row({ id: 'z', createdAt: old })], now);
  assert.deepEqual(onlyOld.map((g) => g.bucket), ['Earlier']);

  // Empty input → empty output.
  assert.deepEqual(groupByDay([], now), []);
});

test('groupByDay preserves newest-first order within a bucket', () => {
  const now = Date.now();
  const t1 = new Date(now - 1000).toISOString();
  const t2 = new Date(now - 2000).toISOString();
  const groups = groupByDay(
    [row({ id: 'first', createdAt: t1 }), row({ id: 'second', createdAt: t2 })],
    now,
  );
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].items.map((x) => x.id),
    ['first', 'second'],
  );
});
