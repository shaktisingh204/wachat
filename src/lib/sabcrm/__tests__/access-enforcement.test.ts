/**
 * Unit tests for the permission-ENFORCEMENT pure core (`../access-enforcement`).
 *
 *   npx tsx --test src/lib/sabcrm/__tests__/access-enforcement.test.ts
 *
 * Covers the safety contract: default-OFF → passthrough; enforce → intersect
 * with the accessible set; elevated/admin → unrestricted owner scope; and
 * deny-by-default when no positive clause is available.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  enforcementMode,
  mergeAccessClauses,
  enforcementClause,
  DENY_ALL_CLAUSE,
  type AccessFlagDoc,
  type MongoClause,
} from '../access-enforcement';

/* -------------------------------------------------------------------------- */
/* enforcementMode — default-OFF, only explicit enabled===true turns it on    */
/* -------------------------------------------------------------------------- */

describe('enforcementMode', () => {
  it('null / undefined flag → off (passthrough, behave as today)', () => {
    assert.equal(enforcementMode(null), 'off');
    assert.equal(enforcementMode(undefined), 'off');
  });

  it('missing enabled field → off', () => {
    assert.equal(enforcementMode({ projectId: 'p1' } as AccessFlagDoc), 'off');
  });

  it('enabled:false → off', () => {
    assert.equal(
      enforcementMode({ projectId: 'p1', enabled: false }),
      'off',
    );
  });

  it('truthy-but-not-true values → off (no silent enable)', () => {
    // Intentionally malformed docs: only a real boolean true may enable.
    const oneish = { projectId: 'p1', enabled: 1 } as unknown as AccessFlagDoc;
    const strish = { projectId: 'p1', enabled: 'true' } as unknown as AccessFlagDoc;
    const objish = { projectId: 'p1', enabled: {} } as unknown as AccessFlagDoc;
    assert.equal(enforcementMode(oneish), 'off');
    assert.equal(enforcementMode(strish), 'off');
    assert.equal(enforcementMode(objish), 'off');
  });

  it('enabled:true → enforce (the only on switch)', () => {
    assert.equal(enforcementMode({ projectId: 'p1', enabled: true }), 'enforce');
  });
});

/* -------------------------------------------------------------------------- */
/* mergeAccessClauses — deny-narrowing only                                   */
/* -------------------------------------------------------------------------- */

describe('mergeAccessClauses', () => {
  const owner: MongoClause = { projectId: 'p1', userId: { $in: ['u1'] } };

  it('owner scope only → returned unchanged (no empty $and)', () => {
    assert.deepEqual(mergeAccessClauses(owner), owner);
    assert.deepEqual(
      mergeAccessClauses(owner, null, undefined, null),
      owner,
    );
  });

  it('owner scope + one extra → intersect under $and', () => {
    const sharing: MongoClause = { 'data.team': 'sales' };
    assert.deepEqual(mergeAccessClauses(owner, null, sharing, null), {
      $and: [owner, sharing],
    });
  });

  it('owner scope + role subtree + sharing + territory → all ANDed in order', () => {
    const role: MongoClause = { 'data.assignedTo': { $in: ['u1', 'u2'] } };
    const sharing: MongoClause = { 'data.shared': true };
    const territory: MongoClause = { 'data.region': { $in: ['EMEA'] } };
    assert.deepEqual(mergeAccessClauses(owner, role, sharing, territory), {
      $and: [owner, role, sharing, territory],
    });
  });

  it('empty extra clauses are skipped (never emit an empty $and element)', () => {
    const sharing: MongoClause = { 'data.shared': true };
    assert.deepEqual(mergeAccessClauses(owner, {}, sharing, {}), {
      $and: [owner, sharing],
    });
  });

  it('admin/elevated owner scope (projectId only) → unrestricted, unchanged', () => {
    // The compiler hands an elevated actor a `{ projectId }`-only scope; with no
    // extra narrowing clauses it must stay unrestricted (full tenant scope).
    const elevated: MongoClause = { projectId: 'p1' };
    assert.deepEqual(mergeAccessClauses(elevated), { projectId: 'p1' });
  });

  it('deny-by-default: NO owner scope and NO extras → matches nothing', () => {
    assert.deepEqual(mergeAccessClauses({}), { ...DENY_ALL_CLAUSE });
  });

  it('deny-by-default: empty owner scope but extras present still narrows', () => {
    const sharing: MongoClause = { 'data.shared': true };
    // Empty owner scope is dropped; the single surviving clause is the sharing
    // predicate — it can only narrow, never widen.
    assert.deepEqual(mergeAccessClauses({}, null, sharing, null), sharing);
  });
});

/* -------------------------------------------------------------------------- */
/* enforcementClause — the caller-facing decision (off → null passthrough)    */
/* -------------------------------------------------------------------------- */

describe('enforcementClause', () => {
  it('off → null (passthrough; the read is identical to today)', () => {
    assert.equal(enforcementClause('off', { projectId: 'p1' }), null);
    assert.equal(enforcementClause('off', null), null);
  });

  it('enforce + a real accessible clause → that clause', () => {
    const accessible: MongoClause = { projectId: 'p1', userId: { $in: ['u1'] } };
    assert.deepEqual(enforcementClause('enforce', accessible), accessible);
  });

  it('enforce + missing accessible clause → deny-all (fail closed)', () => {
    assert.deepEqual(enforcementClause('enforce', null), { ...DENY_ALL_CLAUSE });
    assert.deepEqual(enforcementClause('enforce', {}), { ...DENY_ALL_CLAUSE });
  });
});
