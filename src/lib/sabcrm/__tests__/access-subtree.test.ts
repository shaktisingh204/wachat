/**
 * Unit tests for the management-subtree BFS (`../access-compiler`).
 *   npx tsx --test src/lib/sabcrm/__tests__/access-subtree.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { collectSubtreeUserIds, type MemberNode } from '../access-compiler';

// m1(u1) is the boss; m2(u2),m3(u3) report to m1; m4(u4) reports to m2.
const members: MemberNode[] = [
  { id: 'm1', userId: 'u1' },
  { id: 'm2', userId: 'u2', managerId: 'm1' },
  { id: 'm3', userId: 'u3', managerId: 'm1' },
  { id: 'm4', userId: 'u4', managerId: 'm2' },
  { id: 'm5', userId: 'u5' }, // unrelated
];

describe('collectSubtreeUserIds', () => {
  it('boss sees the whole subtree (self + all reports, transitively)', () => {
    const ids = collectSubtreeUserIds(members, 'u1').sort();
    assert.deepEqual(ids, ['u1', 'u2', 'u3', 'u4']);
    assert.ok(!ids.includes('u5'));
  });
  it('a mid-manager sees self + direct/indirect reports only', () => {
    assert.deepEqual(collectSubtreeUserIds(members, 'u2').sort(), ['u2', 'u4']);
  });
  it('a leaf sees only themselves', () => {
    assert.deepEqual(collectSubtreeUserIds(members, 'u4'), ['u4']);
  });
  it('an actor with no member node falls back to [self]', () => {
    assert.deepEqual(collectSubtreeUserIds(members, 'u99'), ['u99']);
  });
  it('is cycle-safe (m1↔m2 manager loop does not hang)', () => {
    const cyclic: MemberNode[] = [
      { id: 'a', userId: 'ua', managerId: 'b' },
      { id: 'b', userId: 'ub', managerId: 'a' },
    ];
    const ids = collectSubtreeUserIds(cyclic, 'ua').sort();
    assert.deepEqual(ids, ['ua', 'ub']);
  });
});
