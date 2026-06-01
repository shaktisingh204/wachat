/**
 * Unit tests for `src/lib/sabcrm/metadata-migrations.server.ts`.
 *
 * Covers only the exported pure function `coerceValue` — no Mongo
 * connection is required and no async operations are exercised.
 *
 * Run:
 *   npx tsx --test src/lib/sabcrm/__tests__/metadata-migrations.test.ts
 *
 * The `server-only` marker is satisfied by the stub in
 * `node_modules/server-only/index.js` (a no-op file created for the
 * test environment). The `./db` import is only evaluated for its type
 * exports; `sabcrmRecords()` is never called from a pure test.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { coerceValue } from '../metadata-migrations.server';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Assert that a CoercionOutcome is lossless with the given value. */
function assertClean(actual: { value: unknown; lossy: boolean }, expected: unknown): void {
  assert.equal(actual.lossy, false, `expected lossy=false, got ${JSON.stringify(actual)}`);
  assert.deepEqual(actual.value, expected);
}

/** Assert that a CoercionOutcome is lossy with the given cleared value. */
function assertLossy(actual: { value: unknown; lossy: boolean }, expected: unknown): void {
  assert.equal(actual.lossy, true, `expected lossy=true, got ${JSON.stringify(actual)}`);
  assert.deepEqual(actual.value, expected);
}

/* -------------------------------------------------------------------------- */
/* Empty / absent source values                                               */
/* -------------------------------------------------------------------------- */

describe('coerceValue — empty source values', () => {
  it('null source → null, lossy:false for scalar targets', () => {
    assertClean(coerceValue(null, 'TEXT', 'NUMBER'), null);
    assertClean(coerceValue(null, 'TEXT', 'BOOLEAN'), null);
    assertClean(coerceValue(null, 'TEXT', 'DATE'), null);
    assertClean(coerceValue(null, 'TEXT', 'DATE_TIME'), null);
    assertClean(coerceValue(null, 'TEXT', 'TEXT'), null);
  });

  it('undefined source → null, lossy:false for scalar targets', () => {
    assertClean(coerceValue(undefined, 'TEXT', 'NUMBER'), null);
    assertClean(coerceValue(undefined, 'NUMBER', 'BOOLEAN'), null);
  });

  it('empty string source → null, lossy:false for scalar targets', () => {
    assertClean(coerceValue('', 'TEXT', 'NUMBER'), null);
    assertClean(coerceValue('', 'TEXT', 'BOOLEAN'), null);
    assertClean(coerceValue('', 'TEXT', 'DATE'), null);
  });

  it('empty array source → null, lossy:false for scalar targets', () => {
    assertClean(coerceValue([], 'MULTI_SELECT', 'TEXT'), null);
    assertClean(coerceValue([], 'MULTI_SELECT', 'SELECT'), null);
    assertClean(coerceValue([], 'MULTI_SELECT', 'NUMBER'), null);
  });

  it('any empty source → [], lossy:false for MULTI_SELECT target', () => {
    assertClean(coerceValue(null,      'TEXT',         'MULTI_SELECT'), []);
    assertClean(coerceValue(undefined, 'TEXT',         'MULTI_SELECT'), []);
    assertClean(coerceValue('',        'TEXT',         'MULTI_SELECT'), []);
    assertClean(coerceValue([],        'MULTI_SELECT', 'MULTI_SELECT'), []);
  });
});

/* -------------------------------------------------------------------------- */
/* Same-type no-op                                                            */
/* -------------------------------------------------------------------------- */

describe('coerceValue — same-type no-op', () => {
  it('returns value unchanged with lossy:false when fromType === toType', () => {
    assertClean(coerceValue('hello',   'TEXT',         'TEXT'),         'hello');
    assertClean(coerceValue(42,        'NUMBER',       'NUMBER'),       42);
    assertClean(coerceValue(true,      'BOOLEAN',      'BOOLEAN'),      true);
    assertClean(coerceValue('pending', 'SELECT',       'SELECT'),       'pending');
    assertClean(coerceValue(['a','b'], 'MULTI_SELECT', 'MULTI_SELECT'), ['a','b']);
    assertClean(coerceValue('2024-03-15', 'DATE',      'DATE'),         '2024-03-15');
  });
});

/* -------------------------------------------------------------------------- */
/* → TEXT / EMAIL / PHONE / LINK                                             */
/* -------------------------------------------------------------------------- */

