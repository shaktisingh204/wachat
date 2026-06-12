/**
 * SabSMS V2.12 — conversation-insights reduce logic tests (pure).
 *
 *   npx tsx --test src/lib/sabsms/insights/__tests__/mining.test.ts
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  mergeIntentBatches,
  mergeTopicBatches,
  normalizeTopicLabel,
  topicTrend,
  type TopicRow,
} from '../mining';

describe('normalizeTopicLabel', () => {
  it('lowercases, trims, strips punctuation and articles', () => {
    assert.equal(normalizeTopicLabel('  The Shipping-Delay! '), 'shipping delay');
    assert.equal(normalizeTopicLabel('A Pricing Question'), 'pricing question');
  });

  it('merges trailing plurals on the last word', () => {
    assert.equal(
      normalizeTopicLabel('Shipping delays'),
      normalizeTopicLabel('shipping delay'),
    );
    // ...but not -ss words.
    assert.equal(normalizeTopicLabel('order address'), 'order address');
  });
});

describe('mergeTopicBatches', () => {
  it('merges label-similar topics, sums counts, sorts desc', () => {
    const batches: TopicRow[][] = [
      [
        { label: 'Shipping delays', count: 4, sentiment: 'negative' },
        { label: 'pricing question', count: 2, sentiment: 'neutral' },
      ],
      [
        { label: 'shipping delay', count: 3, sentiment: 'negative' },
        { label: 'Store hours', count: 6, sentiment: 'neutral' },
      ],
    ];
    const merged = mergeTopicBatches(batches);
    assert.equal(merged.length, 3);
    // shipping merged to 4+3=7, outranking store hours (6).
    assert.equal(merged[0].count, 7);
    assert.equal(merged[0].sentiment, 'negative');
    assert.ok(merged[0].label.toLowerCase().startsWith('shipping'));
    assert.equal(merged[1].label, 'Store hours');
    assert.equal(merged[1].count, 6);
  });

  it('sentiment is the count-weighted dominant one', () => {
    const merged = mergeTopicBatches([
      [
        { label: 'returns', count: 5, sentiment: 'positive' },
        { label: 'returns', count: 2, sentiment: 'negative' },
      ],
    ]);
    assert.equal(merged[0].sentiment, 'positive');
  });

  it('drops empty labels and zero counts', () => {
    const merged = mergeTopicBatches([
      [
        { label: '', count: 5, sentiment: 'neutral' },
        { label: 'real', count: 0, sentiment: 'neutral' },
        { label: 'kept', count: 1, sentiment: 'neutral' },
      ],
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].label, 'kept');
  });
});

describe('mergeIntentBatches', () => {
  it('sums lowercased keys across batches', () => {
    const merged = mergeIntentBatches([
      { Question: 3, complaint: 1 },
      { question: 2, purchase: 4 },
    ]);
    assert.deepEqual(merged, { question: 5, complaint: 1, purchase: 4 });
  });

  it('ignores junk values', () => {
    const merged = mergeIntentBatches([
      { question: Number.NaN, complaint: -2, support: 1 },
    ]);
    assert.deepEqual(merged, { support: 1 });
  });
});

describe('topicTrend', () => {
  const current: TopicRow[] = [
    { label: 'shipping delay', count: 7, sentiment: 'negative' },
    { label: 'store hours', count: 3, sentiment: 'neutral' },
    { label: 'gift cards', count: 2, sentiment: 'positive' },
  ];
  const previous: TopicRow[] = [
    { label: 'Shipping delays', count: 4, sentiment: 'negative' },
    { label: 'store hours', count: 5, sentiment: 'neutral' },
  ];

  it('up / down / new vs the previous window', () => {
    assert.equal(topicTrend('shipping delay', current, previous), 'up');
    assert.equal(topicTrend('store hours', current, previous), 'down');
    assert.equal(topicTrend('gift cards', current, previous), 'new');
  });

  it('no previous doc → new', () => {
    assert.equal(topicTrend('store hours', current, undefined), 'new');
  });
});
