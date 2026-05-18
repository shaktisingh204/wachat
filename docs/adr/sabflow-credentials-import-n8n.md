# ADR — SabFlow Credentials Bulk Import from n8n (Track B · Phase 5 · §9)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-a3263e1dc974c84b1`
**Source file:** `src/lib/sabflow/executor/credentials/import-n8n.ts`
**Sibling ADRs:** `sabflow-credentials-schema.md` (§1 — field-map source of truth), `sabflow-credentials-crypto.md` (§2 — KEK envelope), `sabflow-executor-n8n-survey.md` (§9 — `CredentialsHelper` parity).

---

## 1. Goal (≤200 words)

Provide a **bulk importer** that ingests an n8n `credentials.json` export and writes the rows into the SabFlow credentials store *under the SabFlow KEK*, so customers migrating from a self-hosted n8n instance can move their secrets in one operator-driven step instead of re-typing every API key. The importer accepts both shapes n8n's exporter emits — the default AES-256-CBC ciphertext blob (`n8n export:credentials --output ...`) and the plaintext form (`n8n export:credentials --decrypted ...`) — decrypts the former *only when* an `encryptionKey` is supplied, normalises every row into a flat `Record<string, string>`, then hands the plaintext to the §2 KEK module for envelope-encryption and to the §1 credentials repository for persistence. Per-row failures are collected into a structured report rather than aborting the batch, the operation is RBAC-gated to `sabflow.credential.admin`, and every successful write emits a `cred.write` audit row with `metadata: { import: true, legacyId }`. The importer is **stateless**, **`server-only`**, and adds **no new dependencies** — it uses `node:crypto` for the CBC decrypt path and dynamic `import()` to forward-declare its repo and KEK siblings.

## 2. Scope & non-goals

**In scope (owned by this file):**

- Parsing the n8n `credentials.json` top-level shape (both `[…]` and `{ credentials: […] }` variants).
- Detecting and normalising the two per-row `data` shapes (CBC ciphertext string vs plaintext map).
- AES-256-CBC decryption of the n8n payload using `node:crypto` (`SHA-256(encryptionKey)` → key, leading 16-byte IV).
- The n8n-type → `CredentialType` mapping table (`N8N_TYPE_MAP`) — exported so the admin UI can render a compatibility matrix pre-flight.
- Producing an `ImportResult = { imported, skipped, errors, plan }` for every row, success or failure.
- A `dryRun` mode that returns the plan and skips persistence.
- Test seams (`_repo`, `_crypto`) for in-memory unit tests.

**Out of scope (owned by siblings):**

- `CredentialEntity` / `CredentialType` shape — owned by §1 (`sabflow-credentials-schema.md`).
- The KEK envelope itself (AES-256-GCM, per-row DEK, KEK rotation) — owned by §2 (`sabflow-credentials-crypto.md`).
- The Mongo CRUD path (`createCredentialDirect`) — owned by §3 (credentials repo).
- The HTTP/REST endpoint and multipart upload that drives the importer — owned by §10.
- The admin UI compatibility matrix — owned by the SabFlow ops console.
- RBAC enforcement (`sabflow.credential.admin`) — owned by the route handler; this module trusts its caller.
- Audit emission — owned by `./audit.ts`; the route layer wraps the call to `importFromN8n` with `cred.write` rows.

## 3. n8n `credentials.json` — input shapes

n8n's exporter writes a top-level JSON array of credential rows. SabFlow tolerates both top-level wrappers seen in the wild:

```json
// Variant A — bare array (most common)
[ { "id": "1", "name": "…", "type": "…", "data": … }, … ]

// Variant B — wrapped (older n8n + some community scripts)
{ "credentials": [ { "id": "1", … }, … ] }
```

Each row's `data` field has **two possible shapes**, and the importer must distinguish them:

### 3.1 Encrypted (default in production)

```json
{
  "id": "42",
  "name": "OpenAI Prod",
  "type": "openAiApi",
  "data": "abcd1234ef…:9f8e7d6c5b…"
}
```

`data` is an opaque string written by n8n's `Credentials.setData()` path. n8n internally:

1. Derives `key = SHA-256(N8N_ENCRYPTION_KEY)` (32 bytes).
2. Generates a random 16-byte IV.
3. Encrypts the JSON-serialised plaintext with AES-256-CBC + PKCS#7 padding (n8n uses `node-forge` `cipher` in CBC mode under the hood).
4. Concatenates the IV with the ciphertext.

Two encoding variants of step 4 are observed:

- **Variant A — colon-delimited hex.** `"<hex-iv>:<hex-ciphertext>"`. Older exports.
- **Variant B — single base64.** `"<base64(iv ‖ ciphertext)>"`. Newer concatenated form; the first 16 raw bytes are the IV.

The importer attempts both encodings before declaring `decryption_failed`. Decryption happens via `node:crypto` (`createDecipheriv('aes-256-cbc', key, iv)`); no `node-forge` dependency is added.

### 3.2 Plaintext (admin used `--decrypted`)

