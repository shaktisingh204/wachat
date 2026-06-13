/**
 * Unit tests for the ask-your-CRM PURE helpers (`../crm-rag`).
 *   npx tsx --test src/lib/sabcrm/__tests__/crm-rag.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  queryTerms,
  scoreCandidate,
  rankCandidates,
  buildGroundingContext,
  buildGroundedPrompt,
  type RagCandidate,
} from '../crm-rag';

const recs: RagCandidate[] = [
  { id: '1', object: 'companies', label: 'Acme Corp', data: { domainName: 'acme.com', employees: 200 } },
  { id: '2', object: 'people', label: 'Jane Acme', data: { email: 'jane@acme.com', title: 'CEO' } },
  { id: '3', object: 'companies', label: 'Globex', data: { domainName: 'globex.io' } },
];

describe('queryTerms', () => {
  it('drops stopwords + short tokens, dedups, lowercases', () => {
    assert.deepEqual(queryTerms('Show me all the Acme deals'), ['acme', 'deals']);
  });
});

describe('scoreCandidate', () => {
  it('counts term occurrences across label + data', () => {
    const terms = ['acme'];
    assert.ok(scoreCandidate(recs[0], terms) >= 2); // label + domain
    assert.equal(scoreCandidate(recs[2], terms), 0); // Globex: no acme
  });
});

describe('rankCandidates', () => {
  it('returns only positive matches, highest score first', () => {
    const ranked = rankCandidates(recs, 'acme');
    assert.ok(ranked.length >= 2);
    assert.ok(!ranked.some((r) => r.id === '3')); // Globex excluded
    assert.ok(ranked[0].score >= ranked[ranked.length - 1].score);
  });
  it('empty for a no-match query', () => {
    assert.deepEqual(rankCandidates(recs, 'zzzznomatch'), []);
  });
});

describe('buildGroundingContext', () => {
  it('formats [object] label — fields and respects the char bound', () => {
    const ctx = buildGroundingContext(recs, 10_000);
    assert.match(ctx, /\[companies\] Acme Corp/);
    assert.match(ctx, /domainName=acme\.com/);
    const tiny = buildGroundingContext(recs, 20); // only ~one short line fits
    assert.ok(tiny.length <= 60);
  });
  it('skips reserved __ fields', () => {
    const ctx = buildGroundingContext(
      [{ id: 'x', object: 'leads', label: 'L', data: { amount: 5, __score: { a: 1 } } }],
      10_000,
    );
    assert.match(ctx, /amount=5/);
    assert.ok(!ctx.includes('__score'));
  });
});

describe('buildGroundedPrompt', () => {
  it('includes the question + context, and a no-match variant', () => {
    assert.match(buildGroundedPrompt('who is CEO?', '- [people] Jane'), /Jane/);
    assert.match(buildGroundedPrompt('who is CEO?', '   '), /no matching records/i);
  });
});
