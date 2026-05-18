# ADR — SabFlow Rust Node Credential Mock (Phase C.2 · sub-task #3)

**Status:** Accepted
**Date:** 2026-05-18
**Owner:** SabFlow / Track C Phase 2
**Source files:**
- `rust/crates/sabflow-nodes/src/test_support/mod.rs`
- `rust/crates/sabflow-nodes/src/test_support/credentials_mock.rs`
- `rust/crates/sabflow-nodes/tests/credentials_parity.rs`

**Sibling ADRs:**
- `sabflow-credentials-schema.md` — persisted row shape + envelope layout (§3 wire format).
- `sabflow-credentials-crypto.md` — KEK/DEK AES-256-GCM envelope primitives (TS source: `src/lib/sabflow/executor/credentials/crypto.ts`).
- `sabflow-credentials-resolver.md` — runtime resolver / `CredentialStorePort` contract (TS source: `src/lib/sabflow/executor/credentials/resolver.ts`).

> **Note on sibling ADR availability:** at the time this ADR was written only `sabflow-credentials-schema.md` exists on disk in this branch. The crypto + resolver ADRs are documented as docstrings on their TypeScript source files (`crypto.ts` header §§3.1–3.4 and `resolver.ts` header §§"Responsibilities"/"Security invariants"); when those source files are promoted to standalone ADRs the references above resolve verbatim with no schema drift.

---

## 1. Goal (≤200 words)

Give Rust node tests a **per-test credential store** whose envelope is byte-compatible with the production `sabflow_credentials` Mongo row. The mock wraps a hand-supplied `serde_json::Value` plaintext under a freshly-generated AES-256-GCM DEK, then wraps the DEK under a Key-Encryption-Key sourced from `SABFLOW_TEST_KEK` (base64) — falling back to a fixed deterministic 32-byte test KEK when the env var is unset. The wire layout — `iv (12) ‖ ciphertext (n) ‖ tag (16) ‖ wrappedDek (60)` — matches `sabflow-credentials-schema.md` §3 verbatim, so a future round-trip test against the TS `decryptCredential()` from `sabflow-credentials-crypto.md` requires no shape translation. The mock exposes a `CredentialsMock::new().with_credential(type, name, data).build()` builder; the resulting `MockedCredentialStore` implements the same port surface (`get_by_id`, `get_default`) that the TS `CredentialStorePort` in `sabflow-credentials-resolver.md` provides, and also flattens to the `HashMap<String, Credential>` shape the Rust executor's `ExecutionContext::with_credentials` consumes. Result: a node's `ctx.credential(...)` lookup at runtime behaves identically to n8n's `this.getCredentials(...)` parity contract.

## 2. Scope & non-goals

**In scope (owned by this file):**

- `CredentialsMock` builder + `MockedCredentialStore` port.
- `MockedCredentialEnvelope` + `to_envelope_bytes()` wire-format serializer.
- `MockedCredentialRecord::plaintext()` accessor for tests.
- Deterministic test KEK + `SABFLOW_TEST_KEK` override.
- An integration test (`tests/credentials_parity.rs`) that exercises the seam end-to-end against a `wiremock` server.

**Out of scope (owned by siblings):**

- Real Mongo lookup (`store.ts`, TS sibling §3).
- KEK rotation worker (TS sibling §6).
- OAuth2 refresh (TS sibling §5).
- Audit emission on `cred.read` (TS sibling §7) — the mock deliberately skips audit so test runs don't depend on an async sink.
- The production Rust executor's full credential trait — the mock satisfies the *port surface*, not the storage backend.

## 3. Wire format — parity with TS

The `MockedCredentialEnvelope` fields mirror the TS `CredentialEnvelope` interface (`crypto.ts`, lines 118–129) 1:1:

| TS field             | Rust field          | Type                | Size                         |
|----------------------|---------------------|---------------------|------------------------------|
| `ciphertext: Buffer` | `ciphertext: Vec<u8>` | AES-GCM ct of JSON | n bytes                      |
| `iv: Buffer`         | `iv: [u8; 12]`      | 96-bit GCM nonce    | 12                           |
| `tag: Buffer`        | `tag: [u8; 16]`     | 128-bit GCM tag     | 16                           |
| `dek: Buffer`        | `dek: [u8; 60]`     | `iv ‖ ct ‖ tag` packed | 60 (= 12 + 32 + 16)        |
| `kekId: string`      | `kek_id: String`    | KEK marker          | `"test"` for the mock        |

`to_envelope_bytes()` produces the **same persisted layout** as `CredentialEntity.dataEncrypted`:
`iv ‖ ciphertext ‖ tag ‖ wrappedDek`. The order is intentional — it matches `sabflow-credentials-schema.md` §3.2 word-for-word, so the BSON `Binary` round-trip works without conversion.

