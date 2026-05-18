# ADR — SabFlow Runtime Credential Resolver (Track B · Phase 5 · §4)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-a0f5e19660b2fae43`
**Source file:** `src/lib/sabflow/executor/credentials/resolver.ts`
**Sibling ADRs:**

- `sabflow-credentials-schema.md` — §1, persisted schema (canonical format reference).
- `sabflow-credentials-crypto.md` — §2, envelope crypto primitives *(forward-ref — not yet on disk)*.
- `sabflow-credentials-oauth2-refresh.md` — §5, OAuth2 refresh worker *(forward-ref — not yet on disk)*.
- `sabflow-credentials-audit.md` — §7, `cred.*` audit emitter *(forward-ref — not yet on disk)*.
- `sabflow-executor-n8n-survey.md` — §9 `CredentialsHelper` (the n8n equivalent).

---

## 1. Goal (≤200 words)

Define the **runtime credential resolver** — the module a node's `ctx.getCredentials()` calls during execution to obtain decrypted credential material. This is SabFlow's n8n-parity replacement for n8n's `CredentialsHelper.getDecrypted()`: given `(workspaceId, executionId, credentialType, credentialId?)`, the resolver fetches the encrypted row, enforces workspace ownership and type-match RBAC, lazy-refreshes expired OAuth2 tokens, decrypts the envelope just-in-time, audits the read, caches the plaintext for the remainder of the execution, and returns the `DecryptedCredentialData` bag to the node. It is the **only** module in the executor where plaintext credential bytes cross the worker boundary — every other module (store, crypto, refresh, audit, REST) operates on the envelope. The resolver is also the integration point for two not-yet-landed siblings: `store.ts` (§3) and `oauth-refresh.ts` (§5) are forward-declared as `CredentialStorePort` / `OAuthRefreshPort` interfaces and wired in at module-init time via `__setCredentialResolverPorts()`. This port seam keeps the resolver decoupled from on-disk siblings, unit-testable with in-memory fakes, and unblocked for Phase B.5 §4 to ship ahead of its dependencies.

## 2. Scope & non-goals

**In scope (owned by this file):**

- `resolveCredentials(input)` — the single public entry point invoked by `NodeExecutionContext.getCredentials`.
- `ResolveCredentialsInput` / `DecryptedCredentialData` / `CredentialRecord` types.
- The **port seam** — `CredentialStorePort`, `OAuthRefreshPort`, the stub defaults, and `__setCredentialResolverPorts()` / `__resetCredentialResolverPortsForTests()`.
- The **per-execution in-process LRU cache** (`CACHE_TTL_MS = 5min`, `CACHE_MAX_ENTRIES = 256`) and its lifecycle hook `clearExecutionCache(executionId)`.
- The **resolve flow** — store lookup, workspace check, type check, OAuth2 lazy-refresh gate, decrypt call, audit emit, cache write.
- The **error taxonomy** mapping each failure step onto `CredentialsError` with a stable `details.code`.

**Out of scope (owned by siblings):**

- Mongo CRUD and indexes — sibling §3 (`store.ts`), behind `CredentialStorePort`.
- Envelope crypto primitives — sibling §2 (`crypto.ts`), imported directly.
- OAuth2 token refresh against the provider — sibling §5 (`oauth-refresh.ts`), behind `OAuthRefreshPort`.
- Audit row persistence — sibling §7 (`audit.ts`), imported directly.
- RBAC key registration — `./rbac.ts` (already shipped); resolver enforces row-level checks only.
- REST surface and editor CRUD — Phase 5 §10.
- The `cred.test` runner — Phase 5 §7.

## 3. n8n parity — `CredentialsHelper` → `resolveCredentials`

n8n's runtime path for `this.getCredentials('openAiApi')` inside a node is:

