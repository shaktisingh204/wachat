/**
 * Pure unit tests for the CPM engine in `gantt.ts`.
 *
 *   pnpm exec tsx --test src/lib/worksuite-pm/__tests__/critical-path.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  computeCriticalPath,
  computeSlack,
  CycleError,
  runCpm,
  topoSort,
} from '../gantt';
import type { GanttItem } from '../types';

/* Helper builders. */
const item = (
  id: string,
  durationDays: number,
  dependsOn: string[] = [],
): GanttItem => ({ id, name: id, durationDays, dependsOn });

test('computeCriticalPath: simple linear chain — every task is critical', () => {
  const items: GanttItem[] = [
    item('A', 2),
    item('B', 3, ['A']),
    item('C', 4, ['B']),
  ];
  assert.deepEqual(computeCriticalPath(items), ['A', 'B', 'C']);
  const cpm = runCpm(items);
  assert.equal(cpm.projectDuration, 9);
  for (const n of cpm.nodes.values()) {
    assert.equal(n.slack, 0);
    assert.equal(n.critical, true);
  }
});

test('computeCriticalPath: parallel branches pick the longer path', () => {
  // A → B(5) → D
  // A → C(2) → D
  // Critical path = A, B, D (length 1+5+1 = 7)
  const items: GanttItem[] = [
    item('A', 1),
    item('B', 5, ['A']),
    item('C', 2, ['A']),
    item('D', 1, ['B', 'C']),
  ];
  const path = computeCriticalPath(items);
  assert.deepEqual(path, ['A', 'B', 'D']);
  const slack = computeSlack(items);
  assert.equal(slack.get('A'), 0);
  assert.equal(slack.get('B'), 0);
  assert.equal(slack.get('D'), 0);
  // C has 5 - 2 = 3 days of slack.
  assert.equal(slack.get('C'), 3);
});

test('runCpm: ES/EF/LS/LF/slack are correct on a diamond graph', () => {
  const items: GanttItem[] = [
    item('A', 4),
    item('B', 6, ['A']),
    item('C', 3, ['A']),
    item('D', 2, ['B', 'C']),
  ];
  const r = runCpm(items);
  assert.equal(r.projectDuration, 12); // 4 + 6 + 2
  const a = r.nodes.get('A')!;
  const b = r.nodes.get('B')!;
  const c = r.nodes.get('C')!;
  const d = r.nodes.get('D')!;

  assert.equal(a.earliestStart, 0);
  assert.equal(a.earliestFinish, 4);
  assert.equal(b.earliestStart, 4);
  assert.equal(b.earliestFinish, 10);
  assert.equal(c.earliestStart, 4);
  assert.equal(c.earliestFinish, 7);
  assert.equal(d.earliestStart, 10); // gated by B
  assert.equal(d.earliestFinish, 12);

  // Backward pass.
  assert.equal(d.latestFinish, 12);
  assert.equal(d.latestStart, 10);
  assert.equal(b.latestFinish, 10);
  assert.equal(b.latestStart, 4);
  assert.equal(c.latestFinish, 10); // can finish as late as B's LS
  assert.equal(c.latestStart, 7);
  assert.equal(a.latestStart, 0);

  // Slack.
  assert.equal(a.slack, 0);
  assert.equal(b.slack, 0);
  assert.equal(c.slack, 3);
  assert.equal(d.slack, 0);
});

test('topoSort: throws CycleError on a cyclic graph', () => {
  const items: GanttItem[] = [
    item('A', 1, ['C']),
    item('B', 1, ['A']),
    item('C', 1, ['B']),
  ];
  assert.throws(() => topoSort(items), (err: unknown) => err instanceof CycleError);
});

test('runCpm: handles a single isolated node', () => {
  const items: GanttItem[] = [item('only', 5)];
  const r = runCpm(items);
  assert.equal(r.projectDuration, 5);
  assert.deepEqual(r.criticalPath, ['only']);
  assert.equal(r.nodes.get('only')!.slack, 0);
});

test('runCpm: zero-duration milestone sits on the critical path with parent', () => {
  const items: GanttItem[] = [
    item('A', 3),
    item('M', 0, ['A']), // milestone
    item('B', 4, ['M']),
  ];
  const r = runCpm(items);
  assert.equal(r.projectDuration, 7);
  assert.deepEqual(r.criticalPath, ['A', 'M', 'B']);
  for (const n of r.nodes.values()) assert.equal(n.slack, 0);
});
