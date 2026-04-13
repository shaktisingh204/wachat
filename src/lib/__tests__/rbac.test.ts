/**
 * Pure unit tests for `src/lib/rbac.ts`. Runs with Node's built-in `node:test`
 * + `tsx` so no extra deps are required:
 *
 *   pnpm test:rbac     (or)    npx tsx --test src/lib/__tests__/rbac.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    can,
    canView,
    intersectWithCeiling,
    isElevatedRole,
    type EffectivePermissions,
} from '../rbac';

const EMPTY: EffectivePermissions = {
    role: 'agent',
    isOwner: false,
    permissions: {},
};

test('can() returns false for null permissions', () => {
    assert.equal(can(null, 'team_users', 'view'), false);
    assert.equal(can(undefined, 'team_users', 'view'), false);
});

test('can() returns true for owner when plan has no entry', () => {
    const p: EffectivePermissions = { role: 'owner', isOwner: true, permissions: {}, planCeiling: {} };
    assert.equal(can(p, 'team_users', 'view'), true);
    assert.equal(can(p, 'team_users', 'create'), true);
});

test('can() respects plan ceiling for owner', () => {
    const p: EffectivePermissions = {
        role: 'owner',
        isOwner: true,
        permissions: {},
        planCeiling: { team_users: { view: true, create: false } },
    };
    assert.equal(can(p, 'team_users', 'view'), true);
    assert.equal(can(p, 'team_users', 'create'), false);
    // Actions not in ceiling default to allowed.
    assert.equal(can(p, 'team_users', 'edit'), true);
});

test('can() checks role grants for non-owner', () => {
    const p: EffectivePermissions = {
        role: 'agent',
        isOwner: false,
        permissions: {
            team_users: { view: true, create: false },
        },
    };
    assert.equal(can(p, 'team_users', 'view'), true);
    assert.equal(can(p, 'team_users', 'create'), false);
    // Unknown module → denied.
    assert.equal(can(p, 'crm_clients', 'view'), false);
});

test('canView() is a shortcut for can(…, "view")', () => {
    const p: EffectivePermissions = {
        role: 'agent',
        isOwner: false,
        permissions: { team_tasks: { view: true } },
    };
    assert.equal(canView(p, 'team_tasks'), true);
    assert.equal(canView(p, 'team_users'), false);
});

test('intersectWithCeiling() clamps role grants by plan', () => {
    const result = intersectWithCeiling(
        { team_users: { view: true, create: true, edit: true } },
        { team_users: { view: true, create: false } },
    );
    assert.deepEqual(result.team_users, {
        view: true,
        create: false,
        edit: true, // plan doesn't mention edit → treated as allowed
        delete: false, // role didn't grant
    });
});

test('intersectWithCeiling() tolerates missing inputs', () => {
    assert.deepEqual(intersectWithCeiling(undefined, undefined), {});
    assert.deepEqual(intersectWithCeiling({}, undefined), {});
    assert.deepEqual(
        intersectWithCeiling({ team_users: { view: true } }, undefined),
        { team_users: { view: true } },
    );
});

test('isElevatedRole() flags owner + admin only', () => {
    assert.equal(isElevatedRole('admin'), true);
    assert.equal(isElevatedRole('owner'), true);
    assert.equal(isElevatedRole('agent'), false);
    assert.equal(isElevatedRole(undefined), false);
    assert.equal(isElevatedRole(null), false);
    assert.equal(isElevatedRole(''), false);
});

test('EMPTY permissions deny everything', () => {
    assert.equal(can(EMPTY, 'team_users', 'view'), false);
    assert.equal(can(EMPTY, 'team_users', 'create'), false);
    assert.equal(can(EMPTY, 'team_users', 'edit'), false);
    assert.equal(can(EMPTY, 'team_users', 'delete'), false);
});
