/**
 * Unit tests for the shared SabCRM phone lib (`src/lib/sabcrm/phone.ts`).
 *
 * Runs with Node's built-in `node:test` + `tsx` so no extra deps are required:
 *   npx tsx --test src/lib/sabcrm/__tests__/phone.test.ts
 *
 * Pure functions only — no Mongo, no Next runtime.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  digitsOnly,
  digitTolerantRegex,
  firstRecordPhone,
  normalizePhoneFields,
  phoneFromValue,
  toE164,
  toWaId,
} from '../phone';
import type { ObjectMetadata } from '../types';

describe('digitsOnly', () => {
  it('strips every non-digit', () => {
    assert.equal(digitsOnly('+91 98765-43210'), '919876543210');
    assert.equal(digitsOnly('(040) 1234 5678'), '04012345678');
    assert.equal(digitsOnly(''), '');
  });
});

describe('toE164', () => {
  it('defaults Indian national 10-digit numbers to +91', () => {
    assert.equal(toE164('9876543210'), '+919876543210');
    assert.equal(toE164('98765 43210'), '+919876543210');
  });

  it('honors an explicit defaultCc over the env fallback', () => {
    assert.equal(toE164('4155552671', '1'), '+14155552671');
  });

  it('keeps +91-prefixed numbers verbatim', () => {
    assert.equal(toE164('+91 98765 43210'), '+919876543210');
    assert.equal(toE164('+1 (415) 555-2671'), '+14155552671');
  });

  it('handles spaced / hyphenated national input', () => {
    assert.equal(toE164('98765-43210'), '+919876543210');
    assert.equal(toE164(' 987 654 3210 '), '+919876543210');
  });

  it('strips a national trunk 0 before adding the calling code', () => {
    assert.equal(toE164('098765-43210'), '+919876543210');
  });

  it('treats a 00 prefix as international', () => {
    assert.equal(toE164('0044 20 7946 0958'), '+442079460958');
    assert.equal(toE164('00919876543210'), '+919876543210');
  });

  it('rejects too-short input with null', () => {
    assert.equal(toE164('12345'), null);
    assert.equal(toE164('1234567'), null);
    assert.equal(toE164(''), null);
    assert.equal(toE164('   '), null);
    assert.equal(toE164('+12 34'), null);
  });

  it('assumes long bare digits already carry a country code', () => {
    assert.equal(toE164('919876543210'), '+919876543210');
  });
});

describe('toWaId', () => {
  it('is toE164 without the plus', () => {
    assert.equal(toWaId('+91 98765 43210'), '919876543210');
    assert.equal(toWaId('9876543210'), '919876543210');
    assert.equal(toWaId('12345'), null);
  });
});

describe('digitTolerantRegex', () => {
  const rx = (digits: string) => new RegExp(digitTolerantRegex(digits), 'i');

  it('matches formatted variants on the last 10 digits', () => {
    const r = rx('919876543210');
    assert.ok(r.test('+91 98765 43210'));
    assert.ok(r.test('098765-43210'));
    assert.ok(r.test('9876543210'));
    assert.ok(r.test('+91-98765-43210 '));
  });

  it('does not match a different number', () => {
    const r = rx('919876543210');
    assert.ok(!r.test('+91 98765 43211'));
    assert.ok(!r.test('1234567890'));
  });

  it('uses all digits when fewer than 10 are supplied', () => {
    const r = rx('12345678');
    assert.ok(r.test('1234-5678'));
    assert.ok(!r.test('1234-5679'));
  });

  it('never matches on empty input', () => {
    assert.ok(!rx('').test('9876543210'));
  });
});

describe('phoneFromValue', () => {
  it('reads plain strings and arrays', () => {
    assert.equal(phoneFromValue(' +91 98765 43210 '), '+91 98765 43210');
    assert.equal(phoneFromValue(['', '9876543210']), '9876543210');
  });

  it("reads Twenty's PHONES composite", () => {
    assert.equal(
      phoneFromValue({
        primaryPhoneNumber: '98765 43210',
        primaryPhoneCallingCode: '91',
        additionalPhones: [],
      }),
      '+91 98765 43210',
    );
  });

  it('falls back to additionalPhones when no primary number exists', () => {
    assert.equal(
      phoneFromValue({ additionalPhones: [{ number: '4155552671' }] }),
      '4155552671',
    );
  });

  it('returns empty for non-phone shapes', () => {
    assert.equal(phoneFromValue(null), '');
    assert.equal(phoneFromValue(42), '');
    assert.equal(phoneFromValue({}), '');
  });
});

describe('firstRecordPhone', () => {
  const object = {
    fields: [
      { key: 'mobile', type: 'PHONE' },
      { key: 'phones', type: 'PHONES' },
    ],
  } as unknown as ObjectMetadata;

  it('prefers typed PHONE/PHONES fields in field order', () => {
    assert.equal(
      firstRecordPhone(object, { mobile: '9876543210', phone: 'ignored' }),
      '9876543210',
    );
  });

  it('falls back to bare phone/phones keys without metadata', () => {
    assert.equal(firstRecordPhone(null, { phone: '+91 98765 43210' }), '+91 98765 43210');
    assert.equal(firstRecordPhone(null, {}), '');
  });
});

describe('normalizePhoneFields', () => {
  const fields = [
    { key: 'phone', type: 'PHONE' },
    { key: 'phones', type: 'PHONES' },
    { key: 'name', type: 'TEXT' },
  ];

  it('rewrites plain-string PHONE values to E.164', () => {
    const out = normalizePhoneFields(fields, { phone: '98765 43210', name: 'A' });
    assert.equal(out.phone, '+919876543210');
    assert.equal(out.name, 'A');
  });

  it('passes unparseable values through verbatim', () => {
    const out = normalizePhoneFields(fields, { phone: '12345' });
    assert.equal(out.phone, '12345');
  });

  it('never touches PHONES composites or non-string values', () => {
    const composite = { primaryPhoneNumber: '98765 43210' };
    const data = { phones: composite, phone: 123 as unknown };
    const out = normalizePhoneFields(fields, data as Record<string, unknown>);
    assert.equal(out, data); // unchanged → same reference
  });

  it('returns the same reference when nothing changes', () => {
    const data = { phone: '+919876543210' };
    assert.equal(normalizePhoneFields(fields, data), data);
  });
});
