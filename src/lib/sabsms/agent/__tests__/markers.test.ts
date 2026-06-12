/**
 * SabSMS V2.12 — DLT marker-preservation validator tests (pure).
 *
 *   npx tsx --test src/lib/sabsms/agent/__tests__/markers.test.ts
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { extractDltMarkers, hasDltMarkers, markersPreserved } from '../markers';

describe('extractDltMarkers / hasDltMarkers', () => {
  it('finds {#var#} markers in order', () => {
    assert.deepEqual(
      extractDltMarkers('Hi {#var#}, your OTP is {#var#}.'),
      ['{#var#}', '{#var#}'],
    );
  });

  it('finds named markers too', () => {
    assert.deepEqual(extractDltMarkers('Hello {#name#}!'), ['{#name#}']);
  });

  it('plain text has none', () => {
    assert.equal(hasDltMarkers('no markers here {var} {#}'.replace('{#}', '')), false);
    assert.deepEqual(extractDltMarkers('just text'), []);
  });
});

describe('markersPreserved', () => {
  const original = 'Dear {#var#}, order {#var#} ships {#date#}.';

  it('accepts a rewrite with the same marker multiset (any order)', () => {
    assert.equal(
      markersPreserved(original, '{#date#} को {#var#} का ऑर्डर {#var#} भेजा जाएगा।'),
      true,
    );
  });

  it('rejects a dropped marker', () => {
    assert.equal(
      markersPreserved(original, 'Dear {#var#}, your order ships {#date#}.'),
      false,
    );
  });

  it('rejects an added marker', () => {
    assert.equal(
      markersPreserved(original, 'Dear {#var#} {#var#}, order {#var#} ships {#date#}.'),
      false,
    );
  });

  it('rejects a mangled marker', () => {
    assert.equal(
      markersPreserved(original, 'Dear {# var #}, order {#var#} ships {#date#}.'),
      // `{# var #}` still matches the defensive RX (whitespace allowed) but
      // it is a DIFFERENT string than `{#var#}` → multiset mismatch.
      false,
    );
  });

  it('plain bodies trivially pass', () => {
    assert.equal(markersPreserved('hello there', 'hi!'), true);
  });
});
