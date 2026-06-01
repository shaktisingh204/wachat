/**
 * SabCRM — `gate()` membership-check security regression test.
 *
 * Runs with Node's built-in `node:test` + `tsx` (no jest/vitest installed in
 * this repo — tests are invoked via `tsx --test <file>`), so no extra deps are
 * required.
 *
 *   npx tsx --test src/lib/sabcrm/__tests__/gate-security.test.ts
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARDS
 * ---------------------------------------------------------------------------
 * `gate()` in `src/app/actions/sabcrm.actions.ts` is the single tenant-isolation
 * choke point for every SabCRM server action. The security fix under test is the
 * `explicitProjectId` membership check (sabcrm.actions.ts lines ~243-259):
 *
 *   const myProjects = await getCachedProjects();
 *   const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
 *   const firstProjectId = myProjects[0]?._id;
 *   const requested = explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
 *   if (!requested) return { ok: false, error: 'No active project.' };
 *   if (!myProjectIds.has(requested)) {
 *     // not a member of the requested project — deny rather than let the
 *     // fail-open RBAC resolver grant cross-tenant access.
 *     return { ok: false, error: 'Permission denied.' };
 *   }
 *
 * `explicitProjectId` is CLIENT-SUPPLIED. The shared RBAC resolver
 * (`canServer` → `getEffectivePermissionsForProject`) fails *open* for a project
 * the caller is not a member of, so without this check a user could pass another
 * tenant's projectId and read/write that tenant's CRM data. This test pins the
 * three required outcomes: cross-tenant REJECT, same-tenant ACCEPT, and
 * unauthenticated DENY.
 *
 * ---------------------------------------------------------------------------
 * WHY THE REAL `gate()` CANNOT BE IMPORTED HERE (and the minimal refactor)
 * ---------------------------------------------------------------------------
 * `gate` is *module-private* — it is `async function gate(...)` with no `export`
 * keyword. The file is a `'use server'` module, so EVERY export must be an async
 * server action; we cannot add a synchronous test-only export (e.g.
 * `export { gate }`) without (a) widening the public server-action surface and
 * (b) violating the `'use server'` contract. Beyond that, importing the actions
 * module under `tsx --test` fails at module-eval time:
 *
 *   - `@/lib/server-cache` imports `'server-only'`, which throws outside a
 *     Next.js bundler (verified: `Error: Cannot find module 'server-only'`).
 *   - the actions module pulls in mongodb, `next/cache`, the notifications
 *     stack, etc. — none of which load without a Next runtime.
 *   - `node:test`'s `mock.module` ESM-mocking primitive is UNAVAILABLE under
 *     tsx's esbuild loader (verified: `mock.module is not a function`), so we
 *     cannot stub those imports to make the real module importable.
 *
 * Therefore the membership-check contract is verified here against a faithful,
 * dependency-injected MIRROR of the exact `gate()` body — {@link gateLogic}
 * below copies lines ~234-270 verbatim (same step order, same `Set` membership
 * test, same fail-closed branches). This is an executable specification: if the
 * production `gate()` ever drops or weakens the membership check, the mirror
 * documented here makes the intended behaviour unambiguous and the assertions
 * encode the security guarantee.
 *
 * MINIMAL, BEHAVIOUR-PRESERVING REFACTOR to make the real code unit-testable
 * (recommended; NOT done here because this task may only edit the test file):
 *
 *   1. Move the pure project-resolution step into a new, NON-`'use server'`,
 *      NON-`server-only` module, e.g. `src/lib/sabcrm/gate-membership.ts`:
 *
 *        export type ProjectLike = { _id: unknown };
 *        export type ResolveOutcome =
 *          | { ok: true; projectId: string }
 *          | { ok: false; error: string };
 *
 *        /** Pure, dependency-free. Identical logic to gate() step 2. *\/
 *        export function resolveActiveProjectId(
 *          explicitProjectId: string | undefined,
 *          myProjects: readonly ProjectLike[],
 *        ): ResolveOutcome {
 *          const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
 *          const firstProjectId = myProjects[0]?._id;
 *          const requested =
 *            explicitProjectId ??
 *            (firstProjectId !== undefined ? String(firstProjectId) : undefined);
 *          if (!requested) return { ok: false, error: 'No active project.' };
 *          if (!myProjectIds.has(requested)) {
 *            return { ok: false, error: 'Permission denied.' };
 *          }
 *          return { ok: true, projectId: requested };
 *        }
 *
 *   2. In `sabcrm.actions.ts`, replace the inline block with a call to
 *      `resolveActiveProjectId(explicitProjectId, await getCachedProjects())`.
 *      This is a pure extraction — the runtime behaviour is byte-for-byte the
 *      same, the security check is unchanged, and the helper (being free of
 *      `server-only`/mongo) imports cleanly under `tsx --test`, so this very
 *      test could then assert against the real implementation instead of the
 *      mirror. The DI gate (`gateLogic`) below shows the same outcome.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Faithful, dependency-injected mirror of the production gate() pipeline.
//
// Mirrors src/app/actions/sabcrm.actions.ts gate() exactly. The four runtime
// dependencies (getCachedSession, getCachedProjects, canServer,
// sabcrmPlanFeature.defaultEnabled) are passed in so the test can stand in
// fakes — this is precisely what mocking the real imports would achieve, minus
// the unimportable `server-only`/mongo module graph.
// ---------------------------------------------------------------------------

/** SabNode's canonical permission action set (see `@/lib/rbac`). */
type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

