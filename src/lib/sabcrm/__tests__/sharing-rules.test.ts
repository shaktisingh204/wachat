/**
 * Unit tests for the PURE sharing-rules model (`../sharing-rules.ts`).
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/sharing-rules.test.ts`
 *
 * These lock the SECURITY-CRITICAL invariants: the model is ADDITIVE and
 * DENY-by-default. A viewer who is not in a rule's target set gains NOTHING;
 * an object with no rules grants NOTHING; an unresolved source/criteria shares
 * NOTHING.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  viewerInTarget,
  extraAccessFor,
  computeSharedRecordFilter,
  sharingCriteriaFields,
  type SharingRule,
  type SharingViewer,
} from '../sharing-rules';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                     */
/* -------------------------------------------------------------------------- */

const VIEWER: SharingViewer = {
  userId: 'u_finance',
  roleId: 'role_finance',
  groupIds: ['grp_finance'],
};

const ownerRule = (over: Partial<SharingRule> = {}): SharingRule => ({
  id: 'r_owner',
  object: 'opportunities',
  type: 'owner',
  enabled: true,
  shareWith: { kind: 'users', userIds: ['u_finance'] },
  ownerScope: { kind: 'users', userIds: ['u_emea_rep'] },
  ...over,
});

const criteriaRule = (over: Partial<SharingRule> = {}): SharingRule => ({
  id: 'r_crit',
  object: 'opportunities',
  type: 'criteria',
  enabled: true,
  shareWith: { kind: 'role', roleId: 'role_finance' },
  criteria: [{ field: 'stage', op: 'eq', value: 'Closed Won' }],
  ...over,
});

/* -------------------------------------------------------------------------- */
/* viewerInTarget — DENY-by-default membership                                  */
/* -------------------------------------------------------------------------- */

test('viewerInTarget: users target matches a listed user, denies others', () => {
  assert.equal(
    viewerInTarget({ kind: 'users', userIds: ['u_finance'] }, VIEWER),
    true,
  );
  assert.equal(
    viewerInTarget({ kind: 'users', userIds: ['u_other'] }, VIEWER),
    false,
  );
});

test('viewerInTarget: role target matches the viewer role, denies mismatch', () => {
  assert.equal(viewerInTarget({ kind: 'role', roleId: 'role_finance' }, VIEWER), true);
  assert.equal(viewerInTarget({ kind: 'role', roleId: 'role_sales' }, VIEWER), false);
});

test('viewerInTarget: group target matches resolved ids OR a viewer group', () => {
  assert.equal(
    viewerInTarget({ kind: 'group', groupId: 'grp_finance' }, VIEWER),
    true,
  );
  assert.equal(
    viewerInTarget({ kind: 'group', userIds: ['u_finance'] }, VIEWER),
    true,
  );
  assert.equal(
    viewerInTarget({ kind: 'group', groupId: 'grp_other' }, VIEWER),
    false,
  );
});

test('viewerInTarget: empty / malformed target denies', () => {
  assert.equal(viewerInTarget(undefined, VIEWER), false);
  assert.equal(viewerInTarget({ kind: 'users' }, VIEWER), false);
  assert.equal(viewerInTarget({ kind: 'role' }, VIEWER), false);
  assert.equal(
    viewerInTarget({ kind: 'users', userIds: ['u_finance'] }, {
      userId: '',
    } as SharingViewer),
    false,
  );
});

/* -------------------------------------------------------------------------- */
/* owner-share                                                                  */
/* -------------------------------------------------------------------------- */

test('owner-share: targeted viewer gains access to records owned by the source set', () => {
  const rules = [ownerRule()];
  // Record owned by the source rep (top-level userId).
  assert.equal(
    extraAccessFor({ object: 'opportunities', userId: 'u_emea_rep' }, rules, VIEWER),
    true,
  );
  // Record owned via data.assignedTo also counts.
  assert.equal(
    extraAccessFor(
      { object: 'opportunities', data: { assignedTo: 'u_emea_rep' } },
      rules,
      VIEWER,
    ),
    true,
  );
  // Record owned by someone NOT in the source set → no extra access.
  assert.equal(
    extraAccessFor({ object: 'opportunities', userId: 'u_someone_else' }, rules, VIEWER),
    false,
  );
});

test('owner-share: emits an additive owner $or clause for the source ids', () => {
  const clause = computeSharedRecordFilter([ownerRule()], VIEWER);
  assert.ok(clause, 'expected a clause');
  // Single owner rule → the owner $or directly.
  assert.deepEqual(clause, {
    $or: [
      { userId: { $in: ['u_emea_rep'] } },
      { 'data.assignedTo': { $in: ['u_emea_rep'] } },
      { 'data.owner': { $in: ['u_emea_rep'] } },
      { 'data.ownerId': { $in: ['u_emea_rep'] } },
    ],
  });
});

/* -------------------------------------------------------------------------- */
/* criteria-share                                                               */
/* -------------------------------------------------------------------------- */

test('criteria-share: targeted viewer gains access to matching records only', () => {
  const rules = [criteriaRule()];
  assert.equal(
    extraAccessFor(
      { object: 'opportunities', userId: 'u_anyone', data: { stage: 'Closed Won' } },
      rules,
      VIEWER,
    ),
    true,
  );
  assert.equal(
    extraAccessFor(
      { object: 'opportunities', userId: 'u_anyone', data: { stage: 'Negotiation' } },
      rules,
      VIEWER,
    ),
    false,
  );
});

