/**
 * Unit tests for the indexed-text-search PURE helpers (`../text-search`).
 *   npx tsx --test src/lib/sabcrm/__tests__/text-search.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTextQuery,
  escapeRegExp,
  firstMatch,
  rankSnippet,
  bestSnippetField,
} from '../text-search';

describe('buildTextQuery — tokens', () => {
  it('splits a plain term into OR-matched tokens', () => {
    const q = buildTextQuery('acme corp');
    assert.equal(q.hasTerms, true);
    assert.equal(q.search, 'acme corp');
    assert.deepEqual(q.terms, ['acme', 'corp']);
    assert.deepEqual(q.phrases, []);
  });

  it('collapses whitespace and trims', () => {
    const q = buildTextQuery('   foo \t  bar  ');
    assert.equal(q.search, 'foo bar');
    assert.deepEqual(q.terms, ['foo', 'bar']);
  });

  it('de-duplicates tokens case-insensitively, preserving order', () => {
    const q = buildTextQuery('Acme acme ACME corp');
    assert.deepEqual(q.terms, ['Acme', 'corp']);
    assert.equal(q.search, 'Acme corp');
  });

  it('returns no terms for an empty / whitespace / non-string term', () => {
    assert.equal(buildTextQuery('').hasTerms, false);
    assert.equal(buildTextQuery('   ').hasTerms, false);
    // @ts-expect-error — defends against a non-string at runtime.
    assert.equal(buildTextQuery(null).hasTerms, false);
  });
});

describe('buildTextQuery — phrases', () => {
  it('preserves a quoted phrase as an exact phrase', () => {
    const q = buildTextQuery('"acme corp" widget');
    assert.deepEqual(q.phrases, ['acme corp']);
    assert.deepEqual(q.terms, ['widget']);
    assert.equal(q.search, '"acme corp" widget');
  });

  it('handles multiple phrases plus free tokens', () => {
    const q = buildTextQuery('"big deal" north "west region"');
    assert.deepEqual(q.phrases, ['big deal', 'west region']);
    assert.deepEqual(q.terms, ['north']);
    assert.equal(q.search, '"big deal" "west region" north');
  });

  it('drops an unterminated quote (treats the rest as tokens)', () => {
    const q = buildTextQuery('hello "world');
    assert.deepEqual(q.phrases, []);
    assert.deepEqual(q.terms, ['hello', 'world']);
    assert.equal(q.search, 'hello world');
  });
});

describe('buildTextQuery — sanitisation / injection defence', () => {
  it('strips a leading negation so a term cannot empty the result set', () => {
    const q = buildTextQuery('-acme corp');
    assert.deepEqual(q.terms, ['acme', 'corp']);
    assert.ok(!q.search.includes('-acme'));
  });

  it('strips stray quotes and backslashes from tokens', () => {
    const q = buildTextQuery('ab\\cd e"f');
    assert.deepEqual(q.terms, ['abcd', 'ef']);
  });

  it('strips inner quotes/backslashes from a phrase before re-quoting', () => {
    const q = buildTextQuery('"a\\b"');
    assert.deepEqual(q.phrases, ['a\\b']);
    assert.equal(q.search, '"ab"');
  });

  it('caps the number of forwarded tokens', () => {
    const many = Array.from({ length: 40 }, (_, i) => `t${i}`).join(' ');
    const q = buildTextQuery(many);
    assert.equal(q.terms.length, 24);
  });
});

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    assert.equal(escapeRegExp('a.b*c?'), 'a\\.b\\*c\\?');
    assert.equal(escapeRegExp('(x)[y]'), '\\(x\\)\\[y\\]');
  });
});

describe('firstMatch', () => {
  it('finds the earliest case-insensitive match', () => {
    assert.deepEqual(firstMatch('Hello Acme World', ['acme']), {
      index: 6,
      length: 4,
    });
  });

  it('returns the earliest across several needles, shortest on a tie', () => {
    assert.deepEqual(firstMatch('foobar', ['foobar', 'foo']), {
      index: 0,
      length: 3,
    });
  });

  it('returns null when nothing matches / inputs are empty', () => {
    assert.equal(firstMatch('abc', ['xyz']), null);
    assert.equal(firstMatch('', ['x']), null);
    assert.equal(firstMatch('abc', ['']), null);
  });
});

describe('rankSnippet', () => {
  it('centres a window around the match with the offset reported', () => {
    const long =
      'The quick brown fox jumps over the lazy dog near the riverbank at dawn';
    const snip = rankSnippet(long, ['lazy'], 10);
    assert.ok(snip.text.includes('lazy'));
    assert.equal(snip.text.slice(snip.matchStart, snip.matchStart + snip.matchLength), 'lazy');
    assert.ok(snip.text.startsWith('…'));
    assert.ok(snip.text.endsWith('…'));
  });

  it('does not prefix an ellipsis when the match is at the start', () => {
    const snip = rankSnippet('Acme is the customer', ['acme'], 10);
    assert.equal(snip.matchStart, 0);
    assert.ok(!snip.text.startsWith('…'));
  });

  it('returns a leading preview with matchStart -1 when nothing matches', () => {
    const snip = rankSnippet('just some text here', ['zzz']);
    assert.equal(snip.matchStart, -1);
    assert.ok(snip.text.startsWith('just some text'));
  });

  it('collapses whitespace and returns empty for empty source', () => {
    assert.deepEqual(rankSnippet('   ', ['x']), {
      text: '',
      matchStart: -1,
      matchLength: 0,
    });
    assert.equal(rankSnippet('a\n\n  b\tc', ['b']).text.includes('a b c'), true);
  });
});

describe('bestSnippetField', () => {
  it('prefers the first value that actually matches', () => {
    const out = bestSnippetField(
      ['no match here', 'Acme Corporation', undefined, ''],
      ['acme'],
    );
    assert.ok(out && out.includes('Acme'));
  });

  it('falls back to the first non-empty preview when nothing matches', () => {
    const out = bestSnippetField(['', 'first value', 'second value'], ['zzz']);
    assert.ok(out && out.startsWith('first value'));
  });

  it('returns undefined when there is nothing to show', () => {
    assert.equal(bestSnippetField([undefined, '', '   '], ['x']), undefined);
  });
});