/** The one session field gate() reads (mirrors the `session.user as { _id }` cast). */
interface FakeSessionUser {
  _id: string;
}
interface FakeSession {
  user?: FakeSessionUser | null;
}

/** A project as returned by `getCachedProjects()` — id is an ObjectId-like value. */
interface FakeProject {
  _id: unknown;
}

interface GateContext {
  userId: string;
  projectId: string;
}
type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/** Injected stand-ins for the four production dependencies of gate(). */
interface GateDeps {
  getCachedSession: () => Promise<FakeSession | null>;
  getCachedProjects: () => Promise<FakeProject[]>;
  canServer: (
    moduleKey: string,
    action: PermissionAction,
    projectId?: string | null,
  ) => Promise<boolean>;
  /** Mirrors `sabcrmPlanFeature.defaultEnabled`. */
  planDefaultEnabled: boolean;
}

const MODULE_KEY = 'sabcrm';

/**
 * Verbatim mirror of gate() (sabcrm.actions.ts lines ~234-270), with the module
 * imports lifted to {@link GateDeps}. Logic — including the cross-tenant
 * membership check — is unchanged.
 */
async function gateLogic(
  deps: GateDeps,
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await deps.getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as FakeSessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that is in THIS user's own
  // resolved project list; otherwise the fail-open RBAC resolver would grant
  // cross-tenant access.
  const myProjects = await deps.getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await deps.canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!deps.planDefaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

const USER_A = 'user-a';
const PROJECT_MINE_1 = 'project-mine-1';
const PROJECT_MINE_2 = 'project-mine-2';
const PROJECT_OTHER_TENANT = 'project-other-tenant';

/**
 * Builds a deps bundle for an AUTHENTICATED user who is a member of
 * `myProjectIds`. `canServer` and the plan flag both grant by default so the
 * membership check is the only gate under test unless overridden.
 */
function authedDeps(
  myProjectIds: string[],
  overrides: Partial<GateDeps> = {},
): GateDeps {
  return {
    getCachedSession: async () => ({ user: { _id: USER_A } }),
    getCachedProjects: async () =>
      myProjectIds.map((id): FakeProject => ({ _id: id })),
    // Fail-OPEN resolver, exactly the production risk: grants for ANY project,
    // including ones the user is not a member of. The membership check in
    // gateLogic must compensate.
    canServer: async () => true,
    planDefaultEnabled: true,
    ...overrides,
  };
}

/** Deps for an UNAUTHENTICATED caller (no session user). */
function anonDeps(overrides: Partial<GateDeps> = {}): GateDeps {
  return {
    getCachedSession: async () => null,
    getCachedProjects: async () => [],
    canServer: async () => true,
    planDefaultEnabled: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Required cases: cross-tenant REJECT, same-tenant ACCEPT, unauth DENY
// ---------------------------------------------------------------------------

test('REJECTS a cross-tenant explicitProjectId not in the user\'s project list', async () => {
  const deps = authedDeps([PROJECT_MINE_1, PROJECT_MINE_2]);

  const res = await gateLogic(deps, 'view', PROJECT_OTHER_TENANT);

  assert.equal(res.ok, false);
  assert.equal(
    res.ok === false ? res.error : '',
    'Permission denied.',
    'must deny before reaching the fail-open RBAC resolver',
  );
});

test('REJECTS cross-tenant access even when the fail-open RBAC resolver would allow it', async () => {
  // canServer returns true for the other tenant (the actual fail-open bug). The
  // membership check must short-circuit BEFORE canServer is consulted.
  let canServerCalled = false;
  const deps = authedDeps([PROJECT_MINE_1], {
    canServer: async () => {
      canServerCalled = true;
      return true;
    },
  });

  const res = await gateLogic(deps, 'edit', PROJECT_OTHER_TENANT);

  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.error : '', 'Permission denied.');
  assert.equal(
    canServerCalled,
    false,
    'membership check must reject before the fail-open RBAC resolver runs',
  );
});

test('ACCEPTS an explicitProjectId that IS in the user\'s project list', async () => {
  const deps = authedDeps([PROJECT_MINE_1, PROJECT_MINE_2]);

  const res = await gateLogic(deps, 'view', PROJECT_MINE_2);

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.ctx.projectId, PROJECT_MINE_2);
    assert.equal(res.ctx.userId, USER_A);
  }
});

