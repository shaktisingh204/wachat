/**
 * Exhaustive RBAC matrix test for SabFlow document-scoped roles.
 *
 *   npx tsx --test src/lib/sabflow/access/__tests__/rbac-matrix.test.ts
 *
 * The matrix in `matrix.json` is the source of truth: 5 roles × 12 actions =
 * 60 (role, action) → allow|deny pairs. Each entry becomes a `node:test` case
 * that calls `canDo(role, action)` and asserts the boolean matches `expected`.
 *
 * `canDo` is the contract exported from sibling sub-task #2's `../roles.ts`.
 * That file is forward-declared by Track A Phase 8 sequencing and has not
 * landed yet, so we provide a minimal reference implementation here that
 * MUST stay byte-equivalent to the matrix. When `../roles.ts` lands, swap
 * the import block below from local-forward-decl to:
 *
 *     import { canDo, type DocRole, type DocAction } from '../roles';
 *
 * and delete the `// — forward-decl block —` region. The matrix file does
 * not change.
 *
 * Sub-task #9 (workspace-admin override) is smoke-tested at the bottom:
 * a workspace-admin principal must be authorized for every action regardless
 * of the document-role they hold (or lack).
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* ── Forward-decl block ──────────────────────────────────────────────────────
 * Mirrors the contract of `../roles.ts` (sibling sub-task #2). Reference
 * implementation is matrix-faithful so the test file is self-contained until
 * the production module lands. */

export type DocRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER' | 'NONE';

export type DocAction =
  | 'doc.read'
  | 'doc.write'
  | 'doc.delete'
  | 'doc.share'
  | 'doc.comment'
  | 'doc.export'
  | 'doc.fork'
  | 'owner.transfer'
  | 'share_link.create'
  | 'share_link.revoke'
  | 'invite.send'
  | 'credentials.read';

/**
 * Workspace-level principal context (sub-task #9). When `workspaceAdmin` is
 * true, `canDo` short-circuits to `true` regardless of the doc-role argument.
 */
export interface PrincipalCtx {
  workspaceAdmin?: boolean;
}

/** Reference allow-table — must match matrix.json exactly. */
const REFERENCE_ALLOW: Record<DocRole, ReadonlySet<DocAction>> = {
  OWNER: new Set<DocAction>([
    'doc.read', 'doc.write', 'doc.delete', 'doc.share', 'doc.comment',
    'doc.export', 'doc.fork', 'owner.transfer', 'share_link.create',
    'share_link.revoke', 'invite.send', 'credentials.read',
  ]),
  EDITOR: new Set<DocAction>([
    'doc.read', 'doc.write', 'doc.share', 'doc.comment',
    'doc.export', 'doc.fork', 'share_link.create', 'invite.send',
  ]),
  COMMENTER: new Set<DocAction>([
    'doc.read', 'doc.comment', 'doc.export', 'doc.fork',
  ]),
  VIEWER: new Set<DocAction>([
    'doc.read', 'doc.export', 'doc.fork',
  ]),
  NONE: new Set<DocAction>(),
};

export function canDo(role: DocRole, action: DocAction, ctx: PrincipalCtx = {}): boolean {
  if (ctx.workspaceAdmin === true) return true; // sub-task #9 override
  const grants = REFERENCE_ALLOW[role];
  if (!grants) return false;
  return grants.has(action);
}

/* ── /Forward-decl block ─────────────────────────────────────────────────── */

/* ── Matrix loader ───────────────────────────────────────────────────────── */

type Expected = 'allow' | 'deny';

interface MatrixEntry {
  role: DocRole;
  action: DocAction;
  expected: Expected;
  note?: string;
}

interface Matrix {
  roles: DocRole[];
  actions: DocAction[];
  entries: MatrixEntry[];
}

function loadMatrix(): Matrix {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(here, 'matrix.json'), 'utf8');
  const parsed = JSON.parse(raw) as Matrix & { $comment?: string };
  return {
    roles: parsed.roles,
    actions: parsed.actions,
    entries: parsed.entries,
  };
}

const matrix = loadMatrix();

/* ── Matrix integrity guards ────────────────────────────────────────────── */

test('matrix.json declares 5 roles and 12 actions', () => {
  assert.equal(matrix.roles.length, 5, `expected 5 roles, got ${matrix.roles.length}`);
  assert.equal(matrix.actions.length, 12, `expected 12 actions, got ${matrix.actions.length}`);
});

test('matrix.json is exhaustive: every (role, action) pair appears exactly once', () => {
  const expectedSize = matrix.roles.length * matrix.actions.length;
  assert.equal(
    matrix.entries.length,
    expectedSize,
    `expected ${expectedSize} entries (${matrix.roles.length}×${matrix.actions.length}), got ${matrix.entries.length}`,
  );

  const seen = new Set<string>();
  for (const e of matrix.entries) {
    const key = `${e.role}|${e.action}`;
    assert.ok(!seen.has(key), `duplicate matrix entry for ${key}`);
    seen.add(key);
    assert.ok(matrix.roles.includes(e.role), `entry uses unknown role: ${e.role}`);
    assert.ok(matrix.actions.includes(e.action), `entry uses unknown action: ${e.action}`);
    assert.ok(
      e.expected === 'allow' || e.expected === 'deny',
      `entry ${key} has invalid expected '${e.expected}'`,
    );
  }
});

/* ── Per-entry assertion loop ───────────────────────────────────────────── */

for (const entry of matrix.entries) {
  const label = `${entry.role} ${entry.expected === 'allow' ? 'CAN' : 'CANNOT'} ${entry.action}`;
  test(`rbac: ${label}`, () => {
    const got = canDo(entry.role, entry.action);
    const gotLabel = got ? 'ALLOW' : 'DENY';
    if (entry.expected === 'allow') {
      assert.equal(
        got,
        true,
        `expected ${entry.role} to be allowed to ${entry.action} but got ${gotLabel}` +
          (entry.note ? ` (matrix note: ${entry.note})` : ''),
      );
    } else {
      assert.equal(
        got,
        false,
        `expected ${entry.role} to be denied ${entry.action} but got ${gotLabel}` +
          (entry.note ? ` (matrix note: ${entry.note})` : ''),
      );
    }
  });
}

/* ── Admin-override smoke test (sub-task #9) ────────────────────────────── */

test('workspace admin override: admin is authorized for every action regardless of doc-role', () => {
  for (const role of matrix.roles) {
    for (const action of matrix.actions) {
      const got = canDo(role, action, { workspaceAdmin: true });
      assert.equal(
        got,
        true,
        `workspace admin override failed: role=${role} action=${action} returned DENY, expected ALLOW`,
      );
    }
  }
});

test('workspace admin override: omitting the flag preserves doc-role semantics', () => {
  // Sanity: NONE without override is still denied everywhere.
  for (const action of matrix.actions) {
    assert.equal(
      canDo('NONE', action),
      false,
      `NONE without admin override should deny ${action}`,
    );
    assert.equal(
      canDo('NONE', action, { workspaceAdmin: false }),
      false,
      `NONE with workspaceAdmin=false should deny ${action}`,
    );
  }
});
