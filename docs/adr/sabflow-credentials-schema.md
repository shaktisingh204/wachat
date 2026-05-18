# ADR — SabFlow Credential Schema (Track B · Phase 5 · §1)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-ae24fb1824a1524c7`
**Source file:** `src/lib/sabflow/executor/credentials/schema.ts`
**Sibling ADRs:** `sabflow-executor-foundation.md` (umbrella), `sabflow-executor-n8n-survey.md` (§9 `CredentialsHelper`).

---

## 1. Goal (≤200 words)

Define the **persisted credential schema** the SabFlow executor consumes, n8n-compatible end-to-end so that `n8n export:credentials --type=json` imports 1:1 and SabFlow exports round-trip back to n8n. The schema covers (a) a non-exhaustive `CredentialType` string id space (`'httpBasicAuth'`, `'oAuth2Api'`, `'googleSheetsOAuth2Api'`, `'slackApi'`, `'openAiApi'`, …); (b) a `CredentialEntity` Mongo row carrying envelope-encrypted ciphertext, KEK id, schema version, multi-tenant scope, ownership discriminator, and an optional per-node-type allow-list; (c) a `CredentialTypeDef` consumed by the editor form, the OAuth2 refresh worker, and the test-connection runner. Storage uses **envelope encryption**: a per-record AES-256-GCM Data-Encryption-Key (DEK) wraps the JSON plaintext; the DEK is itself wrapped under a Key-Encryption-Key (KEK) sourced from `SABFLOW_KEK_<id>` on Vercel env — so KEK rotation re-wraps 60 bytes per row, never the ciphertext. n8n's `credentials.json` import (Phase 5 §8), `cred.test` operation (§7), audit trail (already shipped), and RBAC keys (already shipped) all consume *this* schema as their source of truth. No deps added; no model registered (Phase 5 §3 owns CRUD + indexes).

## 2. Scope & non-goals

**In scope (owned by this file):**

- TypeScript types: `CredentialType`, `CredentialTypeDef`, `CredentialEntity`, `CredentialDTO`, `DecryptedCredentialData`, `CredentialOwnerType`, `CredentialTestOperation`.
- The known-type registry (`CREDENTIAL_TYPES_KNOWN`) — non-exhaustive, grows as nodes land.
- Collection-name constant (`SABFLOW_CREDENTIALS_COLLECTION = 'sabflow_credentials'`).
- The encryption envelope wire format (ciphertext ‖ tag ‖ wrapped DEK), inherited from `./crypto.ts`.

**Out of scope (owned by siblings):**

- Crypto primitives — `./crypto.ts` (Phase 5 §2, already shipped).
- Mongo CRUD / index registration — Phase 5 §3 (this ADR forbids registering the model here).
- OAuth2 refresh — Phase 5 §6.
- `testOperation` runner — Phase 5 §7.
- RBAC keys — `./rbac.ts` (already shipped).
- Audit emitter — `./audit.ts` (already shipped).
- SabFiles backing for large/cold credentials — Phase 5 §9.
- REST surface — Phase 5 §10.

## 3. Storage strategy — envelope encryption

### 3.1 Why envelope?

