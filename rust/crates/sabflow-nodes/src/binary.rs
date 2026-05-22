//! Binary-data references for SabFlow nodes.
//!
//! ## Why this module exists
//!
//! n8n's `IBinaryData` interface carries an item's binary payload **inline**
//! as a base64 string by default (`{ data: 'AAAA…', mimeType: '…' }`). That
//! works for tiny clipboard-size items but explodes the in-memory size of
//! every queue message, audit log, and serialised execution state once a
//! single multi-megabyte file enters the pipe.
//!
//! n8n's own "filesystem mode" sidesteps this by storing the bytes
//! out-of-band on disk and referencing them by id (`{ id: 'fs:…', mimeType,
//! fileName }`). SabFlow takes the same shape — but the backing store is
//! **SabFiles**, the project-wide file manager (see `CLAUDE.md` SabFiles
//! policy: *"every file in SabNode lives in SabFiles"*).
//!
//! The contract is therefore:
//!
//! * Nodes pass [`BinaryDataRef`] values between each other — **never raw
//!   bytes**, **never raw R2 URLs**.
//! * Serialised form on the wire / in queues is the n8n-compatible
//!   `{ id, mimeType, fileName, fileExtension?, fileSize? }` JSON object.
//! * Bytes are fetched lazily through the [`BinaryStore`] trait at the
//!   moment a node actually needs them. The default implementation returns
//!   [`NodeError::NotImplemented`] until the BFF crate wires itself in.
//!
//! See `docs/adr/sabflow-binary-data.md` for the design rationale.

use std::fmt;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{NodeError, NodeResult};

/// Logical handle to a binary payload stored in SabFiles.
///
/// This struct is the in-memory shape that flows between nodes. Its
/// `Serialize`/`Deserialize` representation matches n8n's filesystem-mode
/// `IBinaryData`: `{ id, mimeType, fileName, fileExtension?, fileSize? }`
/// — **never** a base64 `data` field, **never** a raw R2 URL.
///
/// Field naming is `camelCase` on the wire to mirror n8n's TypeScript shape
/// so the JS-side type guards (`isBinaryValue`) keep working unchanged.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BinaryDataRef {
    /// SabFiles file id. This is the same id that the
    /// `<SabFilePicker>` UI surfaces and that the SabFiles BFF resolves.
    pub id: String,

    /// MIME type at upload time (`image/png`, `application/pdf`, …).
    /// Empty string only when truly unknown.
    pub mime_type: String,

    /// Original file name, including extension where present.
    pub file_name: String,

    /// Extension without the leading dot (`"png"`, `"pdf"`). Optional —
    /// derive from `file_name` when absent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_extension: Option<String>,

    /// Byte size from the SabFiles metadata. Optional — present whenever
    /// the producing node had the number on hand.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_size: Option<u64>,
}

impl BinaryDataRef {
    /// Construct a ref from the minimum required fields.
    pub fn new(
        id: impl Into<String>,
        mime_type: impl Into<String>,
        file_name: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            mime_type: mime_type.into(),
            file_name: file_name.into(),
            file_extension: None,
            file_size: None,
        }
    }

    /// Builder-style: attach an explicit extension.
    pub fn with_extension(mut self, ext: impl Into<String>) -> Self {
        self.file_extension = Some(ext.into());
        self
    }

    /// Builder-style: attach a known byte size.
    pub fn with_size(mut self, size: u64) -> Self {
        self.file_size = Some(size);
        self
    }

    /// Best-effort extension — explicit field wins, otherwise derive from
    /// `file_name`.
    pub fn effective_extension(&self) -> Option<String> {
        if let Some(ext) = &self.file_extension {
            return Some(ext.clone());
        }
        let dot = self.file_name.rfind('.')?;
        let ext = &self.file_name[dot + 1..];
        if ext.is_empty() {
            None
        } else {
            Some(ext.to_string())
        }
    }

    /// Parse a ref from a `serde_json::Value`. Returns `None` if the value
    /// doesn't look like a binary-data ref (i.e. it's regular JSON data).
    ///
    /// This is the analogue of the JS-side `isBinaryValue` type guard.
    pub fn try_from_json(value: &Value) -> Option<Self> {
        let obj = value.as_object()?;
        // n8n's wire shape requires both `id` and `mimeType`. We reject
        // any object that also has a `data` field — those are inline
        // base64 payloads, which SabFlow refuses on purpose (see ADR §1).
        if obj.contains_key("data") {
            return None;
        }
        obj.get("id")?.as_str()?;
        obj.get("mimeType")?.as_str()?;
        serde_json::from_value(value.clone()).ok()
    }

    /// Render the ref as its canonical JSON wire-shape.
    pub fn to_json(&self) -> Value {
        serde_json::to_value(self).expect("BinaryDataRef serialises to JSON cleanly")
    }
}

