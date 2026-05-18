# ADR — SabFlow Credential RBAC Keys (Track B · Phase 5 · §10)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-af508ffa889f25e89`
**Source file:** `src/lib/sabflow/executor/credentials/rbac.ts`
**Sibling ADRs:** `sabflow-credentials-schema.md` (§1 of this series — §7 lists the keys this file reserves), `sabflow-auth.md` (SabNode RBAC registration pattern; Phase B.8 §1 owns global registration), `sabflow-credentials-scoping.md` (§6 — workspace-level tenant enforcement that pairs with the role-level enforcement defined here).

---

## 1. Goal (≤200 words)

Reserve the six SabFlow **credential permission keys** and ship typed, server-side helper functions (`canReadCredential`, `canUseCredential`, `canWriteCredential`, `canDeleteCredential`, `canShareCredential`, `canAdminCredential`) that gate every credential touch on a role check. The keys are exported as a frozen tuple so Phase B.8 §1 can copy them verbatim into `src/lib/permission-modules.ts` (`globalModules` + `moduleCategories.SabFlow`) and into the `GlobalRolePermissions` union in `src/lib/definitions.ts`. This file **deliberately does not register** the keys globally — registration is a single atomic PR owned by Phase B.8 §1, mirroring the SabWa precedent in `src/lib/sabwa/rbac-keys.ts`. Until that PR lands, the helpers forward to `requirePermission` / `canServer` from `src/lib/rbac-server.ts`, which safely returns `false` for unregistered keys against non-owner / non-admin callers — i.e. **deny-by-default**. Once registered, the helpers Just Work without code changes. Together with `scoping.ts` (the tenant gate) and `audit.ts` (the trail), this file completes the access-control surface for credentials. No new dependencies, no model registered, no plaintext touched.

## 2. Scope & non-goals

**In scope (owned by this file):**

- The six reserved key strings as a `const` tuple: `SABFLOW_CREDENTIAL_PERMISSION_KEYS`.
- The `SabflowCredentialPermissionKey` union type derived from that tuple.
- The default workspace-role → keys mapping (`DEFAULT_CREDENTIAL_ROLE_GRANTS`) referenced by Phase B.8 §1 when it seeds new workspaces.
- The action-mapping shim `_actionForCredentialKey` that translates a credential key to a `PermissionAction` (`'view' | 'create' | 'edit' | 'delete'`) — the alphabet `requirePermission` accepts.
- The `CredentialRbacContext` envelope (workspaceId + optional credentialId).
- Two generic helpers: `canCredential` (boolean probe) and `requireCredentialPermission` (hard-enforcing `{ok,error}` shape).
- Six per-key sugar helpers: `canReadCredential`, `canUseCredential`, `canWriteCredential`, `canDeleteCredential`, `canShareCredential`, `canAdminCredential`.

**Out of scope (owned by siblings):**

- Global module registration (`globalModules`, `moduleCategories.SabFlow`, `GlobalRolePermissions`) — **Phase B.8 §1**.
- Workspace-level tenant enforcement (which row belongs to which workspace) — `./scoping.ts` (§6 of `sabflow-credentials-scoping.md`).
- The encrypted persisted schema — `./schema.ts` (§1 sibling).
- Per-credential ACL collection (`credential_acl`) — Phase B.8 §2 will extend the helpers to consult it; today `credentialId` is logged only.
- Audit emission — `./audit.ts` (already shipped).
- Workspace-role → user mapping — `src/lib/sabflow/workspaces/permissions.ts`.

## 3. The six reserved keys

Reserved keys exported as a frozen tuple (`SABFLOW_CREDENTIAL_PERMISSION_KEYS`):

| Key                          | Gates                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `sabflow.credential.read`    | View credential **metadata** (name, type, owner, timestamps) — never plaintext.                |
| `sabflow.credential.use`     | Decrypt at runtime via `ctx.getCredentials()` for in-flight execution only.                    |
| `sabflow.credential.write`   | Create or update a credential row.                                                             |
| `sabflow.credential.delete`  | Delete a credential row.                                                                       |
| `sabflow.credential.share`   | Change the ACL — grant/revoke access for other workspace members.                              |
| `sabflow.credential.admin`   | Highest-trust ops: KEK rotation, plaintext export, force-revoke, bulk import.                  |