n8n stores credential `data` as a single AES-256-CBC blob keyed off `N8N_ENCRYPTION_KEY`. That works, but rotating the key means decrypting + re-encrypting every row (and exposing plaintext in the rotation worker's memory across the entire store). SabFlow uses **envelope encryption**:

| Layer | Algorithm | Key | Stored where |
| --- | --- | --- | --- |
| Plaintext → ciphertext | AES-256-GCM | DEK (fresh per record, 32 bytes) | `dataEncrypted.ciphertext` |
| DEK → wrapped DEK | AES-256-GCM | KEK (from `SABFLOW_KEK_<id>` env) | `dataEncrypted.wrappedDek` |

**Properties:**

- KEK rotation re-wraps **60 bytes per row** (`iv ‖ ct ‖ tag` of the DEK), never the ciphertext. A workspace-wide rotation is O(rows) of cheap writes.
- A leaked DEK exposes one credential — not the whole store.
- The KEK never touches Mongo. It lives in Vercel env (or a Marketplace KMS once Phase 5 §11 ships KMS-backed KEKs).
- AES-256-GCM gives us a constant-time authenticated tag on both layers, so any tamper / wrong-key / wrong-record surfaces as a typed `CredentialsError` from `./crypto.ts`.

### 3.2 Wire format

`CredentialEntity.dataEncrypted` is a packed `Buffer`. The exact byte layout (defined in `./crypto.ts`):

```
iv (12) ‖ ciphertext (n) ‖ tag (16) ‖ wrappedDek (60)
```

Where `wrappedDek` itself decomposes to `iv (12) ‖ ct (32) ‖ tag (16)`. `kek` on the row records which `SABFLOW_KEK_<id>` env var owns the outer wrap so a row-by-row rotation can target a specific cohort.

### 3.3 KEK lifecycle

- Bootstrap: `SABFLOW_KEK_v1` set on Vercel for all envs (Production / Preview / Development).
- Rotation: introduce `SABFLOW_KEK_v2`, run Phase 5 §6's rotation worker (`rotateCredential(envelope, 'v1', 'v2')` from `./crypto.ts`) over batches filtered by `{ kek: 'v1' }`, then retire `SABFLOW_KEK_v1` once the count is zero. No row's ciphertext is touched.
- Compromise: if a KEK leaks, generate `SABFLOW_KEK_<new>` and run rotation as above; the leaked KEK can only unwrap DEKs whose ciphertexts are also leaked, so the blast radius is paired-leakage.

### 3.4 Version field

`CredentialEntity.version` ships at **`1`**. Bumped on a breaking persisted-shape change (e.g. splitting `dataEncrypted` into a sidecar collection, switching algorithms). Older versions are upcast by Phase 5 §3's reader; nothing in this file branches on `version` itself.

## 4. n8n import / export round-trip

### 4.1 n8n `credentials.json` shape (input)

```json
[
  {
    "id": "1",
    "name": "My HTTP Basic",
    "type": "httpBasicAuth",
    "data": { "user": "alice", "password": "***" },
    "nodesAccess": [{ "nodeType": "n8n-nodes-base.httpRequest" }],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 4.2 Field map (n8n → SabFlow)

| n8n field | SabFlow field on `CredentialEntity` | Notes |
| --- | --- | --- |
| `id` | (discarded — fresh `_id`) | n8n ids are numeric strings; we don't preserve them. Phase 5 §8 stores the legacy id in `audit.metadata.legacyId` for traceability. |
| `name` | `name` | Verbatim. |
| `type` | `type` | Verbatim — `CredentialType` is intentionally open so unknown n8n types still import. |
| `data` | `dataEncrypted` (after envelope-encrypt under current KEK) | Plaintext only lives in memory inside the importer. |
| `nodesAccess[].nodeType` | `allowedNodeTypes` | Array projection. Empty `nodesAccess` → `undefined` (any node). |
| `createdAt` | `createdAt` | Parsed from ISO-8601. |
| `updatedAt` | `updatedAt` | Parsed from ISO-8601. |
| *(implicit)* | `workspaceId` | Set by importer to the target workspace. |
| *(implicit)* | `createdBy` | Set to the user running the import. |
| *(implicit)* | `ownerType` | Defaults to `'workspace'` when `nodesAccess` is broad; `'user'` otherwise. |
| *(implicit)* | `kek` | Set to `DEFAULT_KEK_ID` (`v1`) by `./crypto.ts`. |
| *(implicit)* | `version` | Set to `1`. |

### 4.3 SabFlow → n8n (export)

The export path inverts the table above. `dataEncrypted` is decrypted **once**, in-memory, behind the `sabflow.credential.admin` RBAC gate (the only role that can export plaintext), and re-emitted as `data`. The audit row carries `cred.read` with `source: 'api'` and `purpose: 'export'`. No KEK ids, no envelope bytes, and no SabFlow-specific fields leak.

### 4.4 Unknown types

`CredentialType` is an open `string`. An n8n credential whose `type` is not in `CREDENTIAL_TYPES_KNOWN` still imports — it just won't render a typed form in the editor until someone publishes a `CredentialTypeDef` for it. Nodes that request the type at runtime get the decrypted bag verbatim.

## 5. Test-connection contract

`CredentialTypeDef.testOperation` is a **declarative HTTP probe**:

```ts
{
  request: { method, url, headers?, qs?, body? },
  rules?: [
    { type: 'responseStatusCode', properties: { value: 200 } },
    { type: 'responseSuccessBody', properties: { key: 'ok', value: true } },
  ],
}
```

Strings in `url`, `headers`, `qs`, and `body` are templated against the decrypted credential data (`{{ $credentials.apiKey }}` etc.) using the same expression engine as nodes. Phase 5 §7 owns the runner; this file just nails the shape so the runner is purely interpretive — important because the same descriptor is also serialisable to the Rust worker over the IPC channel (per the IPC ADR).

When `testOperation` is absent the editor still allows save; it just doesn't show a green / red dot.

**Audit:** every test emits a `cred.test` row via `./audit.ts` with `{ source: 'ui' | 'api', credentialType }`; no plaintext, no response body.

## 6. Audit log integration

Every read / write touches `./audit.ts` (already shipped, `cred.*` namespace):

| Trigger | Action | Source |
| --- | --- | --- |
| Editor create / update | `cred.write` | `'ui'` |
| Editor delete | `cred.delete` | `'ui'` |
| Editor share / unshare | `cred.share` / `cred.unshare` | `'ui'` |
| Editor test button | `cred.test` | `'ui'` |
| Runtime `ctx.getCredentials()` | `cred.read` (rate-capped) | `'runtime'` |
| OAuth2 refresh | `cred.refresh` | `'runtime'` |
| KEK rotation worker | `cred.write` with `metadata.rotation: true` | `'api'` |

The audit emitter hashes the credential id, never persists plaintext, and is wrapped in try/catch so it never blocks the user action.

## 7. RBAC

Reserved keys (already shipped in `./rbac.ts`, registered globally by Phase B.8 §1):

- `sabflow.credential.read` — see metadata only
- `sabflow.credential.use` — decrypt at runtime
- `sabflow.credential.write` — create / update
- `sabflow.credential.delete` — delete
- `sabflow.credential.share` — change ACL
- `sabflow.credential.admin` — KEK rotation, plaintext export, force-revoke

`CredentialEntity.ownerType` + `allowedNodeTypes` are the two row-level gates the helpers consult in addition to the workspace-role check.

## 8. Why we don't reshape the legacy `sabflow_credentials` collection inline

The legacy `src/lib/sabflow/credentials/db.ts` writes to the same collection name with a *different* shape (`data: Record<string, encryptedString>`, no envelope, no KEK id, no version). Coexistence rule:

- New rows written by Phase 5 (this schema) carry `version >= 1` and `dataEncrypted: Buffer` (`Binary` in BSON).
- Legacy rows have `data: Record<string, string>` and no `version` field.
- Phase 5 §3's reader branches on **presence of `dataEncrypted`** vs **presence of `data`**, upcasts legacy on read, and rewrites them in the envelope format on next write.
- A one-shot migration (Phase 5 §8 sibling) walks legacy rows and re-encrypts them under the current KEK; until then, both shapes are tolerated. Past the migration, the upcaster is removed in a follow-up.

## 9. Constraints honoured

- **No new dependencies.** All imports are `mongodb` (already in `package.json`) and the in-repo `../contract`. `Buffer` / `crypto` are Node built-ins.
- **No model registered.** `SABFLOW_CREDENTIALS_COLLECTION` is a const string; the file opens zero connections and creates zero indexes. Phase 5 §3 owns that.
- **`server-only`** import keeps this module out of any client bundle.
- **Vercel-native KEK.** KEKs source from `SABFLOW_KEK_<id>` env vars, provisioned via `vercel env` — no external KMS, no service-account JSON. Marketplace KMS is the Phase 5 §11 upgrade path, not a Phase 1 requirement.

## 10. Decision log

| Date | Event | Notes |
| --- | --- | --- |
| 2026-05-18 | Schema landed | Source of truth for the nine Phase 5 siblings. |