impl fmt::Display for BinaryDataRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "sabfiles:{}", self.id)
    }
}

/// Caller context for a fetch. Lets the store enforce workspace ownership
/// and route audit events through the existing credentials/audit pipeline.
///
/// Mirrors the shape used by `executor/credentials/resolver.ts` so the BFF
/// crate can share its JWT-signing and ownership-check plumbing.
#[derive(Debug, Clone)]
pub struct BinaryFetchContext {
    /// Workspace performing the read — enforced server-side.
    pub workspace_id: String,
    /// Execution id, for audit + tracing.
    pub execution_id: String,
    /// Optional originating node id (audit-only).
    pub node_id: Option<String>,
}

impl BinaryFetchContext {
    pub fn new(workspace_id: impl Into<String>, execution_id: impl Into<String>) -> Self {
        Self {
            workspace_id: workspace_id.into(),
            execution_id: execution_id.into(),
            node_id: None,
        }
    }

    pub fn with_node_id(mut self, node_id: impl Into<String>) -> Self {
        self.node_id = Some(node_id.into());
        self
    }
}

/// Trait that fetches the bytes behind a [`BinaryDataRef`].
///
/// Implementations are expected to talk to the SabFiles BFF using the same
/// signed-JWT pattern as `executor/credentials/resolver.ts`. Tests inject
/// in-memory fakes via [`InMemoryBinaryStore`].
///
/// The trait is intentionally narrow: a single `load` method. We do **not**
/// expose `presigned_url`, `download_url`, or any other "give me an R2
/// pointer" method — those would let nodes leak raw bucket URLs and violate
/// the SabFiles policy in `CLAUDE.md`.
#[async_trait]
pub trait BinaryStore: Send + Sync {
    /// Fetch the bytes for `reference`.
    ///
    /// Errors must be [`NodeError`] so the node-execution layer can route
    /// them through its standard error port.
    async fn load(
        &self,
        reference: &BinaryDataRef,
        ctx: &BinaryFetchContext,
    ) -> NodeResult<Vec<u8>>;
}

/// Default store — refuses every request with [`NodeError::NotImplemented`].
///
/// This is what the registry hands out until the real BFF crate wires
/// itself in (see [`set_default_binary_store`]). Tests rely on the
/// `NotImplemented` behaviour to confirm the wiring contract.
pub struct UnconfiguredBinaryStore;

#[async_trait]
impl BinaryStore for UnconfiguredBinaryStore {
    async fn load(
        &self,
        reference: &BinaryDataRef,
        _ctx: &BinaryFetchContext,
    ) -> NodeResult<Vec<u8>> {
        Err(NodeError::NotImplemented(format!(
            "SabFiles binary store is not configured — cannot load ref {}",
            reference
        )))
    }
}

/// In-process fake store for tests. Holds payloads keyed by SabFiles id.
///
/// `pub` (rather than `pub(crate)`) so the integration test in
/// `tests/binary.rs` and downstream node tests can both reuse it.
pub struct InMemoryBinaryStore {
    entries: std::sync::Mutex<std::collections::HashMap<String, Vec<u8>>>,
}