The tuple is `as const` so the union type `SabflowCredentialPermissionKey` is exhaustive — adding a new key forces every helper site to re-typecheck. Phase B.8 §1 will copy this tuple verbatim into the three registries in `src/lib/permission-modules.ts` + `src/lib/definitions.ts` in one atomic PR.

## 4. Helpers — surface and behaviour

### 4.1 Generic gates

```ts
canCredential(ctx, key): Promise<boolean>
requireCredentialPermission(ctx, key): Promise<{ ok: true } | { ok: false, error }>
```

`canCredential` forwards to `canServer(key, action, workspaceId)` from `src/lib/rbac-server.ts`. `requireCredentialPermission` forwards to `requirePermission(key, action, workspaceId)` from the same module so server actions and route handlers can short-circuit with the platform-uniform error shape.

### 4.2 Per-key sugar

Each of the six keys gets a zero-arg-after-context helper that names the intent at the call site:

- `canReadCredential(ctx)` — wraps `'sabflow.credential.read'`.
- `canUseCredential(ctx)` — wraps `'sabflow.credential.use'`.
- `canWriteCredential(ctx)` — wraps `'sabflow.credential.write'`.
- `canDeleteCredential(ctx)` — wraps `'sabflow.credential.delete'`.
- `canShareCredential(ctx)` — wraps `'sabflow.credential.share'`.
- `canAdminCredential(ctx)` — wraps `'sabflow.credential.admin'`.

Call sites read as English: `if (!await canUseCredential({ workspaceId, credentialId })) throw …` — the diff in any future audit / code review is unambiguous about which operation was being gated.

### 4.3 The `CredentialRbacContext` envelope

```ts
type CredentialRbacContext = {
  workspaceId: string;       // doubles as projectId — SabFlow workspaces ARE SabNode projects
  credentialId?: string;     // optional: when omitted, the check is a workspace-wide capability probe
};
```

`workspaceId` is the only field `requirePermission` consumes today. `credentialId` is carried for forward compatibility with Phase B.8 §2's per-credential ACL collection and (immediately) for audit correlation when the call site wants it logged.

### 4.4 The action-mapping shim

The platform `requirePermission` accepts a `PermissionAction ∈ {view, create, edit, delete}` — the global verb alphabet. `_actionForCredentialKey` maps each credential key to its closest match:

| Credential key                | `PermissionAction` | Rationale                                                        |
| ----------------------------- | ------------------ | ---------------------------------------------------------------- |
| `sabflow.credential.read`     | `view`             | Direct match — metadata read.                                    |
| `sabflow.credential.use`      | `view`             | Decrypt-for-runtime is read-shaped; user never sees plaintext.   |
| `sabflow.credential.write`    | `create`           | Covers both create and update (no separate `update` verb).       |
| `sabflow.credential.delete`   | `delete`           | Direct match.                                                    |
| `sabflow.credential.share`    | `edit`             | ACL writes are edit-shaped.                                      |
| `sabflow.credential.admin`    | `delete`           | Highest-trust ceiling; matches plan ceiling for super-admin ops. |

The shim is `@internal` and exported only so unit tests can pin these mappings.

## 5. Why deny-by-default until Phase B.8 §1 lands

`requirePermission` consults the global permission map keyed on the modules registered in `src/lib/permission-modules.ts`. Until Phase B.8 §1 appends the six credential keys to that map, the keys resolve to **absent** — which the platform RBAC treats as **deny** for any non-owner / non-elevated caller. Owners and elevated plan roles still pass via the plan-ceiling override, which is exactly what we want for an early-access surface.

Alternatives considered and rejected:

- **Allow-on-missing.** Treating unregistered keys as a green light during development would expose credential operations to viewer-tier sessions for the window between Phase 5 shipping and Phase B.8 §1 landing. Hard no for a vault surface — defensive posture wins.
- **Inline registration here.** Would force every Phase 5 sub-task PR to also touch `src/lib/definitions.ts` and `src/lib/permission-modules.ts`, which thrashes those files with conflicts across the ten siblings. Centralising the registration in one atomic PR (the SabWa precedent in `src/lib/sabwa/rbac-keys.ts`) keeps the diff in `definitions.ts` reviewable.