```json
{
  "id": "42",
  "name": "OpenAI Prod",
  "type": "openAiApi",
  "data": { "apiKey": "sk-…", "organizationId": "org_…" }
}
```

`data` is already a key/value map. Values may be `string | number | boolean | null`; the importer stringifies non-string scalars and JSON-encodes anything more complex (a defensive escape hatch — n8n schemas in practice only emit scalars).

### 3.3 Decision — accept both, never guess

| `encryptionKey` supplied? | `data` is object | `data` is string starting with `{` | `data` is anything else (string) |
| --- | --- | --- | --- |
| **No** | accept (plaintext) | accept as JSON | **reject** (`decryption_failed` — refuses to insert garbage) |
| **Yes** | accept (plaintext) | accept as JSON | decrypt as CBC, then JSON-parse |

The string-starts-with-`{` heuristic captures the rare case where `--decrypted` serialised the inner map as a JSON string instead of an object. Anything ambiguous in the no-key path is rejected so a typo'd CLI invocation can't smuggle ciphertext into the store as if it were plaintext.

## 4. Decrypt → re-encrypt pipeline

```
                    ┌──────────────────────────── per-row, in-memory only ───────────────────────────┐
   n8n shape       │                                                                                  │      SabFlow envelope
   ────────        │                                                                                  │      ─────────────────
   data (string)   │   AES-256-CBC decrypt (node:crypto)                                              │      AES-256-GCM
        │          │     key  = SHA-256(encryptionKey)                                                 │      per-row DEK,
        ▼          │     iv   = first 16 bytes / hex prefix                                            │      DEK wrapped
   plaintext  ─────┼─►  JSON.parse  ─►  flattenStringValues  ─►  Record<string, string>  ─►  JSON.    │  ─►  under SABFLOW_KEK_<id>
   (map)           │                                                                       stringify  │       (sibling §2)
                   │                                                                                  │
                   └──────────────────────────────────────────────────────────────────────────────────┘
                                                                                                       │
                                                                                                       ▼
                                                                            repo.createCredentialDirect({…, encryptedData})
```

**Plaintext-lifetime invariant.** The plaintext `Record<string, string>` exists only inside the `for (const raw of rows)` loop of `importFromN8n`. It is:

- never assigned to a module-scoped variable,
- never `console.log`-ed or surfaced through the returned `ImportResult` (only field *names* are echoed in `plan.fields`, never values),
- never persisted to disk, cache, or temp file,
- discarded as soon as `crypto.encryptDataKek(JSON.stringify(data))` resolves.

The KEK module (§2) handles the envelope (`iv ‖ ct ‖ tag ‖ wrappedDek`); this importer only sees the opaque output string.

## 5. Field map — applies §1 §4 verbatim

| n8n field | SabFlow projection | Notes |
| --- | --- | --- |
| `id` | discarded → `audit.metadata.legacyId` | Per §1 §4.2. The repo assigns a fresh `_id`. |
| `name` | `name` | Verbatim. |
| `type` | `type` after `N8N_TYPE_MAP` lookup | Unknown n8n types are skipped with `reason: 'unknown_type'` (see §6). |
| `data` (decrypted) | `dataEncrypted` (after §2 envelope-encrypt) | Plaintext bounded to the importer's stack. |
| `nodesAccess[].nodeType` | `allowedNodeTypes` | Projected to a flat array; this file leaves the projection to the repo, only carrying the type through `createCredentialDirect`'s shape. |
| `createdAt` / `updatedAt` | `createdAt` / `updatedAt` | Forwarded for traceability if the repo accepts them. |
| *(implicit)* | `workspaceId`, `createdBy` | Set from `opts.workspaceId` / `opts.requesterId`. |
| *(implicit)* | `kek`, `version` | Set by the §2 crypto module and §1 schema defaults. |

### 5.1 `N8N_TYPE_MAP`

A frozen `Readonly<Record<string, CredentialType>>` exported from this file. It collapses n8n's per-service entries (e.g. `googleSheetsOAuth2Api`, `googleDriveOAuth2Api`) onto SabFlow's per-service types (`google_sheets`, `google_drive`) — mirroring how §1's `CredentialType` is shaped. Keeping the map exported lets the admin UI render a coverage matrix before the user commits.

Anything not in the map is skipped (never silently `string`-typed) — `CredentialType` is logically open per §1 §4.4, but the importer chooses to be strict so a typo in an n8n type string can't pollute the store.

## 6. Error surface — per-row report, not first-fail

`importFromN8n` never throws for content-level errors; it throws only for **input-level** ones (missing `workspaceId`/`requesterId`, malformed top-level JSON). Every row produces either an entry in `plan` (success / dry-run) or an entry in `errors` (skip / failure):