test('criteria-share: ALL conditions must match (ANDed)', () => {
  const rule = criteriaRule({
    criteria: [
      { field: 'stage', op: 'eq', value: 'Closed Won' },
      { field: 'amount', op: 'gte', value: 1000 },
    ],
  });
  assert.equal(
    extraAccessFor({ data: { stage: 'Closed Won', amount: 5000 } }, [rule], VIEWER),
    true,
  );
  // One condition fails → no access.
  assert.equal(
    extraAccessFor({ data: { stage: 'Closed Won', amount: 10 } }, [rule], VIEWER),
    false,
  );
});

test('criteria-share: emits a Mongo clause on the data path', () => {
  const clause = computeSharedRecordFilter([criteriaRule()], VIEWER);
  assert.deepEqual(clause, { 'data.stage': 'Closed Won' });
});

/* -------------------------------------------------------------------------- */
/* no-rule = no-extra (DENY-by-default)                                         */
/* -------------------------------------------------------------------------- */

test('no-rule: empty rule list grants no extra access and no clause', () => {
  assert.equal(extraAccessFor({ userId: 'u_anyone' }, [], VIEWER), false);
  assert.equal(computeSharedRecordFilter([], VIEWER), null);
});

test('disabled rule grants nothing', () => {
  const rules = [ownerRule({ enabled: false })];
  assert.equal(extraAccessFor({ userId: 'u_emea_rep' }, rules, VIEWER), false);
  assert.equal(computeSharedRecordFilter(rules, VIEWER), null);
});

test('rule for a different object does not apply', () => {
  const rules = [criteriaRule({ object: 'accounts' })];
  assert.equal(
    extraAccessFor(
      { object: 'opportunities', data: { stage: 'Closed Won' } },
      rules,
      VIEWER,
    ),
    false,
  );
});

/* -------------------------------------------------------------------------- */
/* viewer-not-in-target = no-extra                                             */
/* -------------------------------------------------------------------------- */

test('viewer-not-in-target: criteria rule targeting another role grants nothing', () => {
  const rules = [criteriaRule({ shareWith: { kind: 'role', roleId: 'role_sales' } })];
  // The record MATCHES the criteria, but the viewer is not in the target set.
  assert.equal(
    extraAccessFor({ data: { stage: 'Closed Won' } }, rules, VIEWER),
    false,
  );
  assert.equal(computeSharedRecordFilter(rules, VIEWER), null);
});

test('viewer-not-in-target: owner rule targeting other users grants nothing', () => {
  const rules = [ownerRule({ shareWith: { kind: 'users', userIds: ['u_not_me'] } })];
  assert.equal(extraAccessFor({ userId: 'u_emea_rep' }, rules, VIEWER), false);
  assert.equal(computeSharedRecordFilter(rules, VIEWER), null);
});

/* -------------------------------------------------------------------------- */
/* unresolved source / empty criteria share nothing (fail toward less access)  */
/* -------------------------------------------------------------------------- */

test('owner rule with unresolved (empty) source shares nothing', () => {
  const rules = [ownerRule({ ownerScope: { kind: 'role', roleId: 'role_x', userIds: [] } })];
  assert.equal(extraAccessFor({ userId: 'u_emea_rep' }, rules, VIEWER), false);
  assert.equal(computeSharedRecordFilter(rules, VIEWER), null);
});

test('criteria rule with no conditions shares nothing', () => {
  const rules = [criteriaRule({ criteria: [] })];
  assert.equal(extraAccessFor({ data: { stage: 'Closed Won' } }, rules, VIEWER), false);
  assert.equal(computeSharedRecordFilter(rules, VIEWER), null);
});

/* -------------------------------------------------------------------------- */
/* injection defence                                                           */
/* -------------------------------------------------------------------------- */

test('criteria with an operator-bearing value is dropped (no smuggled operator)', () => {
  const rules = [
    criteriaRule({
      criteria: [{ field: 'stage', op: 'eq', value: { $ne: null } as unknown }],
    }),
  ];
  // The only condition is dropped → criteria clause is null → no share.
  assert.equal(computeSharedRecordFilter(rules, VIEWER), null);
});

test('criteria field with a dotted/$-path is rejected', () => {
  const rules = [
    criteriaRule({ criteria: [{ field: 'a.b', op: 'eq', value: 'x' }] }),
  ];
  assert.equal(computeSharedRecordFilter(rules, VIEWER), null);
});

/* -------------------------------------------------------------------------- */
/* multiple rules combine into a single $or                                     */
/* -------------------------------------------------------------------------- */

test('multiple applicable rules combine into a top-level $or', () => {
  const clause = computeSharedRecordFilter([ownerRule(), criteriaRule()], VIEWER);
  assert.ok(clause && Array.isArray((clause as { $or?: unknown[] }).$or));
  assert.equal((clause as { $or: unknown[] }).$or.length, 2);
});

/* -------------------------------------------------------------------------- */
/* helpers                                                                      */
/* -------------------------------------------------------------------------- */

test('sharingCriteriaFields returns distinct referenced fields', () => {
  const rule = criteriaRule({
    criteria: [
      { field: 'stage', op: 'eq', value: 'Closed Won' },
      { field: 'amount', op: 'gte', value: 1 },
      { field: 'stage', op: 'neq', value: 'Lost' },
    ],
  });
  assert.deepEqual(sharingCriteriaFields(rule).sort(), ['amount', 'stage']);
});