## 4. Port shape — parity with TS resolver

The TS `CredentialStorePort` (`resolver.ts`, lines 124–129) declares:

```ts
interface CredentialStorePort {
  getById(credentialId: string): Promise<CredentialRecord | null>;
  getDefault(workspaceId: string, type: string): Promise<CredentialRecord | null>;
}
```

`MockedCredentialStore` mirrors that surface:

```rust
impl MockedCredentialStore {
    pub fn get_by_id(&self, id: &str) -> Option<&MockedCredentialRecord>;
    pub fn get_default(&self, credential_type: &str) -> Option<&MockedCredentialRecord>;
    pub fn into_node_credentials(self) -> HashMap<String, Credential>;
}
```

`workspaceId` is a no-op in the mock — every test owns its own store, so workspace scoping is trivially satisfied. The "first-inserted-of-type wins the default slot" rule mirrors the n8n `isDefault` convention referenced by `sabflow-credentials-schema.md` §4.2.

`into_node_credentials()` is the executor-side bridge — it flattens decrypted plaintext into the `HashMap<String, Credential>` shape `ExecutionContext::with_credentials` consumes in production, so a fake node calling `ctx.credential(id)` behaves identically to the production runtime.

## 5. KEK lifecycle in tests

| Path                            | Behaviour                                                                                  |
|---------------------------------|--------------------------------------------------------------------------------------------|
| `SABFLOW_TEST_KEK` env set      | Base64-decoded to exactly 32 bytes; mock uses it as the wrap key.                          |
| `SABFLOW_TEST_KEK` env unset    | Falls back to the fixed 32-byte literal `sabflow-test-kek-32-bytes!!!!!!!` (deterministic).|
| Malformed env (≠ 32 bytes)      | Mock panics — tests fail loud rather than silently down-grading to default.                |

The fallback is **deliberately visible** in error messages: if a test ever leaks the KEK into an `assert!` failure, the operator immediately recognises it as the test fallback and not a real `SABFLOW_KEK_v1` from production.

## 6. n8n `getCredentials()` parity proof

The integration test `tests/credentials_parity.rs::basic_auth_credential_drives_authorization_header` proves the round trip:

1. Build a mock with `httpBasicAuth = { user: "alice", password: "x" }`.
2. Wire the mock into an `ExecutionContext`.
3. Run a fake node that calls `ctx.credential(id)`, pulls the `user` + `password` fields, and issues a `reqwest::get(url).basic_auth(user, password)`.
4. Assert (via `wiremock`) that the outbound request carries `Authorization: Basic YWxpY2U6eA==`.

The header value `YWxpY2U6eA==` is exactly what n8n V3's `HttpRequest` emits for the same credential, so the seam matches n8n's `this.getCredentials('httpBasicAuth')` contract end-to-end.

## 7. Constraints honoured

- **No new workspace deps.** `aes-gcm` is declared on the `sabflow-nodes` crate only — never added to the root `rust/Cargo.toml`. `wiremock` is a `[dev-dependencies]` entry pinned to the version already in the workspace lockfile (`0.6.x`, same as `wachat-templates-tests`).
- **No network / Mongo in tests.** The mock keeps everything in-process; `wiremock` provides a local listener bound to `127.0.0.1`.
- **No tokens leak.** Plaintext lives only inside the test's process memory; the envelope is the only on-disk-equivalent representation.
- **Deterministic.** With `SABFLOW_TEST_KEK` unset, every test run uses the same KEK — re-running a flaky-looking test in isolation always reproduces the same envelope bytes (modulo the fresh per-record DEK + IVs, which are randomised by design).

## 8. Future work

- Cross-language fixture: a single `credentials.fixture.json` shared between this mock and the TS `decryptCredential()` round-trip test (the wire format already matches; only the fixture file is missing).
- Optional `Send + Sync` async trait wrapping `MockedCredentialStore` so the executor's IPC ADR (`sabflow-executor-ipc.md`) can plug the mock into the IPC channel without an extra adapter.
- KEK rotation parity — once `sabflow-credentials-crypto.md` is promoted from its TS docstring to a standalone ADR, mirror `rotateCredential()` so rotation tests don't need a Mongo loop.

## 9. Decision log

| Date       | Event                                              | Notes                                                                                  |
|------------|----------------------------------------------------|----------------------------------------------------------------------------------------|
| 2026-05-18 | Mock landed.                                       | First Rust-side parity harness for credential injection.                               |
| 2026-05-18 | `aes-gcm` 0.10 chosen over `ring`.                 | Direct mirror of Node's `aes-256-gcm` API surface; smaller diff against the TS sibling.|
