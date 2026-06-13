/**
 * Unit tests for the Next-Best-Action PURE helpers (`../nba`).
 *
 * Runs with Node's built-in `node:test` + `tsx` (no extra deps):
 *   npx tsx --test src/lib/sabcrm/__tests__/nba.test.ts
 *
 * The impure half (`nba.server.ts` — Mongo assembly) carries `'server-only'`
 * and is deliberately NOT imported here (scoring.test.ts precedent).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  scoreAction,
  rankActions,
  actionReason,
  urgencyTier,
  summarizeQueue,
  NBA_BASE_WEIGHT,
  NBA_ACTION_KINDS,
  type NbaAction,
  type NbaActionKind,
  type NbaSignals,
} from '../nba';

let seq = 0;
function action(
  kind: NbaActionKind,
  signals: NbaSignals = {},
  over: Partial<NbaAction> = {},
): NbaAction {
  seq += 1;
  return {
    id: over.id ?? `${kind}-${seq}`,
    kind,
    record: over.record ?? {
      object: 'leads',
      recordId: `rec-${seq}`,
      label: `Record ${seq}`,
    },
    signals,
    dueAt: over.dueAt,
    detail: over.detail,
  };
}

/* -------------------------------------------------------------------------- */
/* scoreAction                                                                  */
/* -------------------------------------------------------------------------- */

describe('scoreAction', () => {
  it('returns the base weight when there are no signals', () => {
    for (const kind of NBA_ACTION_KINDS) {
      assert.equal(scoreAction(action(kind)), NBA_BASE_WEIGHT[kind]);
    }
  });

  it('clamps urgency into 0..100', () => {
    const u = scoreAction(
      action('hot_lead', {
        leadScore: 100,
        winProbability: 100,
        amount: 10_000_000,
      }),
    );
    assert.ok(u >= 0 && u <= 100, `expected 0..100, got ${u}`);
  });

  it('overdue tasks grow with overdue days but saturate', () => {
    const base = NBA_BASE_WEIGHT.overdue_task;
    const u5 = scoreAction(action('overdue_task', { overdueDays: 5 }));
    const u30 = scoreAction(action('overdue_task', { overdueDays: 30 }));
    const u300 = scoreAction(action('overdue_task', { overdueDays: 300 }));
    assert.ok(u5 > base, 'overdue lifts above base');
    assert.ok(u30 > u5, 'more overdue is more urgent');
    // Saturation: 300 days is not dramatically more than 30 days.
    assert.ok(u300 - u30 < u30 - u5 + 1, 'contribution saturates');
  });

  it('task priority lifts an otherwise equal task', () => {
    const low = scoreAction(
      action('overdue_task', { overdueDays: 3, taskPriority: 'LOW' }),
    );
    const urgent = scoreAction(
      action('overdue_task', { overdueDays: 3, taskPriority: 'URGENT' }),
    );
    assert.ok(urgent > low, 'urgent > low for same overdue');
  });

  it('hot lead urgency rises with score, win-prob and amount', () => {
    const cold = scoreAction(action('hot_lead', { leadScore: 5 }));
    const hot = scoreAction(
      action('hot_lead', { leadScore: 90, winProbability: 80, amount: 50_000 }),
    );
    assert.ok(hot > cold, 'a hotter lead outranks a colder one');
  });

  it('unreplied inbound saturates quickly on waiting hours', () => {
    const fresh = scoreAction(action('unreplied_inbound', { waitingHours: 1 }));
    const old = scoreAction(action('unreplied_inbound', { waitingHours: 200 }));
    assert.ok(old > fresh);
    assert.ok(old <= 100);
  });

  it('rotting deal urgency rises with idle days and amount', () => {
    const small = scoreAction(action('rotting_deal', { idleDays: 2, amount: 100 }));
    const big = scoreAction(
      action('rotting_deal', { idleDays: 40, amount: 100_000 }),
    );
    assert.ok(big > small);
  });
});

/* -------------------------------------------------------------------------- */
/* urgencyTier                                                                  */
/* -------------------------------------------------------------------------- */

describe('urgencyTier', () => {
  it('bands urgency into critical/high/medium/low', () => {
    assert.equal(urgencyTier(95), 'critical');
    assert.equal(urgencyTier(80), 'critical');
    assert.equal(urgencyTier(79), 'high');
    assert.equal(urgencyTier(60), 'high');
    assert.equal(urgencyTier(59), 'medium');
    assert.equal(urgencyTier(40), 'medium');
    assert.equal(urgencyTier(39), 'low');
    assert.equal(urgencyTier(0), 'low');
  });
});

/* -------------------------------------------------------------------------- */
/* actionReason                                                                 */
/* -------------------------------------------------------------------------- */

describe('actionReason', () => {
  it('pluralizes overdue days correctly', () => {
    assert.match(actionReason(action('overdue_task', { overdueDays: 1 })), /1 day\b/);
    assert.match(actionReason(action('overdue_task', { overdueDays: 3 })), /3 days/);
    assert.match(actionReason(action('overdue_task', { overdueDays: 0 })), /due today/i);
  });

  it('mentions score and win probability for hot leads', () => {
    const r = actionReason(
      action('hot_lead', { leadScore: 88, winProbability: 72 }),
    );
    assert.match(r, /88/);
    assert.match(r, /72% win/);
  });

  it('describes waiting time in hours then days', () => {
    assert.match(
      actionReason(action('unreplied_inbound', { waitingHours: 3 })),
      /3 hours/,
    );
    assert.match(
      actionReason(action('unreplied_inbound', { waitingHours: 48 })),
      /2 days/,
    );
  });

  it('describes rotting deals with amount and idle days', () => {
    const r = actionReason(
      action('rotting_deal', { idleDays: 12, rottingThresholdDays: 7, amount: 25_000 }),
    );
    assert.match(r, /\$25k/);
    assert.match(r, /12 days/);
  });
});

