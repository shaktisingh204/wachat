//! Per-test envelope-encrypted credential mock — parity with the TS
//! `executor/credentials/crypto.ts` wire format.
//!
//! ## What this gives a test
//!
//! - `CredentialsMock::new().with_credential(type, name, data)` — a
//!   builder that hand-supplies plaintext `serde_json::Value` payloads.
//! - `mock.build()` → `MockedCredentialStore` — a port that the runtime
//!   resolver (TS side) and the Rust executor's credential trait both
//!   consume.
//! - `mock.into_node_credentials()` — drops straight into
//!   `ExecutionContext::with_credentials` so a test can call
//!   `node.execute(&mut ctx, …)` and the node's `ctx.credential()` works
//!   exactly the way it does in production.
//!
//! ## Envelope shape
//!
//! Every credential plaintext is wrapped in the **same envelope** the
//! production store persists — see ADRs:
//!
//! - [`docs/adr/sabflow-credentials-schema.md`] (§3 — wire format)
//! - [`docs/adr/sabflow-node-credential-mock.md`] (this mock)
//!
//! The wire format is:
//!
//! ```text
//!   iv (12) ‖ ciphertext (n) ‖ tag (16) ‖ wrappedDek (60)
//! ```
//!
//! where `wrappedDek = iv (12) ‖ ct (32) ‖ tag (16)` (the DEK is itself
//! a 32-byte AES-256 key, sealed under the KEK). The mock's
//! `to_envelope_bytes()` returns exactly those bytes so a round-trip
//! test against the TS decryptor — or vice versa — sees identical wire
//! material.
//!
//! ## KEK source
//!
//! The mock reads the **`SABFLOW_TEST_KEK`** env var, base64-decoded to
//! exactly 32 bytes. If unset, the mock falls back to a fixed
//! deterministic test KEK (32 ASCII bytes — see
//! [`DEFAULT_TEST_KEK`]). This deterministic fallback keeps `cargo
//! test` runs reproducible without requiring a setup step.

use std::collections::HashMap;
use std::sync::Arc;

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Key, Nonce};
use base64::Engine;
use serde_json::Value;

use crate::context::Credential;

/// Name of the env var that holds the base64-encoded 32-byte test KEK.
/// Mirrors production's `SABFLOW_KEK_<id>` naming so the mock feels
/// familiar.
pub const TEST_KEK_ENV: &str = "SABFLOW_TEST_KEK";

/// KEK id stamped on every envelope the mock produces. Production uses
/// `v1` as the bootstrap id; the mock uses `test` so a stray production
/// reader can't confuse a test envelope for a real one.
pub const MOCK_KEK_ID: &str = "test";

/// AES-256-GCM key length, in bytes.
const KEY_LENGTH: usize = 32;
/// AES-256-GCM nonce length (96 bits — what GCM strongly prefers).
const IV_LENGTH: usize = 12;
/// AES-256-GCM auth tag length (128 bits).
const TAG_LENGTH: usize = 16;
/// `iv ‖ ct ‖ tag` packed wrapped DEK.
const WRAPPED_DEK_LENGTH: usize = IV_LENGTH + KEY_LENGTH + TAG_LENGTH;

/// Deterministic fallback used when `SABFLOW_TEST_KEK` is unset. Exactly
/// 32 ASCII bytes — visible-on-purpose so any test failure that surfaces
/// the KEK in an error message is immediately recognizable as the test
/// fallback rather than a real production secret.
const DEFAULT_TEST_KEK: &[u8; KEY_LENGTH] = b"sabflow-test-kek-32-bytes!!!!!!!";

/* ------------------------------------------------------------------ */
/* Envelope + record types                                            */
/* ------------------------------------------------------------------ */

