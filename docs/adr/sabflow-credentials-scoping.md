# ADR — SabFlow Per-Workspace Credential Scoping (Track B · Phase 5 · §6)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-ad63ed295a0e78f82`
**Source file:** `src/lib/sabflow/executor/credentials/scoping.ts`
**Sibling ADRs:** `sabflow-credentials-schema.md` (§1, schema source of truth), `sabflow-persistence.md` (§5 multi-tenant scoping — doc-side equivalent), `sabflow-credentials-resolver.md` (§4, delegates here for tenant checks), `sabflow-credentials-rbac.md` (§10, forward-ref).

---

## 1. Goal (≤200 words)

Pin **per-workspace credential scoping** to a single chokepoint module so no credential read, list, or share in the SabFlow executor can cross tenant boundaries — and so the "did you remember to filter by workspaceId?" question has exactly one answer. Every credential-action handler and the runtime resolver (§4) must route through the four helpers exported here: `assertSameWorkspace`, `filterByWorkspace`, `canShareCredential`, and `scopedListCredentials`. Inline filtering anywhere else is a bug. The helpers operate on the pure `Credential` shape from `../../credentials/types.ts` (the legacy types module — explicit cross-reference so future readers don't grep wrong) and on a forward-declared `CredentialRepo` port; the concrete repo is injected at boot via `configureCredentialScoping()`. This keeps the chokepoint testable without Mongo, prevents an import cycle with the credentials DB module, and lets the executor be the *only* layer that knows about plan flags (cross-workspace share gating). Scoping enforces *both* `workspaceId` equality **and** the `ownerType` discriminator (`'workspace'` vs `'user'`) — a workspace admin holding `sabflow.credential.admin` still cannot read another workspace's rows. Defence-in-depth: even after `filterByWorkspace` pins the query, `scopedListCredentials` re-asserts each row, so a repo bug is contained to a typed `CredentialsError`.

## 2. Scope & non-goals

**In scope (owned by this file):**

- The **four scoping helpers**: `assertSameWorkspace`, `filterByWorkspace`, `canShareCredential`, `scopedListCredentials`.
- The `CredentialsError` discriminator (`'WORKSPACE_MISMATCH' | 'SHARE_FORBIDDEN' | 'NOT_CONFIGURED'`) and its wire-format stability contract.
- The forward-declared ports — `CredentialRepo`, `PlanFlagResolver`, `WorkspaceRoleResolver` — and the `configureCredentialScoping()` boot hook that injects them.
- A re-export of `requireWorkspaceAccess` from `persistence/guards.ts` so credential-action handlers import the workspace-binding check and the row-level check from one surface.
- Structural types (`CredentialDoc`, `MongoFilter`, `ScopedListOptions`) kept driver-agnostic.

**Out of scope (owned by siblings):**

- The persisted credential schema — `sabflow-credentials-schema.md` §1.
- Mongo CRUD / indexes — Phase 5 §3 (the repo implementation that satisfies `CredentialRepo`).
- The runtime credential resolver — `sabflow-credentials-resolver.md` §4 (delegates here).
- RBAC key registration — `sabflow-credentials-rbac.md` §10.
- Audit emission — `./audit.ts` (already shipped).
- Crypto / envelope encryption — `./crypto.ts` (Phase 5 §2).
- Plan / billing flag *implementations* — Phase 6 §3 (this file only declares the port).

## 3. The single chokepoint rule

> **Every credential read, list, or share in the executor goes through `@/lib/sabflow/executor/credentials/scoping`. Period.**

Concretely:

| Surface | Must use | Forbidden |
| --- | --- | --- |
| Credential-action handlers (`'use server'`) | `requireWorkspaceAccess` → `scopedListCredentials` / `filterByWorkspace` → `assertSameWorkspace` | Direct repo calls, hand-rolled `{ workspaceId }` filters, ad-hoc `if (cred.workspaceId !== ctx.workspaceId)` checks. |
| Runtime resolver (`./resolver.ts`, §4) | `filterByWorkspace(ctx.workspaceId, …)` for fetch; `assertSameWorkspace(cred, ctx.workspaceId)` post-fetch | Reading a credential by `id` only, then trusting the row. |
| Sharing endpoints | `canShareCredential(cred, requesterId, targetWorkspace?)` | Inline role checks; inline plan-flag reads. |
| API routes that surface scoping failures | `instanceof CredentialsError` + `err.code` switch | Stringly-matching `err.message`. |

This rule is the reason the file exists at all. The persistence layer's `scopedFilter` (`persistence/guards.ts`) is the doc-side equivalent (`sabflow-persistence.md` §5); credential rows live in their own collection with their own row-level ownership semantics, so the executor-credentials surface gets its own mirror with the *same* shape and the *same* contract. Code-review checklist for any new credential-touching code is exactly one bullet: *did you import from `executor/credentials/scoping`?*

## 4. The four helpers — contracts

### 4.1 `assertSameWorkspace(credentialDoc, workspaceId): void`

Defence-in-depth tenant assertion. Throws `CredentialsError` with code `'WORKSPACE_MISMATCH'` (carrying both `credentialWorkspaceId` and `contextWorkspaceId` for the audit row) if `credentialDoc.workspaceId !== workspaceId`. ID equality is case-sensitive hex; callers pass the canonical `ObjectId.toHexString()` form that the repo always emits.

Even after `filterByWorkspace` already pinned the query, every read site **must** call this on the returned row. Cheap insurance against:

- a repo bug that drops the filter,
- a future implementation that adds a `$or` and forgets to anchor each branch to `workspaceId`,
- an in-memory cache returning a stale cross-tenant row,
- a test stub that ignores its filter argument.

Usage:

```ts
const cred = await repo.findById(id);
assertSameWorkspace(cred, ctx.workspaceId);
// safe to decrypt / return cred.data from here.
```

### 4.2 `filterByWorkspace(workspaceId, extra?): MongoFilter`

Clamps a Mongo filter to the current tenant **before** it hits the driver. Returns a `Object.freeze(...)`'d filter so accidental in-place mutation by a downstream caller is a TypeError at runtime. Mirrors `persistence/guards.ts:scopedFilter` so the same compound index `{ workspaceId: 1, … }` (per `sabflow-persistence.md` §3) is always hit.

If `extra` contains its own `workspaceId` key it is **dropped** (with a dev `console.warn`) — a caller can never widen the tenant scope by mistake, even with a typo or a copy-pasted filter from a different workspace's session. Frozen result; safe to re-use.

```ts
const filter = filterByWorkspace(ctx.workspaceId, { type: 'openai' });
const rows = await credsCol.find(filter).toArray();
```

### 4.3 `canShareCredential(credentialDoc, requesterId, targetWorkspace?): Promise<boolean>`

Three-way check before issuing a share:

1. **Workspace-role gate** — `WorkspaceRoleResolver.getRole(credentialDoc.workspaceId, requesterId)` must return `'admin'` or `'owner'`. Editor/viewer cannot share, even of their own row.
2. **Same-workspace share** — if `targetWorkspace` is `undefined` or equal to `credentialDoc.workspaceId`, admin/owner alone is sufficient.
3. **Cross-workspace share** — `targetWorkspace !== credentialDoc.workspaceId` additionally requires the owning workspace's plan to have `crossWorkspaceShareEnabled` truthy via `PlanFlagResolver`. The flag lives on the credential's *owning* workspace, not the target — sharing capacity is a property of who owns the secret.

Returns `false` (never throws) on any auth failure so callers can branch cleanly. The action handler is responsible for translating `false` into a `CredentialsError({ code: 'SHARE_FORBIDDEN' })` when the share was explicitly requested. `'NOT_CONFIGURED'` *does* throw — that's an invariant violation, not an auth failure.

### 4.4 `scopedListCredentials(workspaceId, opts?): Promise<Credential[]>`

The only sanctioned list path for credential-action handlers. Composes `filterByWorkspace` with the injected `CredentialRepo.list` and then re-asserts each row's `workspaceId` (defence-in-depth — see §4.1). Direct repo calls bypass the workspace clause and are considered a bug.

`opts.extraFilter` is layered on *after* the workspace clause via `filterByWorkspace`, so the same anti-widening rule applies. `opts.limit` and `opts.sort` are forwarded verbatim — the repo enforces a default `limit` when omitted.

```ts
'use server';
import { scopedListCredentials, requireWorkspaceAccess }
  from '@/lib/sabflow/executor/credentials/scoping';

export async function listForCurrentWorkspace(ctx: AuthContext) {
  requireWorkspaceAccess(ctx, ctx.workspaceId!);
  return scopedListCredentials(ctx.workspaceId!, {
    extraFilter: { type: 'openai' },
  });
}
```

## 5. Why this is its own module — not folded into the repo

Tempting alternative: stick the scoping into the credentials repo, since the repo is already the only thing that talks to Mongo. Rejected because:

1. **The repo is forward-declared on purpose.** Phase 5 §3 (CRUD + indexes) owns the concrete repo. If scoping lived inside that file, every executor unit test would have to load Mongo just to assert `assertSameWorkspace` throws. By keeping the chokepoint at the port-and-helper layer, scoping is unit-testable with an in-memory `CredentialRepo` stub — and the tests do not need to know about envelope encryption, indexes, or BSON.
2. **No circular imports.** The DB module imports credential types; this file imports those same types. If scoping were inside the DB module, the runtime resolver (`./resolver.ts`) would import the DB module just for the helper — pulling Mongo into every code path that needs to assert a workspace match. The forward-declared `CredentialRepo` interface breaks the cycle.
3. **One thing to review.** Code review for tenant correctness in the executor is "open `scoping.ts` and read the four helpers." If scoping is fused with CRUD, every CRUD change requires re-auditing the tenant logic.
4. **`configureCredentialScoping()` at boot.** Injection is explicit and idempotent: same-deps reconfigure is a no-op; different-deps reconfigure throws (so leaky test state surfaces immediately). `__resetCredentialScopingForTest()` is the test-only escape hatch and is *not* part of the stable public contract.

## 6. `Credential` shape — explicit pointer to the legacy types module

The `Credential` type used here is imported from `../../credentials/types.ts` — the **legacy** credential types module that predates the Phase 5 schema landing (`sabflow-credentials-schema.md` §1). This is the type that handlers, the resolver, and the existing DB module all agree on today, so scoping piggybacks on it rather than fork.

`CredentialDoc` (exported from this file) is a *structural subset*: `Pick<Credential, 'id' | 'workspaceId'>` plus `Partial<Omit<…>>` for the rest. Callers can pass the full `Credential` record without an adapter, and any future re-shaping of the legacy `Credential` type that preserves `id` + `workspaceId` is non-breaking for this module.

Future readers: **do not grep for a `Credential` shape inside `executor/credentials/`.** The canonical shape lives one directory up. When Phase 5 §3's `CredentialEntity` (envelope-encrypted) lands and supersedes the legacy `Credential` row, the migration path is to replace the import of `Credential` with `CredentialEntity` here — `CredentialDoc` will still compile because both shapes carry `id` and `workspaceId`.

## 7. Why scoping enforces *both* `workspaceId` AND `ownerType`

A credential row carries two orthogonal tenant attributes:

| Field | Meaning | Set at write time by |
| --- | --- | --- |
| `workspaceId` | Which tenant owns the secret. | The handler that created the credential. |
| `ownerType` | `'workspace'` (shared across the workspace) vs `'user'` (private to one member of the workspace). | The same handler, per RBAC + form input. |

Why both gates matter at read time:

- **Workspace alone is not sufficient.** A `'user'`-owned credential inside workspace `W` must not be readable by every other member of `W` just because they're in the same tenant. The resolver therefore consults `ownerType` after `assertSameWorkspace` passes.
- **Owner-type alone is not sufficient.** A `'workspace'`-owned credential is readable by workspace members, but only members of *that* workspace — `assertSameWorkspace` is still the gate.
- **`sabflow.credential.admin` does not bridge tenants.** Even an admin holding the role in workspace `A` cannot read a credential whose `workspaceId === B`. The RBAC key (`sabflow-credentials-rbac.md` §10) is scoped *within* a workspace; cross-workspace admin is **not a thing** in SabFlow's model. This is enforced here, not at the role layer, because the role layer doesn't know about credential rows.

Hence the helper signatures all take a `workspaceId` and a `CredentialDoc` — the `ownerType` inspection is the caller's responsibility (the resolver in §4), but the workspace clamp is non-negotiable and centralised here.

## 8. Multi-tenant invariants

The following invariants are *guaranteed* by this module (and depended on by the resolver, the action handlers, and the audit emitter):

1. **No fetched row escapes its tenant.** `assertSameWorkspace` throws; `scopedListCredentials` re-asserts each row from the repo.
2. **No filter escapes its tenant.** `filterByWorkspace` returns a frozen object whose `workspaceId` cannot be silently overwritten by `extra`.
3. **No share escapes plan policy.** `canShareCredential` consults `PlanFlagResolver` for cross-workspace shares; same-workspace shares need only role.
4. **No share escapes role policy.** Editor/viewer cannot share. Admin/owner can, within the rules of (3).
5. **No call escapes configuration.** Every helper that touches the repo, plan flags, or roles goes through `requireDeps()`, which throws `CredentialsError({ code: 'NOT_CONFIGURED' })` if `configureCredentialScoping()` was never called. This is loud and immediate — a test or boot path that forgot to wire deps fails on first use, not silently.
6. **No global state survives between tests.** `__resetCredentialScopingForTest()` exists, and `configureCredentialScoping()` refuses a different-deps re-bind, so leaked state from a previous test surfaces as a thrown `Error` rather than as a confusing tenant-mismatch much later.

Wire-format stability: `CredentialsErrorCode` values are stable strings consumed by the SabFlow client SDK; API routes map them 1:1 to JSON `{ code }` bodies. Adding a new code is non-breaking; renaming or removing an existing code is.

## 9. Composition with the resolver and the rest of the stack

The runtime credential resolver (§4) is the canonical caller. The composition pipeline for a single `ctx.getCredentials(name)` call inside a node:

```
resolver
  └─ filterByWorkspace(ctx.workspaceId, { name })   ← scoping
        └─ repo.findOne(filter)                     ← Phase 5 §3 / legacy db
              └─ assertSameWorkspace(row, ctx.workspaceId)  ← scoping (defence-in-depth)
                    └─ crypto.decrypt(row.dataEncrypted)    ← ./crypto.ts (Phase 5 §2)
                          └─ audit.emit('cred.read', …)     ← ./audit.ts
                                └─ node receives plaintext bag
```

Every arrow is enforced, and every step is independently testable. The resolver does not know how the repo is implemented. The repo does not know about plan flags. The crypto layer does not know about tenants. Audit doesn't know what was decrypted. Scoping is the only layer that sees the tuple `(row, contextWorkspaceId, requesterId, targetWorkspace)` — which is why it owns the gate.

Listing follows the same shape but enters at `scopedListCredentials`, which composes `filterByWorkspace` + `repo.list` + per-row `assertSameWorkspace`. Sharing enters at `canShareCredential`, which talks to `roles` and `planFlags` but never to the repo — sharing is a *decision* function, not a *mutation*; the mutation lives in the handler that calls it.

## 10. Constraints honoured

- **No direct Mongo model imports.** This file talks to persistence through the forward-declared `CredentialRepo` port. The concrete model is registered by Phase 5 §3 and injected via `configureCredentialScoping()`. No `mongodb` import; no Mongoose model; no driver `Filter<T>` type leak.
- **`server-only` import.** The module is excluded from any client bundle. Credential scoping logic — even shapes — never ships to the browser.
- **No new dependencies.** All imports are in-repo: `../../credentials/types` (legacy types) and `../../persistence/guards` (for the re-exported `requireWorkspaceAccess`). No external package added; no transitive surface widened.
- **No new env vars.** Plan-flag lookup and role lookup come through injected ports, not `process.env`. The only `process.env` read is `NODE_ENV` for a dev-only `console.warn` in `filterByWorkspace` — gated, lint-suppressed, and stripped in production builds.
- **Open-closed against the schema rewrite.** When `CredentialEntity` (envelope-encrypted, Phase 5 §3) supersedes the legacy `Credential` row, this file changes by *one import line*; the four helpers and their contracts are stable.

## 11. Decision log

| Date | Event | Notes |
| --- | --- | --- |
| 2026-05-18 | Scoping chokepoint landed | Single source of truth for executor-side credential tenancy; resolver delegates here for every read. |