```ts
interface ImportError {
  n8nId: string | null;
  name: string | null;
  n8nType: string | null;
  reason:
    | 'unknown_type'        // N8N_TYPE_MAP miss
    | 'invalid_shape'       // missing required `type` / `name`
    | 'decryption_failed'   // CBC decrypt threw, or no encryptionKey for a ciphertext row
    | 'empty_payload'       // decoded `data` was {}
    | 'persist_failed';     // KEK encrypt or repo.createCredentialDirect threw
  message: string;          // safe, never includes plaintext or key material
}

interface ImportResult {
  imported: number;   // 0 on dryRun
  skipped: number;    // unknown_type / invalid_shape / empty_payload / decryption_failed
  errors: ImportError[];
  plan: ImportPlanEntry[];  // every row we would have written, with `fields: string[]` only
}
```

The `plan` array is populated **for every importable row** — successful and dry-run alike — so the admin UI can render the same review table in both modes. `fields` is a list of *keys* only; values are never returned.

## 7. Idempotency

Re-importing the same `credentials.json` **creates duplicates by design**. Rationale:

- n8n's `id` field is a per-instance numeric string and is not preserved in SabFlow (§1 §4.2). There is no stable key shared between the two systems.
- Matching on `(name, type)` would silently overwrite operator-curated changes made between imports — a worse failure mode than visible duplicates.
- The §10 REST surface exposes the `plan` via the `dryRun` mode so operators can dedupe in their export pipeline before committing.

If a future sub-task wants idempotent re-import, it should layer a lookup against `audit.metadata.legacyId` *outside* this module; the importer itself stays pure and additive.

## 8. Forward-declared siblings — dynamic `import()`

Sub-tasks #1 (repo) and #2 (KEK crypto) author their modules in parallel. To avoid coupling at compile time, the importer:

1. Declares two minimal interfaces locally:

   ```ts
   interface CredentialRepoLike {
     createCredentialDirect(input: { workspaceId; requesterId; type; name; encryptedData; }): Promise<{ id: string }>;
   }
   interface CryptoLike { encryptDataKek(plain: string): Promise<string> | string; }
   ```

2. Resolves the real implementations at first use via an indirect `dynamicImport(spec)` helper. The helper wraps the dynamic import in `new Function(...)` so TypeScript and the bundler treat the specifier as opaque — neither tries to resolve `./repo` or `../crypto/kek` at compile time.

3. Walks candidate paths in order (`['./repo']` for the repo, `['../crypto/kek', './kek']` for the KEK module) and selects the first module that exposes the expected function.

4. Accepts caller-supplied overrides via `opts._repo` / `opts._crypto` — the unit-test seam.

**Cost model.** Dynamic `import()` is a one-shot per process; both modules are cached after the first call. Routes that never run the importer never pay the parse / startup cost of the repo or the KEK module, which is the whole point — the import surface is admin-only and exceedingly cold.

## 9. RBAC

The importer trusts that the route handler has already enforced `sabflow.credential.admin` (`./rbac.ts`, registered by Phase B.8 §1). Per §1 §7 that key is the only one with KEK-rotation / plaintext-export rights; bulk import is its mirror operation (plaintext-write at scale). The importer:

- Does **not** re-check the key — RBAC lives at the request boundary.
- Does **not** elevate or impersonate — it forwards the caller-supplied `requesterId` straight into `createCredentialDirect`.
- Throws synchronously if `workspaceId` or `requesterId` is empty, so a misconfigured route can't smuggle anonymous writes through.

## 10. Audit

The route handler (§10) is responsible for emitting one `cred.write` row per *successful* import, with `metadata: { import: true, legacyId: n8nId, n8nType }`. The importer surfaces enough of the original row in `ImportPlanEntry` (`n8nId`, `n8nType`) to make those audit rows lossless without ever returning plaintext or ciphertext.

Per §1 §6, the audit emitter hashes the credential id and never persists plaintext. Failed rows do **not** emit `cred.write`; the route handler may emit a single batch-level `cred.write.failed` row carrying the `ImportResult.errors` array (no values, only `reason` + `message`).

## 11. Constraints honoured

- **No new dependencies.** CBC decryption uses `node:crypto` (`createDecipheriv`, `createHash`). No `node-forge`, no `crypto-js`, no Mongo driver, no HTTP client — the importer's only outside-Node touchpoints are the two dynamically-resolved siblings.
- **`server-only`.** Top-of-file `import 'server-only'` keeps the module out of client bundles. It only runs inside Vercel Functions (Fluid Compute / Node.js runtime).
- **No persistent state.** No module-scoped caches, no temp files, no Mongo writes that bypass the repo. Every persistence goes through `repo.createCredentialDirect`, so the §1 schema, §2 crypto envelope, and audit hooks all apply uniformly.
- **No new env vars.** The §2 KEK module already reads `SABFLOW_KEK_<id>`; the importer reads nothing from `process.env` directly.
- **Vercel-native.** Runs in a normal Function — no cron, no Marketplace integration needed. The route layer can stream a multipart upload straight into `importFromN8n({ json: buffer, … })`.

## 12. Decision log

| Date | Event | Notes |
| --- | --- | --- |
| 2026-05-18 | ADR drafted | Bulk import lives in `import-n8n.ts`, accepts both CBC and plaintext shapes, re-encrypts under the §2 KEK, persists through the §3 repo, and reports per-row failures rather than aborting. Dependencies: zero new. |
