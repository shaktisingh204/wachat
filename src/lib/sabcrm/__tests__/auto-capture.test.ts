/**
 * Unit tests for the PURE activity-auto-capture helpers (`../auto-capture`).
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/auto-capture.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeEmail,
  htmlToText,
  matchRecordByEmail,
  buildActivityFromEmail,
  buildActivityFromCalendarEvent,
  type MatchCandidate,
} from '../auto-capture';

test('normalizeEmail lowercases, trims, rejects non-emails', () => {
  assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com');
  assert.equal(normalizeEmail('not-an-email'), '');
  assert.equal(normalizeEmail(123 as unknown), '');
  assert.equal(normalizeEmail(undefined), '');
});

test('htmlToText strips tags, scripts/styles, and decodes entities', () => {
  const html =
    '<style>.x{}</style><p>Hello&nbsp;<b>World</b></p><script>evil()</script> a &amp; b';
  const txt = htmlToText(html);
  assert.equal(txt, 'Hello World a & b');
});

test('matchRecordByEmail: exact case-insensitive match across candidates', () => {
  const candidates: MatchCandidate[] = [
    { object: 'people', recordId: 'p1', emails: ['ALICE@acme.com'] },
    { object: 'leads', recordId: 'l1', emails: ['alice@acme.com', 'x@y.com'] },
    { object: 'people', recordId: 'p2', emails: ['bob@acme.com'] },
  ];
  const hits = matchRecordByEmail('Alice@Acme.com', candidates);
  assert.deepEqual(hits, [
    { object: 'people', recordId: 'p1' },
    { object: 'leads', recordId: 'l1' },
  ]);
});

test('matchRecordByEmail: no match / empty input → []', () => {
  const candidates: MatchCandidate[] = [
    { object: 'people', recordId: 'p1', emails: ['alice@acme.com'] },
  ];
  assert.deepEqual(matchRecordByEmail('nobody@nowhere.com', candidates), []);
  assert.deepEqual(matchRecordByEmail('', candidates), []);
  assert.deepEqual(matchRecordByEmail('alice@acme.com', []), []);
});

test('matchRecordByEmail: dedups duplicate (object,recordId)', () => {
  const candidates: MatchCandidate[] = [
    { object: 'people', recordId: 'p1', emails: ['a@b.com'] },
    { object: 'people', recordId: 'p1', emails: ['a@b.com'] },
  ];
  assert.deepEqual(matchRecordByEmail('a@b.com', candidates), [
    { object: 'people', recordId: 'p1' },
  ]);
});

test('buildActivityFromEmail: shape, dedup id, body text wins over html', () => {
  const draft = buildActivityFromEmail({
    from: 'Sender@Acme.com',
    fromName: 'Sender Name',
    subject: 'Re: Proposal',
    bodyText: 'plain body',
    bodyHtml: '<p>ignored html</p>',
    messageId: '<abc@mail>',
    receivedAt: '2026-06-13T10:00:00.000Z',
  });
  assert.equal(draft.type, 'EMAIL');
  assert.equal(draft.title, 'Email from Sender Name: Re: Proposal');
  assert.equal(draft.body, 'plain body');
  assert.equal(draft.externalSource, 'email-inbound');
  assert.equal(draft.externalId, '<abc@mail>');
  assert.deepEqual(draft.matchEmails, ['sender@acme.com']);
  assert.equal(draft.occurredAt, '2026-06-13T10:00:00.000Z');
});

test('buildActivityFromEmail: falls back to html, default subject, empty id', () => {
  const draft = buildActivityFromEmail({
    from: 'x@y.com',
    bodyHtml: '<b>hi there</b>',
  });
  assert.equal(draft.title, 'Email from x@y.com: (no subject)');
  assert.equal(draft.body, 'hi there');
  assert.equal(draft.externalId, '');
});

test('buildActivityFromCalendarEvent: matches external attendees + organizer, not self', () => {
  const draft = buildActivityFromCalendarEvent({
    id: 'evt123',
    summary: 'Discovery call',
    location: 'Zoom',
    description: 'Talk <b>shop</b>',
    start: { dateTime: '2026-06-14T15:00:00.000Z' },
    end: { dateTime: '2026-06-14T15:30:00.000Z' },
    organizer: { email: 'me@tenant.com' },
    attendees: [
      { email: 'me@tenant.com', self: true, organizer: true },
      { email: 'Prospect@Client.com', displayName: 'Prospect' },
    ],
  });
  assert.equal(draft.type, 'MEETING');
  assert.equal(draft.title, 'Meeting: Discovery call');
  assert.equal(draft.externalSource, 'google-calendar');
  assert.equal(draft.externalId, 'evt123');
  // organizer is self → excluded; only the external prospect remains.
  assert.deepEqual(draft.matchEmails, ['prospect@client.com']);
  assert.equal(draft.occurredAt, '2026-06-14T15:00:00.000Z');
  assert.match(draft.body, /When: 2026-06-14 15:00 UTC/);
  assert.match(draft.body, /Where: Zoom/);
  assert.match(draft.body, /Talk shop/);
});

test('buildActivityFromCalendarEvent: organizer counted when not on attendee list', () => {
  const draft = buildActivityFromCalendarEvent({
    id: 'e2',
    summary: 'Sync',
    start: { date: '2026-07-01' },
    organizer: { email: 'organizer@partner.com' },
    attendees: [{ email: 'someone@partner.com' }],
  });
  assert.deepEqual(
    draft.matchEmails.sort(),
    ['organizer@partner.com', 'someone@partner.com'],
  );
});

test('buildActivityFromCalendarEvent: no counterpart → empty matchEmails', () => {
  const draft = buildActivityFromCalendarEvent({
    id: 'solo',
    summary: 'Focus time',
    start: { dateTime: '2026-06-20T09:00:00.000Z' },
    attendees: [{ email: 'me@tenant.com', self: true }],
  });
  assert.deepEqual(draft.matchEmails, []);
  assert.equal(draft.externalId, 'solo');
});