```
NodeExecuteFunctions.getCredentials()
  → CredentialsHelper.getDecrypted(node, type, ...)
    → CredentialsHelper.getCredentials(...)      // Mongo by id
    → CredentialsHelper.getDecryptedDataFromHelper(...)
    → Credentials.getData(encryptionKey)         // single-key AES-256-CBC
    → (if OAuth2 + expired) OAuth2Helper.getNewOauth2Token(...)
```

SabFlow collapses that into one async function with the same observable contract:

| n8n step | SabFlow equivalent in `resolver.ts` |
| --- | --- |
| `CredentialsHelper.getCredentials(id)` | `storePort.getById(credentialId)` *or* `storePort.getDefault(workspaceId, type)` |
| Implicit `node.credentials[type]` resolution | Caller passes `credentialId` (or omits for workspace default) |
| `CredentialsHelper` workspace/role check | `record.workspaceId !== workspaceId` ⇒ `WORKSPACE_MISMATCH` |
| `Credentials.getData(N8N_ENCRYPTION_KEY)` | `decryptCredential(envelope)` from sibling §2 |
| `OAuth2Helper.getNewOauth2Token` | `refreshPort.maybeRefresh(record)` from sibling §5 |
| (no audit) | `recordCredentialAudit({ action: 'cred.read', … })` from sibling §7 |
| `CredentialsHelper.cachedTypes` (per-process forever) | Per-execution LRU, hard-cleared on `clearExecutionCache(executionId)` |
| `n8n_workflows_lookup_credentials_by_id` errors | Typed `CredentialsError` with stable `details.code` |

Behavioural differences worth calling out:

- **Cache scope.** n8n caches decrypted credentials at the helper level for the lifetime of the worker. SabFlow caches per `(executionId, credentialId)` and clears on execution completion — so plaintext bytes don't outlive a single run, and a poisoned cache from one workflow can't taint the next.
- **Audit.** n8n has no first-class `cred.read` audit; SabFlow emits one per runtime read (rate-capped inside sibling §7), tagged `source: 'runtime'`.
- **Refresh placement.** n8n refreshes OAuth2 tokens inside the helper but persists them via a separate path; SabFlow keeps the refresh port owning **both** the upstream call *and* the rewrite to the store, so the resolver only sees a fresh `CredentialRecord`.

## 4. The port seam — why forward-declared, not direct-imported

`resolver.ts` lands in Phase B.5 §4. Its on-disk siblings ship as follows:

| Sibling | Path | Status at time of writing |
| --- | --- | --- |
| §2 crypto | `./crypto.ts` | **On disk** — direct `import { decryptCredential }`. |
| §7 audit | `./audit.ts` | **On disk** — direct `import { recordCredentialAudit }`. |
| §3 store | `./store.ts` | **Not yet on disk** — forward-declared as `CredentialStorePort`. |
| §5 oauth-refresh | `./oauth-refresh.ts` | **Not yet on disk** — forward-declared as `OAuthRefreshPort`. |

For §3 and §5 we deliberately do **not** import the modules. Instead the resolver declares the narrow interface it consumes and ships **stub** default implementations that throw `STORE_UNAVAILABLE` (or pass through, for refresh). When the real siblings land they call `__setCredentialResolverPorts({ store, refresh })` at module-init time and the stubs are swapped out. The benefits:

- **No circular dependency risk.** The resolver is leaf-shaped against §3/§5: they import it, never the reverse.
- **Out-of-order shipping.** §4 ships ahead of §3 and §5 with no `TODO: import …` placeholders; the build is green at every sibling boundary.
- **Mongo isolation.** The resolver never touches `mongodb` types — it talks to `CredentialRecord` projections only. The on-disk schema can evolve in §3 without dragging changes here.
- **Unit-testability.** Tests inject fakes:
  ```ts
  __setCredentialResolverPorts({
    store: { getById: async () => fixtureRecord, getDefault: async () => fixtureRecord },
    refresh: { maybeRefresh: async (r) => r },
  });
  ```
  No Mongo, no encryption keys at rest, no network — pure function-level tests.