The trade-off — Phase 5 helpers silently deny for non-elevated callers until B.8 §1 — is acceptable because: (a) the executor itself runs under the elevated runtime principal that bypasses the role check; (b) every editor-facing surface lands at or after Phase B.8 §1; (c) deny is the safer failure mode.

## 6. Default workspace-role → keys mapping

`DEFAULT_CREDENTIAL_ROLE_GRANTS` ships in this file as a `const` map so Phase B.8 §1's registration PR has a single source of truth to copy into the `customPermissions` template that new workspaces seed:

| Role     | Granted keys                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewer` | _(none — viewers consume rendered flows; never touch the vault)_                                                                                        |
| `editor` | `sabflow.credential.read`, `sabflow.credential.use`                                                                                                     |
| `admin`  | `read`, `use`, `write`, `delete`, `share`                                                                                                               |
| `owner`  | `read`, `use`, `write`, `delete`, `share`, `admin`                                                                                                      |

This file does **not** apply the mapping at runtime — it merely declares it. Phase B.8 §1 materialises it into the workspace's `customPermissions` document on create; until then, helpers fall through to `requirePermission` against the global map.

## 7. Composition with `scoping.ts` — two gates, both must pass

RBAC and scoping are orthogonal:

| Layer                  | Question answered                                                       | Source                                                  |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| RBAC (this file)       | Does the **caller's role** permit this **operation** on **this workspace**? | `requirePermission(key, action, workspaceId)`           |
| Scoping (`scoping.ts`) | Does the **credential row** belong to **this workspace**?                   | Mongo filter clause + `assertCredentialInWorkspace()`   |

Both gates are mandatory on every credential touch. The order is **scoping first, RBAC second** — scoping is a Mongo filter so cheap that we never want to call `requirePermission` against a row that wouldn't have been found anyway, and we never want a cross-tenant id to leak through the audit log as a "denied by RBAC" event when it should leak as "row not found".

The two-gate sequence at every call site looks like:

```ts
// 1. Tenant gate (sabflow-credentials-scoping.md §6)
const row = await loadCredentialScoped(credentialId, workspaceId);
if (!row) throw notFound();

// 2. Role gate (this ADR)
const gate = await requireCredentialPermission({ workspaceId, credentialId }, 'sabflow.credential.use');
if (!gate.ok) throw gate.error;

// 3. Operation
const plaintext = await decryptCredential(row);
```

## 8. Test seam — deny-by-default as a unit-test contract

`_actionForCredentialKey` is exported `@internal` so unit tests can pin the key → action mapping without re-implementing it. The helpers themselves are tested via the `requirePermission` integration surface, not by injecting a mock — `requirePermission` already exposes a deterministic session shape we can control from a test harness.

The deny-by-default behaviour is itself the most important contract test: a synthetic non-owner session against any of the six keys returns `false` from `canCredential` until Phase B.8 §1 registers the keys, at which point the exact same test against the same session flips to `true` (or stays `false` for viewers on the admin key, per §6's mapping). The transition is observable and reviewable.

## 9. Constraints honoured

- **No new dependencies.** All imports are in-repo: `@/lib/rbac-server`, `@/lib/rbac`, `@/lib/sabflow/workspaces/types`. No npm additions.
- **`server-only` semantics.** The file imports from `@/lib/rbac-server`, which itself carries the `server-only` import — any client bundle that pulls this file fails at build time, by design.
- **⚠️ DO NOT register globally here.** No write to `src/lib/permission-modules.ts`, no edit to `globalModules`, no extension of `moduleCategories.SabFlow`, no addition to the `GlobalRolePermissions` union. **Phase B.8 §1 owns that atomic PR**, mirroring `src/lib/sabwa/rbac-keys.ts`. This file's job is to be the typed declaration B.8 §1 will copy from.
- **No model registered, no connection opened, no index created.** Pure declarations + thin wrappers around the platform RBAC.
- **Vercel-native.** Forwards to the platform `requirePermission` which reads the session cookie set by Vercel-deployed auth; no external IAM service.

## 10. Decision log

| Date       | Event                                                                                       | Notes                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2026-05-18 | Six credential RBAC keys reserved; helpers shipped; global registration deferred to B.8 §1. | Mirrors the SabWa precedent (`src/lib/sabwa/rbac-keys.ts`); deny-by-default in interim. |
