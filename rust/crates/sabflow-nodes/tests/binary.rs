//! Integration tests for `sabflow_nodes::binary`.
//!
//! Exercises the [`BinaryDataRef`] / [`BinaryStore`] contract with a
//! **mocked** SabFiles BFF — no real HTTP, no real R2 traffic, no raw URLs
//! anywhere in the surface (see `CLAUDE.md` SabFiles policy).

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use async_trait::async_trait;
use serde_json::json;

use sabflow_nodes::NodeError;
use sabflow_nodes::binary::{
    BinaryDataRef, BinaryFetchContext, BinaryStore, InMemoryBinaryStore, UnconfiguredBinaryStore,
};

/// Mocked BFF that records every call and serves canned payloads.
///
/// We use `Arc<MockBff>` so the test can both `inject` payloads and read
/// the call log after the load happens.
struct MockBff {
    calls: AtomicUsize,
    inner: InMemoryBinaryStore,
    /// Workspace the BFF will accept. Anything else 401s — proves the
    /// fetch context is actually plumbed through.
    expected_workspace: String,
}

impl MockBff {
    fn new(expected_workspace: impl Into<String>) -> Self {
        Self {
            calls: AtomicUsize::new(0),
            inner: InMemoryBinaryStore::new(),
            expected_workspace: expected_workspace.into(),
        }
    }

    fn calls(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl BinaryStore for MockBff {
    async fn load(
        &self,
        reference: &BinaryDataRef,
        ctx: &BinaryFetchContext,
    ) -> Result<Vec<u8>, NodeError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if ctx.workspace_id != self.expected_workspace {
            return Err(NodeError::AuthError(format!(
                "workspace mismatch: expected {}, got {}",
                self.expected_workspace, ctx.workspace_id
            )));
        }
        self.inner.load(reference, ctx).await
    }
}

#[tokio::test]
async fn unconfigured_store_returns_not_implemented() {
    // Before any BFF wires itself in, `load_with(UnconfiguredBinaryStore)`
    // must refuse — preventing accidental "silent zero bytes" bugs.
    let store = UnconfiguredBinaryStore;
    let r = BinaryDataRef::new("sf_anything", "image/png", "x.png");
    let ctx = BinaryFetchContext::new("ws_1", "exec_1");

    let err = r.load_with(&store, &ctx).await.unwrap_err();
    match err {
        NodeError::NotImplemented(msg) => {
            assert!(msg.contains("SabFiles"));
            assert!(msg.contains("sf_anything"));
        }
        other => panic!("expected NotImplemented, got {other:?}"),
    }
}

#[tokio::test]
async fn mocked_bff_serves_bytes_for_workspace_owner() {
    let bff = Arc::new(MockBff::new("ws_42"));
    bff.inner.insert("sf_logo", b"PNG-bytes".to_vec());

    let r = BinaryDataRef::new("sf_logo", "image/png", "logo.png").with_size(9);
    let ctx = BinaryFetchContext::new("ws_42", "exec_x").with_node_id("node_1");

    let bytes = r.load_with(&*bff, &ctx).await.expect("load succeeds");
    assert_eq!(bytes, b"PNG-bytes");
    assert_eq!(bff.calls(), 1);
}

#[tokio::test]
async fn mocked_bff_rejects_cross_workspace_reads() {
    let bff = MockBff::new("ws_owner");
    bff.inner.insert("sf_secret", b"top-secret".to_vec());

    let r = BinaryDataRef::new("sf_secret", "application/pdf", "secret.pdf");
    let ctx = BinaryFetchContext::new("ws_attacker", "exec_x");

    let err = r.load_with(&bff, &ctx).await.unwrap_err();
    match err {
        NodeError::AuthError(msg) => {
            assert!(msg.contains("workspace mismatch"));
        }
        other => panic!("expected AuthError, got {other:?}"),
    }
}

#[tokio::test]
async fn json_wire_shape_never_contains_inline_bytes_or_urls() {
    // This is the load-bearing invariant from `CLAUDE.md`: serialised refs
    // must never leak base64 payloads or raw R2 URLs into queues, audit
    // logs, or saved execution state.
    let r = BinaryDataRef::new("sf_a", "video/mp4", "clip.mp4")
        .with_extension("mp4")
        .with_size(1_048_576);

    let v = serde_json::to_value(&r).unwrap();
    let obj = v.as_object().unwrap();

    // Allowed n8n-parity keys only.
    let allowed: std::collections::HashSet<&str> =
        ["id", "mimeType", "fileName", "fileExtension", "fileSize"]
            .into_iter()
            .collect();
    for key in obj.keys() {
        assert!(
            allowed.contains(key.as_str()),
            "unexpected wire-shape key: {key}"
        );
    }

    // Forbidden keys — these would re-introduce inline bytes or raw URLs.
    for forbidden in ["data", "url", "downloadUrl", "presignedUrl", "r2Url"] {
        assert!(obj.get(forbidden).is_none(), "must not expose {forbidden}");
    }
}

#[tokio::test]
async fn try_from_json_recognises_filesystem_mode_shape() {
    let v = json!({
        "id": "sf_xyz",
        "mimeType": "text/plain",
        "fileName": "notes.txt",
    });
    let r = BinaryDataRef::try_from_json(&v).expect("recognised as binary ref");
    assert_eq!(r.id, "sf_xyz");
    assert_eq!(r.mime_type, "text/plain");
    assert_eq!(r.file_name, "notes.txt");
}

#[tokio::test]
async fn try_from_json_returns_none_for_regular_json_payloads() {
    // Items in n8n look like `{ json: {...} }` — refs must not match
    // arbitrary objects or we'd treat ordinary data as binary blobs.
    let v = json!({ "foo": 1, "bar": "baz" });
    assert!(BinaryDataRef::try_from_json(&v).is_none());

    let v = json!({ "id": "x" }); // missing mimeType
    assert!(BinaryDataRef::try_from_json(&v).is_none());
}

#[tokio::test]
async fn lazy_load_only_calls_the_store_when_invoked() {
    let bff = Arc::new(MockBff::new("ws_lazy"));
    bff.inner.insert("sf_big", vec![0u8; 4096]);
    let r = BinaryDataRef::new("sf_big", "application/octet-stream", "big.bin");

    // Serialising / cloning / json-converting the ref must not touch the
    // BFF — that's the whole point of the lazy contract.
    let _v = r.to_json();
    let _c = r.clone();
    assert_eq!(bff.calls(), 0);

    let ctx = BinaryFetchContext::new("ws_lazy", "exec_z");
    let bytes = r.load_with(&*bff, &ctx).await.unwrap();
    assert_eq!(bytes.len(), 4096);
    assert_eq!(bff.calls(), 1);
}

#[tokio::test]
async fn display_uses_sabfiles_prefix_not_raw_url() {
    let r = BinaryDataRef::new("sf_a", "image/png", "x.png");
    let s = format!("{}", r);
    assert!(s.starts_with("sabfiles:"));
    assert!(!s.contains("http://"));
    assert!(!s.contains("https://"));
    assert!(!s.contains("r2.cloudflarestorage"));
}
