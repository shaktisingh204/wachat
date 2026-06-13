/**
 * Unit tests for conversation-intel PURE parse (`../conversation-intel`).
 *   npx tsx --test src/lib/sabcrm/__tests__/conversation-intel.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseAnalysis,
  buildTranscriptPrompt,
  analysisToNote,
  TRANSCRIPT_CAP,
} from '../conversation-intel';

describe('parseAnalysis', () => {
  it('parses a clean JSON object', () => {
    const a = parseAnalysis(
      '{"summary":"Good call","nextSteps":["send quote","book demo"],"sentiment":"positive","risk":"low"}',
    );
    assert.equal(a.summary, 'Good call');
    assert.deepEqual(a.nextSteps, ['send quote', 'book demo']);
    assert.equal(a.sentiment, 'positive');
    assert.equal(a.risk, 'low');
  });
  it('extracts JSON embedded in prose / fences', () => {
    const a = parseAnalysis('Here you go:\n```json\n{"summary":"x","sentiment":"negative","risk":"high"}\n```');
    assert.equal(a.summary, 'x');
    assert.equal(a.sentiment, 'negative');
    assert.equal(a.risk, 'high');
    assert.deepEqual(a.nextSteps, []);
  });
  it('falls back to raw text as summary on invalid JSON', () => {
    const a = parseAnalysis('the model rambled with no json');
    assert.match(a.summary, /rambled/);
    assert.equal(a.sentiment, 'unknown');
    assert.equal(a.risk, 'unknown');
  });
  it('rejects invalid enum values', () => {
    const a = parseAnalysis('{"summary":"x","sentiment":"ecstatic","risk":"nuclear"}');
    assert.equal(a.sentiment, 'unknown');
    assert.equal(a.risk, 'unknown');
  });
});

describe('buildTranscriptPrompt', () => {
  it('caps transcript length + includes context label', () => {
    const big = 'a'.repeat(TRANSCRIPT_CAP + 5000);
    const p = buildTranscriptPrompt(big, 'Acme deal');
    assert.ok(p.includes('Acme deal'));
    assert.ok(p.length < TRANSCRIPT_CAP + 200);
  });
});

describe('analysisToNote', () => {
  it('renders summary + next steps + footer', () => {
    const note = analysisToNote({
      summary: 'Solid',
      nextSteps: ['follow up'],
      sentiment: 'positive',
      risk: 'low',
    });
    assert.match(note, /Solid/);
    assert.match(note, /follow up/);
    assert.match(note, /Sentiment: positive/);
  });
});
