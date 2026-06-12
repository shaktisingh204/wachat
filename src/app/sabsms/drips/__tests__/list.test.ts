/**
 * Drips (journeys) list — pure-surface tests (V2.9).
 *
 *   npx tsx src/app/sabsms/drips/__tests__/list.test.ts
 *
 * The list server actions are session+Mongo bound, so this covers the
 * parts that are safe under plain `node:test`:
 *   - the journey schema accepts what the builder/list round-trips
 *   - `validateJourney` agrees with list-shaped samples
 *   - the URL filter contract (`JourneyListFilters`) stays in sync
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  JourneyStepSchema,
  JourneyTriggerSchema,
  SabsmsJourneySchema,
  emptyJourneyStats,
} from '@/lib/sabsms/journeys/types';

import type { JourneyListFilters } from '../actions';
import { validateJourney } from '../[id]/validate';

describe('journey schema round-trip (list shapes)', () => {
  it('accepts a full journey doc', () => {
    const doc = {
      workspaceId: 'ws1',
      name: 'Welcome',
      status: 'active' as const,
      trigger: { kind: 'inbound_keyword' as const, keyword: 'JOIN' },
      steps: [
        { id: 's1', kind: 'send' as const, templateId: 'tpl1' },
        { id: 'w1', kind: 'wait' as const, durationMs: 60_000 },
      ],
      exitRules: { onUnsubscribe: true as const, onReply: false },
      stats: emptyJourneyStats(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const parsed = SabsmsJourneySchema.safeParse(doc);
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  });

  it('rejects unknown step kinds and bad triggers', () => {
    assert.equal(
      JourneyStepSchema.safeParse({ id: 'x', kind: 'teleport' }).success,
      false,
    );
    assert.equal(
      JourneyTriggerSchema.safeParse({ kind: 'inbound_keyword' }).success,
      false, // keyword required
    );
  });
});

describe('validateJourney against list-shaped samples', () => {
  it('flags a journey whose send step lost its template', () => {
    const res = validateJourney({
      name: 'Broken',
      trigger: { kind: 'manual' },
      steps: [{ id: 's1', kind: 'send', templateId: '' }],
      exitRules: { onUnsubscribe: true },
    });
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => e.includes('template')));
  });
});

describe('JourneyListFilters URL contract', () => {
  it('keeps the param names the page parses', () => {
    const filters: JourneyListFilters = {
      q: 'welcome',
      status: 'active',
      sort: 'active_runs',
    };
    // Compile-time contract; runtime sanity on the literal unions.
    assert.deepEqual(Object.keys(filters).sort(), ['q', 'sort', 'status']);
    const sorts: Array<NonNullable<JourneyListFilters['sort']>> = [
      'newest',
      'oldest',
      'name',
      'active_runs',
    ];
    assert.equal(sorts.length, 4);
  });
});