The `__` prefix on `__setCredentialResolverPorts` / `__resetCredentialResolverPortsForTests` / `__clearCredentialCacheForTests` is the codebase's "intentionally exported, not a public API" convention; lint rules treat them as internal seams.

## 5. The resolve flow

```
resolveCredentials({ workspaceId, executionId, credentialId?, credentialType, nodeId?, nodeType? })

  ┌─ validate workspaceId / credentialType present                         (CredentialsError: invalid)
  │
  ├─ 1. cache:    cacheGet(executionId :: credentialId)                    → hit ⇒ return
  │
  ├─ 2. store:    storePort.getById(credentialId)                          (CredentialsError: missing — NOT_FOUND / NO_DEFAULT)
  │               or storePort.getDefault(workspaceId, credentialType)
  │
  ├─ 3. RBAC:     record.workspaceId === workspaceId                       (CredentialsError: invalid — WORKSPACE_MISMATCH)
  │
  ├─ 4. type:     record.type === credentialType                           (CredentialsError: invalid — TYPE_MISMATCH)
  │
  ├─ 5. refresh:  if record.oauth2?.expiresAt ≤ now + skew                 (CredentialsError: expired — OAUTH_REFRESH_FAILED)
  │                  effective = await refreshPort.maybeRefresh(record)
  │               else effective = record
  │
  ├─ 6. decrypt:  plaintext = decryptCredential(effective.envelope)        (CredentialsError: invalid — DECRYPT_FAILED)
  │
  ├─ 7. audit:    safeAudit({ action: 'cred.read', … })                    (never throws — fire-and-forget)
  │
  ├─ 8. cache:    cacheSet(executionId :: effective.id,
  │                        plaintext, computeTtl(effective))
  │
  └─ return plaintext
```

Key ordering invariants:

- **Step 3 fires before step 6.** A cross-workspace request must be rejected **before** any decrypt happens, so a wrong-workspace caller can never trigger a KEK unwrap. Even if the crypto would fail anyway (KEK mismatch), the typed error must be `WORKSPACE_MISMATCH`, not `DECRYPT_FAILED`.
- **Step 4 (type) fires before step 5 (refresh).** Refreshing an OAuth2 token for a credential the node doesn't have a claim on would still spend an upstream API quota; reject early.
- **Step 5 fires before step 6.** A pending refresh must persist its rotated envelope (inside sibling §5) before we decrypt — otherwise we'd decrypt the stale envelope and pretend it was fresh.
- **Step 7 (audit) fires after a successful decrypt.** No "intent to read" audit on failure paths; failure cases are already covered by the typed error surfacing at the dispatcher.
- **Step 1 (cache) bypasses steps 2-7** on hit. The cache itself is keyed by execution + credentialId, and its TTL is computed at the point of write (step 8) so an OAuth2 cred whose token expires in 90 s gets a 60 s cache, not a 5 min cache.

## 6. Just-in-time decryption — minimising plaintext lifetime

The single most important security property of the resolver is: **decrypted credential bytes exist in worker memory for as short a time as possible.**

Concretely:

- The store (§3) hands the resolver a `CredentialRecord` containing the **envelope only** — `dataEncrypted: Buffer`. No upstream call ever materialises plaintext.
- The crypto module (§2) is a pure function: `decryptCredential(envelope) → Record<string, unknown>`. It allocates the plaintext object and returns it — no global, no cache, no module-level state.
- The resolver places the plaintext into the per-execution LRU cache under `(executionId, credentialId)`. The cache is a plain `Map<string, CacheEntry>` in this module's closure — not a global registry, not Redis, not Mongo.
- On execution completion (success, failure, or cancellation), the executor calls `clearExecutionCache(executionId)`. The entries are deleted, eligible for GC on the next major collection.
- The audit emitter (§7) receives **only** the credential id, type, workspace, action — never the plaintext bag. The fire-and-forget wrapper (`safeAudit`) guarantees no `cred.read` failure can leak plaintext via a thrown error path either.
- Errors raised from the resolver carry `credentialId`, `credentialType`, `details.code`, and (optionally) a `cause` — never the plaintext, and never the envelope bytes.

