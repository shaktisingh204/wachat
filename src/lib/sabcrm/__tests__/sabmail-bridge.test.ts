/**
 * Unit tests for the pure helpers behind the SabCRM → SabMail send bridge
 * (`src/lib/sabcrm/sabmail-bridge.pure.ts`).
 *
 * Pure address / envelope logic only — no Mongo, no network, no `server-only`.
 * The server bridge (`sabmail-bridge.server.ts`) re-exports these same
 * functions, so testing the pure module covers the bridge's logic surface.
 *
 * Run:
 *   npx tsx --test src/lib/sabcrm/__tests__/sabmail-bridge.test.ts
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  isEmailLike,
  normalizeAddressList,
  buildRecipients,
  toAddressDescriptors,
  normalizeReferences,
} from '../sabmail-bridge.pure';

describe('isEmailLike', () => {
  it('accepts plausible addresses', () => {
    assert.equal(isEmailLike('a@b.co'), true);
    assert.equal(isEmailLike('first.last+tag@sub.example.com'), true);
  });
  it('rejects malformed values', () => {
    assert.equal(isEmailLike('nope'), false);
    assert.equal(isEmailLike('a@b'), false);
    assert.equal(isEmailLike('a @b.co'), false);
    assert.equal(isEmailLike(''), false);
  });
});

describe('normalizeAddressList', () => {
  it('handles a single string', () => {
    assert.deepEqual(normalizeAddressList('  joe@x.com '), ['joe@x.com']);
  });
  it('splits comma-separated values', () => {
    assert.deepEqual(normalizeAddressList('a@x.com, b@y.com'), [
      'a@x.com',
      'b@y.com',
    ]);
  });
  it('handles arrays + nested commas', () => {
    assert.deepEqual(normalizeAddressList(['a@x.com', 'b@y.com,c@z.com']), [
      'a@x.com',
      'b@y.com',
      'c@z.com',
    ]);
  });
  it('drops blanks and non-email noise', () => {
    assert.deepEqual(normalizeAddressList(['', '  ', 'garbage', 'ok@x.com']), [
      'ok@x.com',
    ]);
  });
  it('de-dups case-insensitively, keeping first spelling + order', () => {
    assert.deepEqual(
      normalizeAddressList(['Joe@X.com', 'b@y.com', 'joe@x.COM']),
      ['Joe@X.com', 'b@y.com'],
    );
  });
  it('returns [] for null/undefined', () => {
    assert.deepEqual(normalizeAddressList(null), []);
    assert.deepEqual(normalizeAddressList(undefined), []);
  });
  it('ignores non-string array entries', () => {
    // @ts-expect-error — intentionally passing junk to prove robustness.
    assert.deepEqual(normalizeAddressList([42, null, 'ok@x.com']), ['ok@x.com']);
  });
});

describe('buildRecipients', () => {
  it('builds to/cc/bcc, omitting empty optionals', () => {
    assert.deepEqual(buildRecipients({ to: 'a@x.com' }), { to: ['a@x.com'] });
  });
  it('includes cc/bcc when present', () => {
    assert.deepEqual(
      buildRecipients({ to: 'a@x.com', cc: 'b@y.com', bcc: ['c@z.com'] }),
      { to: ['a@x.com'], cc: ['b@y.com'], bcc: ['c@z.com'] },
    );
  });
  it('returns null when no deliverable `to` survives cleaning', () => {
    assert.equal(buildRecipients({ to: '' }), null);
    assert.equal(buildRecipients({ to: 'garbage', cc: 'b@y.com' }), null);
    assert.equal(buildRecipients({ to: [] }), null);
  });
});

describe('toAddressDescriptors', () => {
  it('maps to { email } descriptors', () => {
    assert.deepEqual(toAddressDescriptors(['a@x.com', 'b@y.com']), [
      { email: 'a@x.com' },
      { email: 'b@y.com' },
    ]);
  });
  it('maps an empty list to an empty array', () => {
    assert.deepEqual(toAddressDescriptors([]), []);
  });
});

describe('normalizeReferences', () => {
  it('returns [] when nothing is supplied', () => {
    assert.deepEqual(normalizeReferences(undefined), []);
    assert.deepEqual(normalizeReferences(null), []);
  });
  it('splits a whitespace-joined header string', () => {
    assert.deepEqual(normalizeReferences('<a@x> <b@x>'), ['<a@x>', '<b@x>']);
  });
  it('appends inReplyTo as the last entry (RFC 5322)', () => {
    assert.deepEqual(normalizeReferences(['<a@x>'], '<b@x>'), [
      '<a@x>',
      '<b@x>',
    ]);
  });
  it('does not duplicate inReplyTo already in references', () => {
    assert.deepEqual(normalizeReferences(['<a@x>', '<b@x>'], '<b@x>'), [
      '<a@x>',
      '<b@x>',
    ]);
  });
  it('de-dups + trims across array and string forms', () => {
    assert.deepEqual(
      normalizeReferences(' <a@x>  <b@x> <a@x> ', '<c@x>'),
      ['<a@x>', '<b@x>', '<c@x>'],
    );
  });
});
