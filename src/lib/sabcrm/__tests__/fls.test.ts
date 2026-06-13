/**
 * Unit tests for the PURE field-level-security evaluators (`../fls.ts`).
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/fls.test.ts`
 *
 * Covers the security-critical invariants:
 *  - no policy ⇒ `editable` (FLS-off behaves EXACTLY as today),
 *  - `hidden` strips the field from read data,
 *  - `readonly` (and `hidden`) blocks a write that touches the field,
 *  - role-specific rule beats the `'*'` wildcard,
 *  - same-specificity conflicts fail toward LESS access (fail-closed),
 *  - malformed policies are rejected (never silently widen access).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  effectiveAccess,
  visibleFields,
  hiddenFields,
  redactRecord,
  blockedWriteFields,
  normalizePolicy,
  FLS_ANY_ROLE,
  type FlsPolicy,
} from '../fls';

const ALL_FIELDS = ['name', 'revenue', 'ssn', 'stage'];

/* -------------------------------------------------------------------------- */
/* Default = editable (FLS-off parity)                                         */
/* -------------------------------------------------------------------------- */

test('no policy ⇒ editable for every field/role (off == unchanged)', () => {
  assert.equal(effectiveAccess([], 'view', 'revenue'), 'editable');
  assert.equal(effectiveAccess([], 'admin', 'ssn'), 'editable');
  assert.deepEqual(visibleFields([], 'view', ALL_FIELDS), ALL_FIELDS);
  assert.deepEqual(hiddenFields([], 'view', ALL_FIELDS), []);
  assert.deepEqual(blockedWriteFields([], 'view', ['name', 'revenue']), []);
});

test('a field with no matching policy stays editable even when others restricted', () => {
  const policies: FlsPolicy[] = [
    { object: 'companies', field: 'ssn', role: 'view', access: 'hidden' },
  ];
  assert.equal(effectiveAccess(policies, 'view', 'name'), 'editable');
  assert.equal(effectiveAccess(policies, 'view', 'revenue'), 'editable');
});

/* -------------------------------------------------------------------------- */
/* hidden ⇒ stripped on read                                                   */
/* -------------------------------------------------------------------------- */

test('hidden fields are stripped from read data via redactRecord', () => {
  const policies: FlsPolicy[] = [
    { object: 'companies', field: 'ssn', role: 'view', access: 'hidden' },
    { object: 'companies', field: 'revenue', role: 'view', access: 'readonly' },
  ];
  const hidden = hiddenFields(policies, 'view', ALL_FIELDS);
  assert.deepEqual(hidden, ['ssn']);
  assert.deepEqual(visibleFields(policies, 'view', ALL_FIELDS), [
    'name',
    'revenue',
    'stage',
  ]);

  const rec = {
    _id: 'r1',
    userId: 'u1',
    data: { name: 'Acme', revenue: 100, ssn: 'SECRET', stage: 'new' },
  };
  const redacted = redactRecord(rec, hidden);
  assert.equal('ssn' in redacted.data, false, 'ssn stripped');
  assert.equal(redacted.data.revenue, 100, 'readonly field still visible');
  assert.equal(redacted.data.name, 'Acme');
  // Original is untouched (no mutation).
  assert.equal(rec.data.ssn, 'SECRET');
  // Top-level columns preserved.
  assert.equal(redacted._id, 'r1');
  assert.equal(redacted.userId, 'u1');
});

test('redactRecord with empty hidden list is a structural no-op', () => {
  const rec = { data: { a: 1, b: 2 } };
  const out = redactRecord(rec, []);
  assert.deepEqual(out.data, { a: 1, b: 2 });
  assert.notEqual(out.data, rec.data, 'returns a fresh data clone');
});

test('redactRecord tolerates a record with no data map', () => {
  const rec = { _id: 'x' } as { _id: string; data?: Record<string, unknown> };
  const out = redactRecord(rec, ['ssn']);
  assert.deepEqual(out.data, {});
  assert.equal(out._id, 'x');
});

/* -------------------------------------------------------------------------- */
/* readonly / hidden ⇒ blocked on write                                        */
/* -------------------------------------------------------------------------- */

