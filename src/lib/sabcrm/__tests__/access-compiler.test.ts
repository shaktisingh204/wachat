/**
 * Unit tests for the access/sharing PURE compiler (`../access-compiler`).
 *   npx tsx --test src/lib/sabcrm/__tests__/access-compiler.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildAccessibleByFilter,
  buildFieldProjection,
  canAccessRecord,
  type AccessContext,
} from '../access-compiler';

function ctx(over: Partial<AccessContext>): AccessContext {
  return {
    projectId: 'p1',
    selfId: 'u1',
    elevated: false,
    owd: 'private',
    visibleUserIds: ['u1'],
    ...over,
  };
}

describe('buildAccessibleByFilter', () => {
  it('elevated → full tenant scope (projectId only)', () => {
    const { filter } = buildAccessibleByFilter(ctx({ elevated: true }));
    assert.deepEqual(filter, { projectId: 'p1' });
  });

  it('non-private OWD → full tenant scope', () => {
    assert.deepEqual(buildAccessibleByFilter(ctx({ owd: 'read' })).filter, {
      projectId: 'p1',
    });
    assert.deepEqual(buildAccessibleByFilter(ctx({ owd: 'readWrite' })).filter, {
      projectId: 'p1',
    });
  });

  it('private → projectId + owner $or over visible user ids', () => {
    const { filter } = buildAccessibleByFilter(
      ctx({ owd: 'private', visibleUserIds: ['u1', 'u2'] }),
    );
    assert.equal(filter.projectId, 'p1');
    const or = filter.$or as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(or));
    assert.deepEqual(or[0], { userId: { $in: ['u1', 'u2'] } });
    // includes the data.* owner fields
    assert.ok(or.some((c) => 'data.assignedTo' in c));
    assert.ok(or.some((c) => 'data.owner' in c));
    assert.ok(or.some((c) => 'data.ownerId' in c));
  });

  it('private with empty subtree falls back to self', () => {
    const { filter } = buildAccessibleByFilter(
      ctx({ owd: 'private', visibleUserIds: [] }),
    );
    const or = filter.$or as Array<Record<string, unknown>>;
    assert.deepEqual(or[0], { userId: { $in: ['u1'] } });
  });

  it('always pins projectId (never leaks cross-tenant)', () => {
    for (const owd of ['private', 'read', 'readWrite'] as const) {
      assert.equal(buildAccessibleByFilter(ctx({ owd })).filter.projectId, 'p1');
    }
  });
});

describe('buildFieldProjection', () => {
  it('maps hidden fields to data.<key>: 0', () => {
    assert.deepEqual(buildFieldProjection(['salary', 'ssn']), {
      'data.salary': 0,
      'data.ssn': 0,
    });
  });
  it('undefined for no hidden fields', () => {
    assert.equal(buildFieldProjection([]), undefined);
    assert.equal(buildFieldProjection(undefined), undefined);
  });
});

describe('canAccessRecord', () => {
  it('elevated / non-private always true', () => {
    assert.equal(canAccessRecord(ctx({ elevated: true }), { userId: 'other' }), true);
    assert.equal(canAccessRecord(ctx({ owd: 'read' }), { userId: 'other' }), true);
  });
  it('private: true only when an owner field is in the visible set', () => {
    const c = ctx({ owd: 'private', visibleUserIds: ['u1', 'u2'] });
    assert.equal(canAccessRecord(c, { userId: 'u2' }), true);
    assert.equal(canAccessRecord(c, { userId: 'u9' }), false);
    assert.equal(canAccessRecord(c, { data: { assignedTo: 'u1' } }), true);
    assert.equal(canAccessRecord(c, { data: { owner: 'u9' } }), false);
  });
});