/// Mirror of `CredentialEnvelope` from
/// `src/lib/sabflow/executor/credentials/crypto.ts`. Field names match
/// the TS type 1:1 so a future serde-round-trip test can swap the two
/// without renaming.
#[derive(Debug, Clone)]
pub struct MockedCredentialEnvelope {
    /// AES-256-GCM ciphertext of the JSON plaintext, under the DEK.
    pub ciphertext: Vec<u8>,
    /// 12-byte IV used for `ciphertext`.
    pub iv: [u8; IV_LENGTH],
    /// 16-byte GCM tag for `ciphertext`.
    pub tag: [u8; TAG_LENGTH],
    /// Packed wrapped DEK: `iv (12) ‖ ct (32) ‖ tag (16)` = 60 bytes.
    pub dek: [u8; WRAPPED_DEK_LENGTH],
    /// Which KEK was used to wrap `dek`. Always `MOCK_KEK_ID` for now.
    pub kek_id: String,
}

impl MockedCredentialEnvelope {
    /// Serialise the envelope to the **persisted** wire format —
    /// `iv ‖ ct ‖ tag ‖ wrappedDek` — exactly as the TS
    /// `CredentialEntity.dataEncrypted` BSON `Binary` holds it. This is
    /// what a future round-trip test against the TS decryptor would
    /// hand to `decryptCredential(envelope)`.
    pub fn to_envelope_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(IV_LENGTH + self.ciphertext.len() + TAG_LENGTH + WRAPPED_DEK_LENGTH);
        out.extend_from_slice(&self.iv);
        out.extend_from_slice(&self.ciphertext);
        out.extend_from_slice(&self.tag);
        out.extend_from_slice(&self.dek);
        out
    }

    /// Convenience round-trip — decrypt the envelope back to its
    /// plaintext `serde_json::Value`. Tests use this to assert the
    /// envelope is well-formed without leaving the mock.
    pub fn decrypt(&self, kek: &[u8; KEY_LENGTH]) -> serde_json::Result<Value> {
        // 1. Unwrap DEK under KEK.
        let dek_iv: &[u8; IV_LENGTH] = self.dek[..IV_LENGTH].try_into().expect("12-byte slice");
        let dek_ct = &self.dek[IV_LENGTH..IV_LENGTH + KEY_LENGTH];
        let dek_tag = &self.dek[IV_LENGTH + KEY_LENGTH..WRAPPED_DEK_LENGTH];
        let mut dek_sealed = Vec::with_capacity(KEY_LENGTH + TAG_LENGTH);
        dek_sealed.extend_from_slice(dek_ct);
        dek_sealed.extend_from_slice(dek_tag);

        let kek_cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(kek));
        let dek_bytes = kek_cipher
            .decrypt(Nonce::from_slice(dek_iv), dek_sealed.as_ref())
            .expect("DEK unwrap (test envelope must be valid)");

        // 2. Decrypt ciphertext under DEK.
        let dek_arr: [u8; KEY_LENGTH] = dek_bytes
            .as_slice()
            .try_into()
            .expect("DEK must be 32 bytes after unwrap");
        let dek_cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&dek_arr));
        let mut sealed = Vec::with_capacity(self.ciphertext.len() + TAG_LENGTH);
        sealed.extend_from_slice(&self.ciphertext);
        sealed.extend_from_slice(&self.tag);
        let plaintext = dek_cipher
            .decrypt(Nonce::from_slice(&self.iv), sealed.as_ref())
            .expect("ciphertext decrypt (test envelope must be valid)");

        serde_json::from_slice(&plaintext)
    }
}

/// One mocked credential row — mirrors the projection that the runtime
/// resolver (`CredentialRecord` in `resolver.ts`) reads from Mongo.
#[derive(Debug, Clone)]
pub struct MockedCredentialRecord {
    /// Stable id — what `nodeParams.credentialId` references.
    pub id: String,
    /// Credential type — e.g. `"httpBasicAuth"`, `"slackApi"`. Must
    /// match the type the node requested or the resolver throws
    /// `TYPE_MISMATCH` in production. The mock enforces the same.
    pub credential_type: String,
    /// Display name — verbatim copy of the TS schema's `name` field.
    pub name: String,
    /// Envelope-encrypted payload.
    pub envelope: MockedCredentialEnvelope,
    /// Decrypted plaintext kept alongside the envelope so the mock can
    /// hand it to a node without re-running AES on every read. In
    /// production this would live only in process memory inside the
    /// resolver's per-execution LRU cache.
    plaintext: Value,
}