impl InMemoryBinaryStore {
    pub fn new() -> Self {
        Self {
            entries: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }

    pub fn insert(&self, id: impl Into<String>, bytes: Vec<u8>) {
        self.entries
            .lock()
            .expect("poisoned")
            .insert(id.into(), bytes);
    }
}

impl Default for InMemoryBinaryStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BinaryStore for InMemoryBinaryStore {
    async fn load(
        &self,
        reference: &BinaryDataRef,
        _ctx: &BinaryFetchContext,
    ) -> NodeResult<Vec<u8>> {
        let guard = self.entries.lock().expect("poisoned");
        guard
            .get(&reference.id)
            .cloned()
            .ok_or_else(|| NodeError::Other(format!("SabFiles id not found: {}", reference.id)))
    }
}

/// Process-wide default store handle. Replaced at startup by the BFF crate
/// when it wires its real implementation in.
static DEFAULT_STORE: once_cell::sync::OnceCell<Arc<dyn BinaryStore>> =
    once_cell::sync::OnceCell::new();

/// Register the process-wide binary store. Idempotent — second-and-later
/// calls are silently ignored, mirroring the credential-resolver port pattern.
pub fn set_default_binary_store(store: Arc<dyn BinaryStore>) {
    let _ = DEFAULT_STORE.set(store);
}

/// Fetch the process-wide store handle, falling back to the
/// [`UnconfiguredBinaryStore`] when no one has wired in a real one.
pub fn default_binary_store() -> Arc<dyn BinaryStore> {
    if let Some(s) = DEFAULT_STORE.get() {
        return s.clone();
    }
    let fallback: Arc<dyn BinaryStore> = Arc::new(UnconfiguredBinaryStore);
    fallback
}

impl BinaryDataRef {
    /// Lazy load via the process-wide default store. Convenience wrapper for
    /// node implementations that don't need to thread an explicit
    /// [`BinaryStore`] handle through their code.
    pub async fn load(&self, ctx: &BinaryFetchContext) -> NodeResult<Vec<u8>> {
        default_binary_store().load(self, ctx).await
    }

    /// Lazy load via an explicit store. Preferred by tests and by call
    /// sites that already hold a store handle.
    pub async fn load_with(
        &self,
        store: &dyn BinaryStore,
        ctx: &BinaryFetchContext,
    ) -> NodeResult<Vec<u8>> {
        store.load(self, ctx).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn serialises_to_n8n_wire_shape_without_base64() {
        let r = BinaryDataRef::new("sf_abc123", "image/png", "logo.png").with_size(42);
        let v = serde_json::to_value(&r).unwrap();
        assert_eq!(
            v,
            json!({
                "id": "sf_abc123",
                "mimeType": "image/png",
                "fileName": "logo.png",
                "fileSize": 42,
            })
        );
        // Critical: no base64 `data` field, no R2 URL fields.
        assert!(v.get("data").is_none(), "must never serialise inline bytes");
        assert!(v.get("url").is_none(), "must never expose raw URLs");
    }

    #[test]
    fn round_trip_through_json() {
        let r = BinaryDataRef::new("sf_x", "application/pdf", "doc.pdf")
            .with_extension("pdf")
            .with_size(9001);
        let v = serde_json::to_value(&r).unwrap();
        let back: BinaryDataRef = serde_json::from_value(v).unwrap();
        assert_eq!(r, back);
    }

    #[test]
    fn try_from_json_rejects_inline_base64() {
        // An object that still carries a `data` field is the inline-bytes
        // shape SabFlow refuses by design.
        let v = json!({
            "id": "sf_x",
            "mimeType": "image/png",
            "fileName": "x.png",
            "data": "AAAA",
        });
        assert!(BinaryDataRef::try_from_json(&v).is_none());
    }

    #[test]
    fn effective_extension_derives_from_file_name() {
        let r = BinaryDataRef::new("sf_x", "image/png", "logo.png");
        assert_eq!(r.effective_extension().as_deref(), Some("png"));

        let r = BinaryDataRef::new("sf_x", "image/png", "logo");
        assert_eq!(r.effective_extension(), None);
    }
}