describe('coerceValue → TEXT (and TEXT-like: EMAIL, PHONE, LINK)', () => {
  it('NUMBER → TEXT: stringifies finite number', () => {
    assertClean(coerceValue(42,  'NUMBER', 'TEXT'), '42');
    assertClean(coerceValue(3.14, 'NUMBER', 'TEXT'), '3.14');
    assertClean(coerceValue(0,   'NUMBER', 'TEXT'), '0');
  });

  it('NUMBER → TEXT: Infinity stringifies (not lossy — representation exists)', () => {
    assertClean(coerceValue(Infinity, 'NUMBER', 'TEXT'), 'Infinity');
  });

  it('BOOLEAN → TEXT: stringifies true/false', () => {
    assertClean(coerceValue(true,  'BOOLEAN', 'TEXT'), 'true');
    assertClean(coerceValue(false, 'BOOLEAN', 'TEXT'), 'false');
  });

  it('MULTI_SELECT → TEXT: joins non-empty elements with ", "', () => {
    assertClean(coerceValue(['a', 'b', 'c'], 'MULTI_SELECT', 'TEXT'), 'a, b, c');
  });

  it('MULTI_SELECT → TEXT: filters empty elements before joining', () => {
    assertClean(coerceValue(['a', '', 'b'], 'MULTI_SELECT', 'TEXT'), 'a, b');
  });

  it('MULTI_SELECT → TEXT: single-element array joins cleanly', () => {
    assertClean(coerceValue(['only'], 'MULTI_SELECT', 'TEXT'), 'only');
  });

  it('RELATION → TEXT: object/ref value cannot be free text — cleared (lossy)', () => {
    assertLossy(coerceValue({ id: 'abc' }, 'RELATION', 'TEXT'), null);
  });

  it('NUMBER → EMAIL: same stringify path', () => {
    assertClean(coerceValue(42, 'NUMBER', 'EMAIL'), '42');
  });

  it('NUMBER → PHONE: same stringify path', () => {
    assertClean(coerceValue(42, 'NUMBER', 'PHONE'), '42');
  });

  it('TEXT → LINK: string pass-through', () => {
    assertClean(coerceValue('https://example.com', 'TEXT', 'LINK'), 'https://example.com');
  });
});

/* -------------------------------------------------------------------------- */
/* → NUMBER / CURRENCY / RATING                                               */
/* -------------------------------------------------------------------------- */

describe('coerceValue → NUMBER (and CURRENCY, RATING)', () => {
  it('TEXT → NUMBER: valid numeric string', () => {
    assertClean(coerceValue('42',    'TEXT', 'NUMBER'), 42);
    assertClean(coerceValue('3.14',  'TEXT', 'NUMBER'), 3.14);
    assertClean(coerceValue('  7  ', 'TEXT', 'NUMBER'), 7);
  });

  it('TEXT → NUMBER: non-numeric string is lossy (cleared)', () => {
    assertLossy(coerceValue('hello', 'TEXT', 'NUMBER'), null);
    assertLossy(coerceValue('NaN',   'TEXT', 'NUMBER'), null);
    assertLossy(coerceValue('abc',   'TEXT', 'NUMBER'), null);
  });

  it('BOOLEAN → NUMBER: true→1, false→0', () => {
    assertClean(coerceValue(true,  'BOOLEAN', 'NUMBER'), 1);
    assertClean(coerceValue(false, 'BOOLEAN', 'NUMBER'), 0);
  });

  it('TEXT → CURRENCY: parses float string', () => {
    assertClean(coerceValue('3.14', 'TEXT', 'CURRENCY'), 3.14);
  });

  it('TEXT → RATING: parses integer string', () => {
    assertClean(coerceValue('5', 'TEXT', 'RATING'), 5);
  });
});

/* -------------------------------------------------------------------------- */
/* → BOOLEAN                                                                  */
/* -------------------------------------------------------------------------- */

