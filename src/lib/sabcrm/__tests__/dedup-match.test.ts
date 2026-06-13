/**
 * Unit tests for the fuzzy-match PURE helpers (`../dedup-match`).
 *   npx tsx --test src/lib/sabcrm/__tests__/dedup-match.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeText,
  normalizePhone,
  jaroWinkler,
  levenSimilarity,
  fieldSimilarity,
  clusterByField,
  type DedupRecord,
} from '../dedup-match';

describe('normalize', () => {
  it('lowercases, trims, strips diacritics + punctuation', () => {
    assert.equal(normalizeText('  Café, Inc. '), 'cafe inc');
    assert.equal(normalizeText('ACME—Corp!'), 'acme corp');
  });
  it('phone keeps digits only', () => {
    assert.equal(normalizePhone('+1 (555) 123-4567'), '15551234567');
  });
});

describe('similarity', () => {
  it('jaroWinkler rewards common prefixes + tolerates transpositions', () => {
    assert.equal(jaroWinkler('martha', 'martha'), 1);
    assert.ok(jaroWinkler('martha', 'marhta') > 0.9); // transposition
    assert.ok(jaroWinkler('dixon', 'dicksonx') > 0.7);
  });
  it('levenSimilarity is 1 for equal, lower for edits', () => {
    assert.equal(levenSimilarity('abc', 'abc'), 1);
    assert.ok(levenSimilarity('kitten', 'sitting') < 1);
    assert.ok(levenSimilarity('kitten', 'sitting') > 0.4);
  });
  it('fieldSimilarity normalizes then scores; blanks score 0', () => {
    assert.equal(fieldSimilarity('Acme Inc', 'acme, inc.'), 1); // normalize → equal
    assert.ok(fieldSimilarity('Jon Smith', 'John Smith') > 0.85);
    assert.equal(fieldSimilarity('', 'anything'), 0);
    assert.equal(fieldSimilarity('+1 555 000', '15 55000', 'phone'), 1);
  });
});

describe('clusterByField', () => {
  const recs: DedupRecord[] = [
    { id: '1', data: { name: 'Acme Inc' } },
    { id: '2', data: { name: 'acme, inc.' } },
    { id: '3', data: { name: 'Globex' } },
    { id: '4', data: { name: 'Acme Incorporated' } },
    { id: '5', data: { name: '' } },
  ];

  it('groups near-duplicates and ignores singletons + blanks', () => {
    const clusters = clusterByField(recs, 'name', 0.8);
    // Acme variants cluster together; Globex + blank do not.
    const acme = clusters.find((c) => c.members.some((m) => m.id === '1'));
    assert.ok(acme, 'expected an Acme cluster');
    const ids = acme!.members.map((m) => m.id).sort();
    assert.ok(ids.includes('1') && ids.includes('2'));
    assert.ok(!clusters.some((c) => c.members.some((m) => m.id === '3'))); // Globex alone
    assert.ok(!clusters.some((c) => c.members.some((m) => m.id === '5'))); // blank excluded
  });

  it('a high threshold splits looser matches', () => {
    const strict = clusterByField(recs, 'name', 0.99);
    // "Acme Inc" vs "acme, inc." normalize-equal (score 1) still cluster;
    // "Acme Incorporated" is looser and should drop out at 0.99.
    const acme = strict.find((c) => c.members.some((m) => m.id === '1'));
    assert.ok(acme);
    assert.ok(!acme!.members.some((m) => m.id === '4'));
  });
});
