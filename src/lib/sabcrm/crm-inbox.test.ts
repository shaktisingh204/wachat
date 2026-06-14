/**
 * Unit tests for the PURE shared-CRM-inbox logic (`./crm-inbox.ts`):
 * message→row mapping (`mailDocToInboxRow`), record-match selection
 * (`matchInboxRowToRecord`), and the record-label derivation
 * (`deriveRecordLabel`).
 *
 * Run: npx tsx --test src/lib/sabcrm/crm-inbox.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { MailMessageDoc } from '../rust-client/mail-messages.ts';
import {
  deriveRecordLabel,
  looksLikeEmail,
  normaliseAddress,
  matchInboxRowToRecord,
  mailDocToInboxRow,
  type CrmInboxMatchCandidate,
} from './crm-inbox.ts';

/* --- normaliseAddress / looksLikeEmail ---------------------------------- */

test('normaliseAddress trims + lowercases, tolerates nullish', () => {
  assert.equal(normaliseAddress('  Jane@ACME.com '), 'jane@acme.com');
  assert.equal(normaliseAddress(undefined), '');
  assert.equal(normaliseAddress(null), '');
});

test('looksLikeEmail accepts real addresses and rejects junk', () => {
  assert.ok(looksLikeEmail('a@b.co'));
  assert.ok(!looksLikeEmail('no-at-sign'));
  assert.ok(!looksLikeEmail('a@b'));
  assert.ok(!looksLikeEmail('a b@c.com'));
});

/* --- deriveRecordLabel -------------------------------------------------- */

test('deriveRecordLabel prefers name-ish keys in order', () => {
  assert.equal(deriveRecordLabel({ name: 'Acme Inc' }, 'r1'), 'Acme Inc');
  assert.equal(deriveRecordLabel({ title: 'CEO', name: '' }, 'r1'), 'CEO');
  assert.equal(
    deriveRecordLabel({ companyName: 'Globex' }, 'r1'),
    'Globex',
  );
});

test('deriveRecordLabel joins firstName + lastName', () => {
  assert.equal(
    deriveRecordLabel({ firstName: 'Jane', lastName: 'Doe' }, 'r1'),
    'Jane Doe',
  );
  assert.equal(deriveRecordLabel({ firstName: 'Solo' }, 'r1'), 'Solo');
});

test('deriveRecordLabel reads a composite name object', () => {
  assert.equal(
    deriveRecordLabel({ name: { firstName: 'Ada', lastName: 'Lovelace' } }, 'r1'),
    'Ada Lovelace',
  );
});

test('deriveRecordLabel falls back to a valid email, then to Record <id>', () => {
  assert.equal(
    deriveRecordLabel({ email: 'jane@acme.com' }, 'r1'),
    'jane@acme.com',
  );
  // garbage email is NOT used as a label
  assert.equal(deriveRecordLabel({ email: 'not-an-email' }, 'abcdef123456'), 'Record 123456');
  assert.equal(deriveRecordLabel({}, 'abcdef123456'), 'Record 123456');
  assert.equal(deriveRecordLabel(null, 'abcdef123456'), 'Record 123456');
});

/* --- matchInboxRowToRecord ---------------------------------------------- */

test('matchInboxRowToRecord returns null for empty/undefined', () => {
  assert.equal(matchInboxRowToRecord([]), null);
  assert.equal(matchInboxRowToRecord(undefined), null);
  assert.equal(matchInboxRowToRecord(null), null);
});

test('matchInboxRowToRecord picks the lowest rank', () => {
  const cands: CrmInboxMatchCandidate[] = [
    { object: 'leads', recordId: 'l1', label: 'Lead', rank: 2 },
    { object: 'people', recordId: 'p1', label: 'Person', rank: 0 },
    { object: 'companies', recordId: 'c1', label: 'Co', rank: 1 },
  ];
  const m = matchInboxRowToRecord(cands);
  assert.deepEqual(m, { object: 'people', recordId: 'p1', label: 'Person' });
});

test('matchInboxRowToRecord is stable on a rank tie (first wins)', () => {
  const cands: CrmInboxMatchCandidate[] = [
    { object: 'people', recordId: 'p1', label: 'First', rank: 0 },
    { object: 'people', recordId: 'p2', label: 'Second', rank: 0 },
  ];
  assert.equal(matchInboxRowToRecord(cands)?.recordId, 'p1');
});

test('matchInboxRowToRecord treats missing rank as 0', () => {
  const cands: CrmInboxMatchCandidate[] = [
    { object: 'people', recordId: 'p1', label: 'No rank' },
    { object: 'leads', recordId: 'l1', label: 'Ranked', rank: 5 },
  ];
  assert.equal(matchInboxRowToRecord(cands)?.recordId, 'p1');
});

test('matchInboxRowToRecord dedupes object+recordId, skips invalid', () => {
  const cands: CrmInboxMatchCandidate[] = [
    { object: '', recordId: 'x', label: 'invalid' },
    { object: 'people', recordId: 'p1', label: 'A', rank: 1 },
    { object: 'people', recordId: 'p1', label: 'A-dup', rank: 0 },
  ];
  // The dedupe keeps the FIRST occurrence (rank 1); the lower-rank dup is dropped.
  assert.equal(matchInboxRowToRecord(cands)?.label, 'A');
});

/* --- mailDocToInboxRow -------------------------------------------------- */

function doc(partial: Partial<MailMessageDoc>): MailMessageDoc {
  return {
    userId: 'u1',
    accountId: 'a1',
    folderId: 'f1',
    unread: false,
    starred: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...partial,
  } as MailMessageDoc;
}

test('mailDocToInboxRow flattens a message + match', () => {
  const row = mailDocToInboxRow(
    doc({
      _id: 'm1',
      subject: 'Re: Proposal',
      snippet: '  thanks  for   the   info ',
      fromAddr: { email: 'Jane@Acme.com', name: 'Jane Doe' },
      receivedAt: '2026-06-10T12:00:00.000Z',
      unread: true,
    }),
    { object: 'people', recordId: 'p1', label: 'Jane Doe' },
  );
  assert.equal(row.messageId, 'mail-m1');
  assert.equal(row.from, 'jane@acme.com');
  assert.equal(row.fromName, 'Jane Doe');
  assert.equal(row.subject, 'Re: Proposal');
  assert.equal(row.snippet, 'thanks for the info');
  assert.equal(row.receivedAt, '2026-06-10T12:00:00.000Z');
  assert.equal(row.unread, true);
  assert.deepEqual(row.match, { object: 'people', recordId: 'p1', label: 'Jane Doe' });
});

test('mailDocToInboxRow degrades subject/match and prefers receivedAt over createdAt', () => {
  const row = mailDocToInboxRow(
    doc({ _id: 'm2', fromAddr: { email: 'x@y.com' }, sentAt: '2026-06-05T00:00:00.000Z' }),
    null,
  );
  assert.equal(row.subject, '(no subject)');
  assert.equal(row.match, null);
  assert.equal(row.fromName, undefined);
  // no receivedAt -> falls back to sentAt before createdAt
  assert.equal(row.receivedAt, '2026-06-05T00:00:00.000Z');
});

test('mailDocToInboxRow builds a stable id when _id and messageId are absent', () => {
  const row = mailDocToInboxRow(
    doc({ fromAddr: { email: 'a@b.com' }, receivedAt: '2026-06-09T00:00:00.000Z' }),
    null,
  );
  assert.equal(row.messageId, 'mail-a@b.com|2026-06-09T00:00:00.000Z');
});