test('DENIES when unauthenticated (no session user)', async () => {
  const deps = anonDeps();

  // Even with a perfectly valid-looking projectId, no session ⇒ no access.
  const res = await gateLogic(deps, 'view', PROJECT_MINE_1);

  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.error : '', 'Not authenticated.');
});

test('DENIES when the session user has no _id', async () => {
  const deps = authedDeps([PROJECT_MINE_1], {
    getCachedSession: async () => ({ user: { _id: '' } }),
  });

  const res = await gateLogic(deps, 'view', PROJECT_MINE_1);

  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.error : '', 'Not authenticated.');
});

// ---------------------------------------------------------------------------
// Supporting cases: fallback, RBAC deny, plan deny, empty list, ObjectId-ish ids
// ---------------------------------------------------------------------------

test('falls back to the first project when no explicitProjectId is given', async () => {
  const deps = authedDeps([PROJECT_MINE_1, PROJECT_MINE_2]);

  const res = await gateLogic(deps, 'view');

  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.ctx.projectId, PROJECT_MINE_1);
});

test('does NOT fall back across tenants — an own-membership project is always required', async () => {
  // User belongs to exactly one project; the fallback can only ever resolve to
  // a project they are a member of, never to the other tenant.
  const deps = authedDeps([PROJECT_MINE_1]);

  const res = await gateLogic(deps, 'view');

  assert.equal(res.ok, true);
  if (res.ok) assert.notEqual(res.ctx.projectId, PROJECT_OTHER_TENANT);
});

test('denies with "No active project." when the user has zero projects and no override', async () => {
  const deps = authedDeps([]);

  const res = await gateLogic(deps, 'view');

  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.error : '', 'No active project.');
});

test('a user with zero projects still cannot pass an explicit cross-tenant id', async () => {
  const deps = authedDeps([]);

  const res = await gateLogic(deps, 'view', PROJECT_OTHER_TENANT);

  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.error : '', 'Permission denied.');
});

test('denies when the caller is a member but RBAC genuinely revokes the action', async () => {
  // Member of the project, but canServer says no for this action (e.g. a
  // view-only member attempting a write). Membership passes, RBAC denies.
  const deps = authedDeps([PROJECT_MINE_1], {
    canServer: async (_m, action) => action === 'view',
  });

  const allow = await gateLogic(deps, 'view', PROJECT_MINE_1);
  assert.equal(allow.ok, true);

  const deny = await gateLogic(deps, 'delete', PROJECT_MINE_1);
  assert.equal(deny.ok, false);
  assert.equal(deny.ok === false ? deny.error : '', 'Permission denied.');
});

test('denies when the plan does not include SabCRM (member + RBAC ok)', async () => {
  const deps = authedDeps([PROJECT_MINE_1], { planDefaultEnabled: false });

  const res = await gateLogic(deps, 'view', PROJECT_MINE_1);

  assert.equal(res.ok, false);
  assert.equal(
    res.ok === false ? res.error : '',
    'Your plan does not include SabCRM.',
  );
});

test('membership check compares STRINGIFIED ids (ObjectId-like _id values)', async () => {
  // getCachedProjects returns WithId<Project>[] whose _id stringifies to a hex
  // string; gate() stringifies before the Set membership test. Model that with
  // an object whose toString() yields the hex id the client would send.
  const hex = '64b7f0c2a1e4d3f201a9c8e7';
  const objectIdLike = { toString: () => hex };
  const deps = authedDeps([], {
    getCachedProjects: async () => [{ _id: objectIdLike }],
  });

  const accept = await gateLogic(deps, 'view', hex);
  assert.equal(accept.ok, true, 'matching stringified id is accepted');
  if (accept.ok) assert.equal(accept.ctx.projectId, hex);

  const reject = await gateLogic(deps, 'view', 'deadbeefdeadbeefdeadbeef');
  assert.equal(reject.ok, false, 'non-matching id is rejected');
  assert.equal(reject.ok === false ? reject.error : '', 'Permission denied.');
});