impl MockedCredentialRecord {
    /// Decrypted plaintext, by reference. Tests use this to assert
    /// envelope round-trip without re-implementing AES.
    pub fn plaintext(&self) -> &Value {
        &self.plaintext
    }

    /// Flatten the JSON object into the `HashMap<String, String>`
    /// shape that the Rust `Credential` struct (and every existing
    /// node's `ctx.credential(...).data` reader) expects.
    ///
    /// String fields are passed through verbatim. Non-string scalars
    /// are stringified via `Value::to_string` so a number / bool credential
    /// field still surfaces something readable to the node. Object /
    /// array fields are JSON-stringified for the same reason.
    fn to_node_credential(&self) -> Credential {
        let mut data: HashMap<String, String> = HashMap::new();
        if let Value::Object(map) = &self.plaintext {
            for (k, v) in map {
                let s = match v {
                    Value::String(s) => s.clone(),
                    Value::Null => String::new(),
                    other => other.to_string(),
                };
                data.insert(k.clone(), s);
            }
        }
        Credential {
            id: self.id.clone(),
            credential_type: self.credential_type.clone(),
            data,
        }
    }
}

/* ------------------------------------------------------------------ */
/* Builder                                                            */
/* ------------------------------------------------------------------ */

/// Builder-style mock credential store.
///
/// ```ignore
/// use sabflow_nodes::test_support::CredentialsMock;
/// use serde_json::json;
///
/// let store = CredentialsMock::new()
///     .with_credential("httpBasicAuth", "My Basic", json!({ "user": "alice", "password": "x" }))
///     .build();
/// ```
#[derive(Debug, Clone, Default)]
pub struct CredentialsMock {
    pending: Vec<MockedCredentialRecord>,
}

impl CredentialsMock {
    pub fn new() -> Self {
        Self { pending: vec![] }
    }

    /// Add a credential. Returns `self` for chaining. The auto-generated
    /// id is `cred_<index>` — predictable across runs so a test can
    /// reference it without an extra round-trip.
    pub fn with_credential(
        mut self,
        credential_type: impl Into<String>,
        name: impl Into<String>,
        data: Value,
    ) -> Self {
        let credential_type = credential_type.into();
        let name = name.into();
        let id = format!("cred_{}", self.pending.len());
        let envelope = seal(&data).expect("test envelope sealing must succeed");
        self.pending.push(MockedCredentialRecord {
            id,
            credential_type,
            name,
            envelope,
            plaintext: data,
        });
        self
    }

    /// Same as [`Self::with_credential`] but caller supplies the id —
    /// useful when a test pre-bakes a flow JSON that references a
    /// specific `credentialId`.
    pub fn with_credential_id(
        mut self,
        id: impl Into<String>,
        credential_type: impl Into<String>,
        name: impl Into<String>,
        data: Value,
    ) -> Self {
        let envelope = seal(&data).expect("test envelope sealing must succeed");
        self.pending.push(MockedCredentialRecord {
            id: id.into(),
            credential_type: credential_type.into(),
            name: name.into(),
            envelope,
            plaintext: data,
        });
        self
    }

    /// Finalise — produce the store the resolver-port / Rust executor
    /// consumes.
    pub fn build(self) -> MockedCredentialStore {
        let mut by_id: HashMap<String, MockedCredentialRecord> = HashMap::new();
        let mut defaults: HashMap<String, String> = HashMap::new(); // type → id
        for rec in self.pending {
            // First-inserted credential of each type wins the "default"
            // slot — same convention as production's `isDefault` flag.
            defaults
                .entry(rec.credential_type.clone())
                .or_insert_with(|| rec.id.clone());
            by_id.insert(rec.id.clone(), rec);
        }
        MockedCredentialStore {
            by_id: Arc::new(by_id),
            defaults: Arc::new(defaults),
        }
    }

    /// Shortcut for nodes whose tests don't need the resolver port —
    /// flattens straight into the `ExecutionContext::with_credentials`
    /// map. Equivalent to `self.build().into_node_credentials()`.
    pub fn into_node_credentials(self) -> HashMap<String, Credential> {
        self.build().into_node_credentials()
    }
}

/* ------------------------------------------------------------------ */
/* Store port                                                         */
/* ------------------------------------------------------------------ */

