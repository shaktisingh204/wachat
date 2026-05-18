SabFlow collab e2e tests — Phase C.8 · sub-task #6
====================================================

**TODO (future):** Re-implement these three suites as Playwright e2e specs
once Playwright is added to the repo. The intended target paths are:

  - `tests/e2e/sabflow-collab-two-user.spec.ts`
  - `tests/e2e/sabflow-presence-cursor.spec.ts`
  - `tests/e2e/sabflow-share-viewer.spec.ts`

**Why integration tests today:** Playwright is not installed in this repo
(no `@playwright/test` dep, no `playwright.config.ts`). The project's
established test runner is `tsx --test` (Node's built-in `node:test`),
used by `src/lib/__tests__/rbac.test.ts`,
`src/lib/sabflow/access/__tests__/rbac-matrix.test.ts`, etc. Per the
sub-task brief: *"If no Playwright exists, document a TODO and ship a
smaller integration test instead."* — these three files do exactly that,
exercising the same semantics at the module level:

  1. `two-user-concurrent-edit.test.ts`
       Two simulated clients apply concurrent ops to a shared doc model
       and the merged state matches both clients (CRDT-style commutative
       convergence over the existing `sabflow_oplog` append model).

  2. `presence-cursor-visibility.test.ts`
       Verifies `heartbeat()` from user B causes `listPresence()` (as
       observed by user A) to surface B's cursor coordinates within
       500 ms — the SLO the future Playwright test must also enforce.

  3. `share-viewer-readonly.test.ts`
       Mints a share link → bound role is `VIEWER` → `canDo(VIEWER, …)`
       denies every write action and allows reads, matching the
       read-only semantics the future incognito-viewer Playwright spec
       must assert.

Run with:

    npx tsx --test src/lib/sabflow/__tests__/e2e-collab/*.test.ts