describe('coerceValue → BOOLEAN', () => {
  it('TEXT → BOOLEAN: truthy literals', () => {
    assertClean(coerceValue('true',  'TEXT', 'BOOLEAN'), true);
    assertClean(coerceValue('yes',   'TEXT', 'BOOLEAN'), true);
    assertClean(coerceValue('1',     'TEXT', 'BOOLEAN'), true);
    assertClean(coerceValue('on',    'TEXT', 'BOOLEAN'), true);
  });

  it('TEXT → BOOLEAN: falsy literals', () => {
    assertClean(coerceValue('false', 'TEXT', 'BOOLEAN'), false);
    assertClean(coerceValue('no',    'TEXT', 'BOOLEAN'), false);
    assertClean(coerceValue('0',     'TEXT', 'BOOLEAN'), false);
    assertClean(coerceValue('off',   'TEXT', 'BOOLEAN'), false);
  });

  it('TEXT → BOOLEAN: unrecognized string is lossy (cleared)', () => {
    assertLossy(coerceValue('maybe', 'TEXT', 'BOOLEAN'), null);
    assertLossy(coerceValue('y',     'TEXT', 'BOOLEAN'), null);
  });

  it('NUMBER → BOOLEAN: 1→true, 0→false', () => {
    assertClean(coerceValue(1, 'NUMBER', 'BOOLEAN'), true);
    assertClean(coerceValue(0, 'NUMBER', 'BOOLEAN'), false);
  });

  it('NUMBER → BOOLEAN: other numbers are lossy (cleared)', () => {
    assertLossy(coerceValue(2,   'NUMBER', 'BOOLEAN'), null);
    assertLossy(coerceValue(-1,  'NUMBER', 'BOOLEAN'), null);
    assertLossy(coerceValue(0.5, 'NUMBER', 'BOOLEAN'), null);
  });
});

/* -------------------------------------------------------------------------- */
/* → DATE                                                                     */
/* -------------------------------------------------------------------------- */