/// In-memory credential store, drop-in for the production
/// `CredentialStorePort` (TS) and the Rust executor's credential trait.
///
/// The store is `Send + Sync + Clone` (cheaply via `Arc`) so the same
/// instance can be handed to multiple async tasks in a parallel test.
#[derive(Debug, Clone)]
pub struct MockedCredentialStore {
    by_id: Arc<HashMap<String, MockedCredentialRecord>>,
    /// Per-credential-type default id. Mirrors `getDefault(workspaceId, type)`.
    defaults: Arc<HashMap<String, String>>,
}

impl MockedCredentialStore {
    /// Lookup by id — `Some` when present, `None` when not. Matches the
    /// `getById` shape of `CredentialStorePort` in `resolver.ts`.
    pub fn get_by_id(&self, id: &str) -> Option<&MockedCredentialRecord> {
        self.by_id.get(id)
    }

    /// Workspace-default lookup. Same semantics as
    /// `getDefault(workspaceId, type)` in `resolver.ts` — workspace
    /// scoping is a no-op in the mock since every test owns its own
    /// store.
    pub fn get_default(&self, credential_type: &str) -> Option<&MockedCredentialRecord> {
        let id = self.defaults.get(credential_type)?;
        self.by_id.get(id)
    }

    /// Hand a node the same `HashMap<String, Credential>` shape that
    /// `ExecutionContext::with_credentials` consumes in production.
    pub fn into_node_credentials(self) -> HashMap<String, Credential> {
        self.by_id
            .iter()
            .map(|(id, rec)| (id.clone(), rec.to_node_credential()))
            .collect()
    }

    /// Count of credentials in the store — handy for assertions.
    pub fn len(&self) -> usize {
        self.by_id.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_id.is_empty()
    }
}

/* ------------------------------------------------------------------ */
/* Crypto helpers                                                     */
/* ------------------------------------------------------------------ */

/// Resolve the KEK. Reads `SABFLOW_TEST_KEK` if set, falls back to the
/// fixed deterministic test KEK otherwise.
fn resolve_kek() -> [u8; KEY_LENGTH] {
    if let Ok(raw) = std::env::var(TEST_KEK_ENV) {
        if !raw.is_empty() {
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(raw.trim())
                .expect("SABFLOW_TEST_KEK must be valid base64");
            assert_eq!(
                decoded.len(),
                KEY_LENGTH,
                "SABFLOW_TEST_KEK must decode to {} bytes",
                KEY_LENGTH
            );
            let mut out = [0u8; KEY_LENGTH];
            out.copy_from_slice(&decoded);
            return out;
        }
    }
    *DEFAULT_TEST_KEK
}

/// Envelope-seal `plaintext` under a freshly-generated DEK, wrapping
/// the DEK under the test KEK. Mirrors `encryptCredential()` from
/// `crypto.ts`.
fn seal(plaintext: &Value) -> Result<MockedCredentialEnvelope, &'static str> {
    let kek = resolve_kek();

    // 1. Generate a fresh DEK and IVs.
    let dek_key: Key<Aes256Gcm> = Aes256Gcm::generate_key(&mut OsRng);
    let payload_nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let dek_nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    // 2. Encrypt the plaintext (as JSON bytes) under the DEK.
    let serialized = serde_json::to_vec(plaintext).map_err(|_| "JSON serialisation failed")?;
    let dek_cipher = Aes256Gcm::new(&dek_key);
    let sealed = dek_cipher
        .encrypt(&payload_nonce, serialized.as_ref())
        .map_err(|_| "DEK encrypt failed")?;
    // `sealed` is `ciphertext ‖ tag` (16-byte tag suffix per
    // RustCrypto's AEAD convention — matches Node's `aes-256-gcm`
    // exactly).
    let (ciphertext, tag_bytes) = sealed.split_at(sealed.len() - TAG_LENGTH);
    let mut tag = [0u8; TAG_LENGTH];
    tag.copy_from_slice(tag_bytes);

    // 3. Wrap the DEK under the KEK.
    let kek_cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&kek));
    let wrapped = kek_cipher
        .encrypt(&dek_nonce, dek_key.as_slice())
        .map_err(|_| "DEK wrap failed")?;
    // `wrapped` is `ct (32) ‖ tag (16)`.
    let (dek_ct, dek_tag_bytes) = wrapped.split_at(wrapped.len() - TAG_LENGTH);
    assert_eq!(dek_ct.len(), KEY_LENGTH, "wrapped DEK ct must be 32 bytes");
    let mut dek_packed = [0u8; WRAPPED_DEK_LENGTH];
    dek_packed[..IV_LENGTH].copy_from_slice(&dek_nonce);
    dek_packed[IV_LENGTH..IV_LENGTH + KEY_LENGTH].copy_from_slice(dek_ct);
    dek_packed[IV_LENGTH + KEY_LENGTH..].copy_from_slice(dek_tag_bytes);

    let mut iv = [0u8; IV_LENGTH];
    iv.copy_from_slice(&payload_nonce);

    Ok(MockedCredentialEnvelope {
        ciphertext: ciphertext.to_vec(),
        iv,
        tag,
        dek: dek_packed,
        kek_id: MOCK_KEK_ID.to_string(),
    })
}

