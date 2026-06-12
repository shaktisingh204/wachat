/**
 * Engine-parity tests for the SabSMS segment counter (`../segments.ts`).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/segments.test.ts
 *
 * The assertions come from the SHARED fixture at
 * `services/sabsms-engine/tests/fixtures/segment-vectors.json` — the
 * same file the Rust engine's `cargo test` consumes. If either side
 * drifts from the other, one of the two suites goes red. Never edit the
 * fixture to make one side pass without running both.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { estimateSegments, isGsm7, segmentInfo } from '../segments';

interface SegmentVector {
  note: string;
  body: string;
  segments: number;
  encoding: 'gsm7' | 'ucs2';
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(
  here,
  '../../../../services/sabsms-engine/tests/fixtures/segment-vectors.json',
);
const vectors: SegmentVector[] = JSON.parse(readFileSync(fixturePath, 'utf8'));

test('fixture sanity — a meaningful vector set exists', () => {
  assert.ok(vectors.length >= 25, `expected >= 25 vectors, got ${vectors.length}`);
});

for (const v of vectors) {
  const label = v.note || `${v.body.slice(0, 24)}…`;

  test(`estimateSegments parity — ${label}`, () => {
    assert.equal(
      estimateSegments(v.body),
      v.segments,
      `body ${JSON.stringify(v.body.slice(0, 40))} (${[...v.body].length} cp)`,
    );
  });

  test(`encoding parity — ${label}`, () => {
    assert.equal(isGsm7(v.body), v.encoding === 'gsm7');
    const info = segmentInfo(v.body);
    assert.equal(info.encoding, v.encoding);
    assert.equal(info.segments, v.segments);
  });
}

test('segmentInfo reports code-point length, not UTF-16 length', () => {
  // 🎉 is one code point but two UTF-16 units.
  const info = segmentInfo('🎉');
  assert.equal(info.length, 1);
  assert.equal(info.encoding, 'ucs2');
  assert.equal(info.perSegment, 70);
});

test('segmentInfo perSegment drops to the concatenated size on split', () => {
  assert.equal(segmentInfo('a'.repeat(160)).perSegment, 160);
  assert.equal(segmentInfo('a'.repeat(161)).perSegment, 153);
  assert.equal(segmentInfo('अ'.repeat(70)).perSegment, 70);
  assert.equal(segmentInfo('अ'.repeat(71)).perSegment, 67);
});

test('empty body mirrors the engine: GSM-7, one billable segment', () => {
  assert.equal(estimateSegments(''), 1);
  assert.equal(isGsm7(''), true);
  assert.deepEqual(segmentInfo(''), {
    encoding: 'gsm7',
    length: 0,
    segments: 1,
    perSegment: 160,
  });
});