/* -------------------------------------------------------------------------- */
/* rankActions                                                                  */
/* -------------------------------------------------------------------------- */

describe('rankActions', () => {
  it('orders by urgency descending', () => {
    const queue = rankActions([
      action('hot_lead', { leadScore: 5 }), // ~lowest
      action('unreplied_inbound', { waitingHours: 100 }), // ~highest
      action('overdue_task', { overdueDays: 10 }),
    ]);
    for (let i = 1; i < queue.length; i++) {
      assert.ok(
        queue[i - 1].urgency >= queue[i].urgency,
        'queue is non-increasing in urgency',
      );
    }
    assert.equal(queue[0].kind, 'unreplied_inbound');
  });

  it('drops invalid candidates (bad kind / missing record)', () => {
    const bad = [
      { id: 'x', kind: 'nonsense', record: { object: 'leads', recordId: 'r1', label: 'a' }, signals: {} },
      { id: 'y', kind: 'hot_lead', record: { object: '', recordId: '', label: '' }, signals: {} },
      action('hot_lead', { leadScore: 50 }),
    ] as unknown as NbaAction[];
    const queue = rankActions(bad);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].kind, 'hot_lead');
  });

  it('keeps only the most urgent action per (record, kind) by default', () => {
    const rec = { object: 'leads', recordId: 'same', label: 'Same' };
    const queue = rankActions([
      action('overdue_task', { overdueDays: 2 }, { id: 'a', record: rec }),
      action('overdue_task', { overdueDays: 40 }, { id: 'b', record: rec }),
    ]);
    assert.equal(queue.length, 1, 'one per (record, kind)');
    assert.equal(queue[0].id, 'b', 'the more urgent survives');
  });

  it('honors maxPerRecordKind', () => {
    const rec = { object: 'leads', recordId: 'same', label: 'Same' };
    const queue = rankActions(
      [
        action('overdue_task', { overdueDays: 2 }, { id: 'a', record: rec }),
        action('overdue_task', { overdueDays: 40 }, { id: 'b', record: rec }),
      ],
      { maxPerRecordKind: 2 },
    );
    assert.equal(queue.length, 2);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      action('hot_lead', { leadScore: i }, {
        id: `h-${i}`,
        record: { object: 'leads', recordId: `r-${i}`, label: `R${i}` },
      }),
    );
    assert.equal(rankActions(many, { limit: 5 }).length, 5);
  });

  it('breaks urgency ties by earlier dueAt then id', () => {
    const rec1 = { object: 'leads', recordId: 'r1', label: 'R1' };
    const rec2 = { object: 'leads', recordId: 'r2', label: 'R2' };
    const queue = rankActions([
      action('overdue_task', { overdueDays: 5 }, {
        id: 'later',
        record: rec1,
        dueAt: '2026-06-10T00:00:00.000Z',
      }),
      action('overdue_task', { overdueDays: 5 }, {
        id: 'earlier',
        record: rec2,
        dueAt: '2026-06-01T00:00:00.000Z',
      }),
    ]);
    assert.equal(queue[0].id, 'earlier', 'earlier dueAt wins the tie');
  });

  it('appends detail to the reason when provided', () => {
    const queue = rankActions([
      action('hot_lead', { leadScore: 50 }, { detail: 'no touch in 14d' }),
    ]);
    assert.match(queue[0].reason, /no touch in 14d/);
  });

  it('attaches label + icon from the kind maps', () => {
    const queue = rankActions([action('rotting_deal', { idleDays: 5 })]);
    assert.equal(queue[0].label, 'Rescue rotting deal');
    assert.equal(queue[0].icon, 'AlertTriangle');
  });

  it('handles an empty / nullish input', () => {
    assert.deepEqual(rankActions([]), []);
    assert.deepEqual(rankActions(undefined as unknown as NbaAction[]), []);
  });
});

/* -------------------------------------------------------------------------- */
/* summarizeQueue                                                               */
/* -------------------------------------------------------------------------- */

describe('summarizeQueue', () => {
  it('rolls up per-kind and per-tier counts', () => {
    const queue = rankActions([
      action('unreplied_inbound', { waitingHours: 100 }),
      action('overdue_task', { overdueDays: 40, taskPriority: 'URGENT' }),
      action('hot_lead', { leadScore: 5 }),
    ]);
    const sum = summarizeQueue(queue);
    assert.equal(sum.total, 3);
    assert.equal(sum.byKind.unreplied_inbound, 1);
    assert.equal(sum.byKind.overdue_task, 1);
    assert.equal(sum.byKind.hot_lead, 1);
    const tierTotal =
      sum.byTier.critical + sum.byTier.high + sum.byTier.medium + sum.byTier.low;
    assert.equal(tierTotal, 3);
  });

  it('handles an empty queue', () => {
    const sum = summarizeQueue([]);
    assert.equal(sum.total, 0);
    assert.equal(sum.byKind.hot_lead, 0);
    assert.equal(sum.byTier.critical, 0);
  });
});