**Cache TTL clamping (`computeTtl`).** The cache TTL is the lesser of `CACHE_TTL_MS = 5 min` and `oauth2.expiresAt − now − OAUTH_REFRESH_SKEW_MS`. A token expiring in 30 s caches for ~0 s (we'd refresh on the next read anyway); a long-lived API key caches for the full 5 minutes. This means a poisoned cache entry naturally evaporates within the execution; it cannot survive across a token rollover.

**Cache eviction bound.** `CACHE_MAX_ENTRIES = 256` is a hard upper bound — a runaway workflow that resolves thousands of credentials cannot OOM the worker. Insertion-order eviction (`Map.keys().next().value`) approximates LRU because we `delete` + `set` on every hit.

The decision to keep the LRU inline (rather than pulling in `lru-cache`) is a deliberate "no new deps" call (constraint §10). The required surface is ~30 LOC and the dep would have to ship to the executor worker.

## 7. Allow-list / node-type check — where does it live?

The schema ADR (`sabflow-credentials-schema.md` §3) defines `allowedNodeTypes?: string[]` on `CredentialEntity` — an n8n-parity `nodesAccess` projection. The check that "this requesting node-type is in the allow-list" runs **inside the store port (sibling §3)**, not inside the resolver. Why:

- The allow-list is a property of the persisted row, and §3 is the only module that owns the persisted shape.
- The resolver consumes a narrow `CredentialRecord` projection that intentionally **does not** carry `allowedNodeTypes` — keeping the resolver's view narrow keeps §3 free to evolve its on-disk schema (e.g. moving the allow-list to a sidecar collection) without touching this file.
- §3 receives the requesting `nodeType` either via an enriched `getById(credentialId, ctx)` overload or via an out-of-band context — that decision is owned by §3's ADR, not this one.
- If §3 rejects on allow-list, it surfaces a `CredentialsError({ reason: 'invalid', details: { code: 'NODE_TYPE_DENIED' } })` which the resolver re-throws unchanged.

The resolver does carry the requesting `nodeType` on `ResolveCredentialsInput` (descriptive — used for audit metadata and error context), and passes it into `safeAudit` so the audit row records which node-type read which credential.

## 8. Error taxonomy

Every failure path throws `CredentialsError` (from `../errors`) with a stable `details.code` so callers can match on a string, not a message:

| Stage | `reason` | `details.code` | When |
| --- | --- | --- | --- |
| Validation | `invalid` | `WORKSPACE_REQUIRED` | `workspaceId` empty/missing on input. |
| Validation | `invalid` | `TYPE_REQUIRED` | `credentialType` empty/missing on input. |
| Stub port active | `missing` | `STORE_UNAVAILABLE` | §3 hasn't registered — should only ever fire in tests / boot order bugs. |
| Step 2 | `missing` | `NOT_FOUND` | `credentialId` given but `getById` returned `null`. |
| Step 2 | `missing` | `NO_DEFAULT` | no `credentialId` and no workspace default exists for `credentialType`. |
| Step 3 | `invalid` | `WORKSPACE_MISMATCH` | row found, but `record.workspaceId !== input.workspaceId`. |
| Step 4 | `invalid` | `TYPE_MISMATCH` | row found, but `record.type !== input.credentialType`. |
| Step 5 | `expired` | `OAUTH_REFRESH_FAILED` | `refreshPort.maybeRefresh` threw; preserves `cause`. |
| Step 6 | `invalid` | `DECRYPT_FAILED` | `decryptCredential` threw; preserves `cause`. |

`reason` is the enum already established by `CredentialsError` (`'missing' | 'invalid' | 'expired'`) and consumed by the executor dispatcher and IPC wire codec (per `executor/errors.ts`). `details.code` is the string callers should branch on inside catch blocks — the schema lets us add new cases (e.g. `NODE_TYPE_DENIED` from §3, `KEK_REVOKED` from §2) without touching the resolver.

Decoded into n8n's worldview:

- `NOT_FOUND` / `NO_DEFAULT` ⇒ n8n `Credentials not found` (typed).
- `WORKSPACE_MISMATCH` ⇒ no n8n parity (n8n is single-tenant); SabFlow-specific.
- `TYPE_MISMATCH` ⇒ n8n `Credential type does not match`.
- `DECRYPT_FAILED` ⇒ n8n `Could not decrypt credentials` (key rotation gone wrong, KEK env missing, ciphertext tampered).
- `OAUTH_REFRESH_FAILED` ⇒ n8n `OAuth2 token refresh failed`.

The dispatcher (`executor/errors.ts`) routes `CredentialsError` to the **error port** (not the **catch port**) — the failure is structural and shouldn't be swallowed by a `Try/Catch` node.

## 9. The single plaintext boundary

A core invariant of Phase B.5: **`resolver.ts` is the only place in the executor where decrypted credential bytes cross the worker boundary.** Every other module operates on the envelope.

| Module | Sees envelope? | Sees plaintext? |
| --- | --- | --- |
| `store.ts` (§3) | yes — `dataEncrypted: Buffer` | **no** |
| `crypto.ts` (§2) | yes — encrypt/decrypt | yes, **only inside `decryptCredential`/`encryptCredential` stack frames**; never persisted. |
| `oauth-refresh.ts` (§5) | yes — refreshed envelope written back | **no** — the upstream OAuth2 call lives behind the port boundary, and §5 re-encrypts before persisting. |
| `audit.ts` (§7) | **no** | **no** — receives id + metadata only. |
| `resolver.ts` (§4) — **this file** | yes | yes — for the duration of one `resolveCredentials` call, plus while cached for the execution. |
| REST handlers (§10) | yes | **no**, except the plaintext-export path gated by `sabflow.credential.admin`. |
| Node execution context | **no** | yes — receives the `DecryptedCredentialData` bag the resolver returns. |

This invariant means audit / RBAC / KEK rotation reviewers only have to inspect *one* file (this one) plus the node-side handoff to know where plaintext lives. Future hardening (e.g. wrapping the returned object in a proxy that zeroes itself on `clearExecutionCache`) lands here, not scattered.

## 10. Testing strategy

Tests inject fakes via `__setCredentialResolverPorts`:

```ts
import {
  resolveCredentials,
  __setCredentialResolverPorts,
  __resetCredentialResolverPortsForTests,
  __clearCredentialCacheForTests,
} from '@/lib/sabflow/executor/credentials/resolver';
import { encryptCredential } from '@/lib/sabflow/executor/credentials/crypto';

afterEach(() => {
  __resetCredentialResolverPortsForTests();
  __clearCredentialCacheForTests();
});

it('rejects cross-workspace reads before decrypting', async () => {
  const envelope = encryptCredential({ apiKey: 'sk-xxx' });
  __setCredentialResolverPorts({
    store: {
      async getById() {
        return {
          id: 'c1',
          workspaceId: 'OTHER',
          type: 'openai',
          envelope,
        };
      },
      async getDefault() { return null; },
    },
  });

  await expect(
    resolveCredentials({
      workspaceId: 'MINE',
      executionId: 'e1',
      credentialId: 'c1',
      credentialType: 'openai',
    }),
  ).rejects.toMatchObject({
    reason: 'invalid',
    details: { code: 'WORKSPACE_MISMATCH' },
  });
});
```

Recommended test matrix (each one a pure function-level test, no Mongo, no network):

- Happy path — explicit id → hit, cache miss → store → decrypt → cache populated.
- Happy path — workspace default lookup (no `credentialId` on input).
- Cache hit returns immediately, no `getById` call (assert spy not called).
- Cache expires when TTL elapses (advance fake clock past `CACHE_TTL_MS`).
- `clearExecutionCache(executionId)` drops all entries under that prefix only.
- Cross-workspace ⇒ `WORKSPACE_MISMATCH`, **no** decrypt call (assert spy on `decryptCredential`).
- Wrong type ⇒ `TYPE_MISMATCH`, no decrypt.
- Missing → `NOT_FOUND` (id) and `NO_DEFAULT` (no id).
- OAuth2 expired ⇒ `maybeRefresh` invoked, returns fresh record, cache TTL clamped.
- OAuth2 refresh throws ⇒ `OAUTH_REFRESH_FAILED`, `cause` preserved.
- Decrypt throws ⇒ `DECRYPT_FAILED`, `cause` preserved.
- Audit failure does not block resolution (mock `recordCredentialAudit` to reject).
- LRU eviction at `CACHE_MAX_ENTRIES + 1`.

## 11. Vercel runtime fit

The resolver lives inside the executor worker, which runs on **Vercel Functions** (Node.js / Fluid Compute, per the platform rule). Implications honoured by this file:

- **Per-invocation memory only.** The `cache` Map lives in the function instance's closure. Across instances (cold starts, concurrent invocations), there is no shared cache — which is fine because the cache scope is `executionId` anyway, and a given execution runs on a single instance.
- **No background timers.** Cache eviction is lazy (checked on `cacheGet`) and bounded (`CACHE_MAX_ENTRIES`); no `setInterval` that would survive Fluid-Compute idle periods.
- **No `process.exit` cleanup needed.** Vercel may freeze and resume the function; the cache is freshly empty after a cold start, and `clearExecutionCache` is called by the executor on every execution boundary.
- **KEKs are env-sourced.** Sibling §2 reads `SABFLOW_KEK_<id>` from Vercel env vars (provisioned via `vercel env` or the dashboard) — the resolver itself reads no env, so it is portable to test harnesses, Vercel Sandbox, and one-shot CLI runs alike.

## 12. Constraints honoured

- **No new dependencies.** Imports are: `server-only`, `../errors` (`CredentialsError`, `CredentialsErrorOptions`), `./crypto` (`decryptCredential`, `CredentialEnvelope`), `./audit` (`recordCredentialAudit`). Zero `package.json` changes. The LRU is inlined precisely to avoid an `lru-cache` import.
- **`server-only` import.** First line after the docblock — the resolver can never be bundled into a client component.
- **No direct Mongo imports.** The file never imports `mongodb`. Storage is reached through `CredentialStorePort`; the on-disk shape can change in sibling §3 with zero churn here.
- **No model registered.** No collection name, no index declaration — `SABFLOW_CREDENTIALS_COLLECTION` is owned by `sabflow-credentials-schema.md` §1 and consumed only by sibling §3.
- **No new env reads.** Resolver reads no `process.env`; KEKs are env-sourced inside `./crypto.ts` (sibling §2), so Vercel env provisioning remains a sibling concern.
- **No log statements with credential bytes.** `safeAudit` carries id/type/source only; thrown errors carry id/type/code only.
- **Vercel-native.** Per the project rule, this file makes no assumption about a long-running worker — TTLs are bounded, cache is closure-local, no background timers.

## 13. Decision log

| Date | Event | Notes |
| --- | --- | --- |
| 2026-05-18 | Resolver landed | Implements §4 of the Phase B.5 series. Forward-declares §3 (store) and §5 (oauth-refresh) via the `__setCredentialResolverPorts` seam; direct-imports §2 (crypto) and §7 (audit), which are already on disk. |
| 2026-05-18 | LRU kept inline | Decided against an `lru-cache` dep — surface area is trivial and shipping a dep to the executor worker has a per-invocation cost on Vercel Functions. |
| 2026-05-18 | Cache scope = `(executionId, credentialId)` | Hard-bounded plaintext lifetime to one execution; `clearExecutionCache` is the only intended persistence boundary. |
| 2026-05-18 | Allow-list check pushed into sibling §3 | Resolver intentionally consumes a narrow `CredentialRecord` projection — keeps the on-disk schema free to evolve. |