describe('coerceValue → DATE', () => {
  it('ISO datetime string → slices to YYYY-MM-DD', () => {
    assertClean(
      coerceValue('2024-03-15T00:00:00.000Z', 'TEXT', 'DATE'),
      '2024-03-15',
    );
  });

  it('date-only string → preserved as YYYY-MM-DD', () => {
    assertClean(coerceValue('2024-01-01', 'TEXT', 'DATE'), '2024-01-01');
  });

  it('unix timestamp (ms) → DATE string', () => {
    assertClean(coerceValue(0, 'NUMBER', 'DATE'), '1970-01-01');
  });

  it('Date object → DATE string', () => {
    const d = new Date('2024-06-15T12:00:00Z');
    const result = coerceValue(d, 'DATE_TIME', 'DATE');
    assert.equal(result.lossy, false);
    // Value is a YYYY-MM-DD slice; timezone-independent check:
    assert.match(result.value as string, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('invalid date string → lossy (cleared)', () => {
    assertLossy(coerceValue('not-a-date',  'TEXT', 'DATE'), null);
    assertLossy(coerceValue('32/01/2024',  'TEXT', 'DATE'), null);
  });
});

/* -------------------------------------------------------------------------- */
/* → DATE_TIME                                                                */
/* -------------------------------------------------------------------------- */

describe('coerceValue → DATE_TIME', () => {
  it('date-only string → full ISO datetime', () => {
    const result = coerceValue('2024-03-15', 'TEXT', 'DATE_TIME');
    assertClean(result, '2024-03-15T00:00:00.000Z');
  });

  it('unix timestamp (ms) → ISO datetime', () => {
    assertClean(coerceValue(1704067200000, 'NUMBER', 'DATE_TIME'), '2024-01-01T00:00:00.000Z');
  });

  it('invalid string → lossy (cleared)', () => {
    assertLossy(coerceValue('not-a-date', 'TEXT', 'DATE_TIME'), null);
  });
});

/* -------------------------------------------------------------------------- */
/* → SELECT                                                                   */
/* -------------------------------------------------------------------------- */

describe('coerceValue → SELECT', () => {
  it('TEXT → SELECT: string passes through as single token', () => {
    assertClean(coerceValue('active', 'TEXT', 'SELECT'), 'active');
  });

  it('MULTI_SELECT → SELECT: single-element array collapses losslessly', () => {
    assertClean(coerceValue(['only'], 'MULTI_SELECT', 'SELECT'), 'only');
  });

  it('MULTI_SELECT → SELECT: multi-element array takes first element (lossy)', () => {
    assertLossy(coerceValue(['a', 'b'], 'MULTI_SELECT', 'SELECT'), 'a');
  });

  it('MULTI_SELECT → SELECT: three-element array takes first element (lossy)', () => {
    assertLossy(coerceValue(['x', 'y', 'z'], 'MULTI_SELECT', 'SELECT'), 'x');
  });

  it('MULTI_SELECT → SELECT: array with only empty elements → null, lossless', () => {
    assertClean(coerceValue(['', null, undefined], 'MULTI_SELECT', 'SELECT'), null);
  });

  it('NUMBER → SELECT: stringified number becomes single token', () => {
    assertClean(coerceValue(42, 'NUMBER', 'SELECT'), '42');
  });
});

/* -------------------------------------------------------------------------- */
/* → MULTI_SELECT                                                             */
/* -------------------------------------------------------------------------- */

describe('coerceValue → MULTI_SELECT', () => {
  it('TEXT → MULTI_SELECT: wraps single string in array', () => {
    assertClean(coerceValue('tag', 'TEXT', 'MULTI_SELECT'), ['tag']);
  });

  it('SELECT → MULTI_SELECT: wraps scalar in array', () => {
    assertClean(coerceValue('active', 'SELECT', 'MULTI_SELECT'), ['active']);
  });

  it('array of strings → MULTI_SELECT: passes through', () => {
    assertClean(coerceValue(['a', 'b', 'c'], 'SELECT', 'MULTI_SELECT'), ['a', 'b', 'c']);
  });

  it('BOOLEAN → MULTI_SELECT: wraps stringified boolean', () => {
    assertClean(coerceValue(true,  'BOOLEAN', 'MULTI_SELECT'), ['true']);
    assertClean(coerceValue(false, 'BOOLEAN', 'MULTI_SELECT'), ['false']);
  });

  it('NUMBER → MULTI_SELECT: wraps stringified number', () => {
    assertClean(coerceValue(42, 'NUMBER', 'MULTI_SELECT'), ['42']);
  });
});

/* -------------------------------------------------------------------------- */
/* → RELATION / FILE                                                          */
/* -------------------------------------------------------------------------- */

describe('coerceValue → RELATION / FILE', () => {
  it('TEXT → RELATION: any scalar is cleared (lossy) — no safe automatic coercion', () => {
    assertLossy(coerceValue('some-id', 'TEXT',   'RELATION'), null);
    assertLossy(coerceValue(42,        'NUMBER', 'RELATION'), null);
    assertLossy(coerceValue(true,      'BOOLEAN','RELATION'), null);
  });

  it('TEXT → FILE: any scalar is cleared (lossy)', () => {
    assertLossy(coerceValue('some-id', 'TEXT', 'FILE'), null);
  });

  it('RELATION → TEXT: object ref value cannot be free text (lossy)', () => {
    assertLossy(coerceValue({ id: 'abc', label: 'Acme' }, 'RELATION', 'TEXT'), null);
  });
});

/* -------------------------------------------------------------------------- */
/* Lossy detection — data-loss summary                                        */
/* -------------------------------------------------------------------------- */

describe('coerceValue — lossy flag accuracy', () => {
  it('lossy:false when no information is discarded', () => {
    const cases: Array<[unknown, Parameters<typeof coerceValue>[1], Parameters<typeof coerceValue>[2]]> = [
      [42,      'NUMBER',  'TEXT'],
      ['3.14',  'TEXT',    'NUMBER'],
      [true,    'BOOLEAN', 'TEXT'],
      ['1',     'TEXT',    'BOOLEAN'],
      ['tag',   'TEXT',    'SELECT'],
      ['tag',   'TEXT',    'MULTI_SELECT'],
    ];
    for (const [v, from, to] of cases) {
      const r = coerceValue(v, from, to);
      assert.equal(r.lossy, false, `${String(v)} ${from}→${to} should be lossless`);
      assert.notEqual(r.value, null, `${String(v)} ${from}→${to} value should not be null`);
    }
  });

  it('lossy:true when value must be cleared', () => {
    const cases: Array<[unknown, Parameters<typeof coerceValue>[1], Parameters<typeof coerceValue>[2]]> = [
      ['hello',   'TEXT',         'NUMBER'],
      ['maybe',   'TEXT',         'BOOLEAN'],
      [2,         'NUMBER',       'BOOLEAN'],
      ['bad date','TEXT',         'DATE'],
      ['some-id', 'TEXT',         'RELATION'],
      ['some-id', 'TEXT',         'FILE'],
      [['a','b'], 'MULTI_SELECT', 'SELECT'],  // multi → single: 2 elements → lossy
    ];
    for (const [v, from, to] of cases) {
      const r = coerceValue(v, from, to);
      assert.equal(r.lossy, true, `${String(v)} ${from}→${to} should be lossy`);
    }
  });
});
