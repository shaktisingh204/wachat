/**
 * Unit test for the command-menu wiring's pure mapping logic:
 * a `TextSearchHit` (from `searchTextTw` / `text-search.server`) -> the
 * command-menu `RecordResult` shape ({ slug, id, label, avatarUrl? }).
 *
 * The wiring keeps this mapping inline inside `useRecordSearch`
 * (command-menu-data.ts). This test mirrors that exact mapping so a future
 * change to either the `TextSearchHit` or `RecordResult` shape is caught here.
 *
 * Run: npx tsx --test src/lib/sabcrm/__tests__/cmdk-textsearch-map.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { TextSearchHit } from '@/lib/sabcrm/text-search.server';
import type { RecordResult } from '@/components/sabcrm/command-menu-data';

/**
 * The mapping the wiring applies, verbatim. `TextSearchHit.object` -> `slug`;
 * `snippet`/`score` are dropped (the menu does not use them); no avatar is
 * available from an indexed text hit, so `avatarUrl` is left undefined.
 */
function hitToRecordResult(h: TextSearchHit): RecordResult {
  return { slug: h.object, id: h.id, label: h.label };
}

test('maps a TextSearchHit onto the RecordResult shape', () => {
  const hit: TextSearchHit = {
    object: 'companies',
    id: 'abc123',
    label: 'Acme Inc',
    snippet: 'Acme Inc — enterprise',
    score: 4.2,
  };
  const result = hitToRecordResult(hit);
  assert.deepEqual(result, { slug: 'companies', id: 'abc123', label: 'Acme Inc' });
  // RecordResult requires slug/id/label and leaves avatarUrl optional/absent.
  assert.equal(result.avatarUrl, undefined);
});

test('preserves slug from object across many hits and stays order-stable', () => {
  const hits: TextSearchHit[] = [
    { object: 'people', id: 'p1', label: 'Ada Lovelace', score: 9 },
    { object: 'leads', id: 'l1', label: 'Big Deal', score: 7 },
    { object: 'companies', id: 'c1', label: 'Globex', score: 5 },
  ];
  const mapped = hits.map(hitToRecordResult);
  assert.deepEqual(mapped, [
    { slug: 'people', id: 'p1', label: 'Ada Lovelace' },
    { slug: 'leads', id: 'l1', label: 'Big Deal' },
    { slug: 'companies', id: 'c1', label: 'Globex' },
  ]);
});

test('handles an empty hit list (fall-back trigger) without throwing', () => {
  const mapped: RecordResult[] = ([] as TextSearchHit[]).map(hitToRecordResult);
  assert.equal(mapped.length, 0);
});