test('readonly write is blocked; editable write is allowed', () => {
  const policies: FlsPolicy[] = [
    { object: 'companies', field: 'revenue', role: 'view', access: 'readonly' },
  ];
  assert.deepEqual(
    blockedWriteFields(policies, 'view', ['name', 'revenue']),
    ['revenue'],
  );
  assert.deepEqual(blockedWriteFields(policies, 'view', ['name']), []);
});

test('hidden write is also blocked (cannot edit what you cannot see)', () => {
  const policies: FlsPolicy[] = [
    { object: 'companies', field: 'ssn', role: 'view', access: 'hidden' },
  ];
  assert.deepEqual(blockedWriteFields(policies, 'view', ['ssn', 'name']), [
    'ssn',
  ]);
});

/* -------------------------------------------------------------------------- */
/* role matching + specificity                                                 */
/* -------------------------------------------------------------------------- */

test('a policy only applies to the role it names', () => {
  const policies: FlsPolicy[] = [
    { object: 'companies', field: 'revenue', role: 'view', access: 'hidden' },
  ];
  assert.equal(effectiveAccess(policies, 'view', 'revenue'), 'hidden');
  assert.equal(
    effectiveAccess(policies, 'admin', 'revenue'),
    'editable',
    'admin unaffected by a view-only rule',
  );
});

test('exact-role rule overrides the wildcard base rule', () => {
  const policies: FlsPolicy[] = [
    { object: 'companies', field: 'revenue', role: FLS_ANY_ROLE, access: 'hidden' },
    { object: 'companies', field: 'revenue', role: 'admin', access: 'editable' },
  ];
  // admin gets the exact rule (editable), everyone else the wildcard (hidden).
  assert.equal(effectiveAccess(policies, 'admin', 'revenue'), 'editable');
  assert.equal(effectiveAccess(policies, 'view', 'revenue'), 'hidden');
  assert.equal(effectiveAccess(policies, 'manage', 'revenue'), 'hidden');
});

/* -------------------------------------------------------------------------- */
/* fail-closed on conflicting / corrupt config                                 */
/* -------------------------------------------------------------------------- */

test('conflicting same-specificity rules resolve to the MORE restrictive level', () => {
  const policies: FlsPolicy[] = [
    { object: 'companies', field: 'revenue', role: 'view', access: 'readonly' },
    { object: 'companies', field: 'revenue', role: 'view', access: 'hidden' },
    { object: 'companies', field: 'revenue', role: 'view', access: 'editable' },
  ];
  assert.equal(
    effectiveAccess(policies, 'view', 'revenue'),
    'hidden',
    'most restrictive wins — never widens',
  );
});

test('conflicting wildcard rules also resolve to the more restrictive level', () => {
  const policies: FlsPolicy[] = [
    { object: 'companies', field: 'ssn', role: FLS_ANY_ROLE, access: 'editable' },
    { object: 'companies', field: 'ssn', role: FLS_ANY_ROLE, access: 'readonly' },
  ];
  assert.equal(effectiveAccess(policies, 'view', 'ssn'), 'readonly');
});

/* -------------------------------------------------------------------------- */
/* normalizePolicy rejects malformed input                                     */
/* -------------------------------------------------------------------------- */

test('normalizePolicy validates and trims well-formed rules', () => {
  const ok = normalizePolicy({
    object: ' companies ',
    field: ' revenue ',
    role: ' view ',
    access: 'hidden',
  });
  assert.deepEqual(ok, {
    object: 'companies',
    field: 'revenue',
    role: 'view',
    access: 'hidden',
  });
});

test('normalizePolicy rejects unknown/missing fields (never silently widens)', () => {
  assert.equal(normalizePolicy(null), null);
  assert.equal(normalizePolicy({}), null);
  assert.equal(
    normalizePolicy({ object: 'c', field: 'f', role: 'view', access: 'public' }),
    null,
    'unknown access level rejected',
  );
  assert.equal(
    normalizePolicy({ object: '', field: 'f', role: 'view', access: 'hidden' }),
    null,
    'empty object rejected',
  );
  assert.equal(
    normalizePolicy({ object: 'c', field: 'f', role: '', access: 'hidden' }),
    null,
    'empty role rejected',
  );
});