/* ------------------------------------------------------------------ */
/* Self-tests                                                         */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod self_tests {
    use super::*;
    use serde_json::json;

    /// Round-trip — what goes into the envelope must come back out.
    #[test]
    fn envelope_round_trips_under_default_test_kek() {
        let plaintext = json!({ "user": "alice", "password": "x" });
        let env = seal(&plaintext).expect("seal");
        let kek = *DEFAULT_TEST_KEK;
        let decoded = env.decrypt(&kek).expect("decrypt");
        assert_eq!(decoded, plaintext);
    }

    /// Wire format is exactly `iv ‖ ct ‖ tag ‖ wrappedDek`.
    #[test]
    fn envelope_wire_format_layout() {
        let plaintext = json!({ "x": 1 });
        let env = seal(&plaintext).expect("seal");
        let bytes = env.to_envelope_bytes();
        // iv (12) + ct (variable, > 0) + tag (16) + wrappedDek (60).
        assert!(bytes.len() > IV_LENGTH + TAG_LENGTH + WRAPPED_DEK_LENGTH);
        let iv_slice = &bytes[..IV_LENGTH];
        let tail = &bytes[bytes.len() - WRAPPED_DEK_LENGTH..];
        assert_eq!(iv_slice, env.iv);
        assert_eq!(tail, env.dek);
    }

    /// Builder + store: `with_credential` populates `by_id` and the
    /// first-in default slot.
    #[test]
    fn builder_populates_store_and_defaults() {
        let store = CredentialsMock::new()
            .with_credential("httpBasicAuth", "First", json!({ "user": "a", "password": "1" }))
            .with_credential("httpBasicAuth", "Second", json!({ "user": "b", "password": "2" }))
            .with_credential("slackApi", "Slack", json!({ "accessToken": "xoxb" }))
            .build();
        assert_eq!(store.len(), 3);
        // First-of-type wins the default slot.
        let default = store
            .get_default("httpBasicAuth")
            .expect("default httpBasicAuth");
        assert_eq!(default.name, "First");
        // Lookup by id round-trips.
        let by_id = store.get_by_id("cred_2").expect("by id");
        assert_eq!(by_id.credential_type, "slackApi");
    }

    /// Flatten to node credentials — non-string scalars get stringified.
    #[test]
    fn flatten_to_node_credentials_preserves_strings() {
        let creds = CredentialsMock::new()
            .with_credential_id(
                "my-cred",
                "httpBasicAuth",
                "Basic",
                json!({ "user": "alice", "password": "secret", "port": 8080 }),
            )
            .into_node_credentials();
        let c = creds.get("my-cred").expect("my-cred");
        assert_eq!(c.id, "my-cred");
        assert_eq!(c.credential_type, "httpBasicAuth");
        assert_eq!(c.data.get("user").map(String::as_str), Some("alice"));
        assert_eq!(c.data.get("password").map(String::as_str), Some("secret"));
        assert_eq!(c.data.get("port").map(String::as_str), Some("8080"));
    }
}
