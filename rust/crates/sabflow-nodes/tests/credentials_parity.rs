//! Integration test — `CredentialsMock` parity with the n8n
//! `getCredentials()` contract.
//!
//! ## What this test proves
//!
//! 1. A `CredentialsMock` builder produces envelope-encrypted records
//!    whose **wire shape** matches the TS
//!    `executor/credentials/crypto.ts` layout
//!    (`iv (12) ‖ ct (n) ‖ tag (16) ‖ wrappedDek (60)`).
//! 2. The mock store flattens those records into the same
//!    `HashMap<String, Credential>` shape that
//!    `ExecutionContext::with_credentials` consumes in production.
//! 3. A node that reads `httpBasicAuth` via `ctx.credential(...)` and
//!    sends an HTTP request behaves **identically** to n8n's
//!    `HttpRequest` V3: it emits an `Authorization: Basic <b64(user:pw)>`
//!    header, exactly as the wiremock server captures.
//!
//! ## Why a fake HTTP node?
//!
//! The bundled `HttpRequestNode` reads `username`/`password` from
//! `params` (n8n V3 inline auth), not from `ctx.credential()`. To
//! exercise the credential-injection seam itself, this test ships a
//! tiny `FakeBasicAuthHttpNode` that hits the same `reqwest` client
//! and the same `ctx.credential()` lookup the production runtime uses.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use base64::Engine;
use serde_json::{json, Value};
use wiremock::matchers::{header, method as wm_method, path as wm_path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use sabflow_nodes::{
    test_support::CredentialsMock, CredentialBinding, ExecutionContext, NodeCategory, NodeDescriptor,
    NodeError, NodeProperty, NodePropertyType, NodeResult,
};
// Re-exported via `lib.rs`.
use sabflow_nodes::{Credential, Node, NodeInput, NodeOutput};

/// A fake `httpBasicAuth`-consuming node. Production nodes that use
/// credentials (e.g. `slack`, `gitlab`, `hubspot`) follow the same
/// shape: read `credentialId` from params, look the credential up on
/// the context, pull the typed fields, and apply them to the
/// `reqwest::RequestBuilder`.
struct FakeBasicAuthHttpNode;

#[async_trait]
impl Node for FakeBasicAuthHttpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "fakeBasicAuthHttp",
            "Fake Basic-Auth HTTP",
            "test-only node that exercises ctx.credential(httpBasicAuth)",
            NodeCategory::Action,
        )
        .credentials(vec![CredentialBinding {
            name: "httpBasicAuth".to_string(),
            display_name: "HTTP Basic Auth".to_string(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("url", "URL", NodePropertyType::String).required(),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred: &Credential = ctx.credential(&cred_id)?;

        // n8n parity: `httpBasicAuth` exposes `user` and `password`
        // fields. The same names the TS importer maps from
        // `credentials.json`.
        let user = cred
            .data
            .get("user")
            .ok_or_else(|| NodeError::MissingParameter("user".into()))?
            .clone();
        let password = cred.data.get("password").cloned();

        let url = ctx.param_str(params, "url")?;
        let res = ctx
            .http
            .get(&url)
            .basic_auth(user, password)
            .send()
            .await?;

        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        Ok(NodeOutput::single(vec![json!({
            "statusCode": status,
            "body": body,
        })]))
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn basic_auth_credential_drives_authorization_header() {
    // 1. Build the mock store.
    let store = CredentialsMock::new()
        .with_credential_id(
            "basic-cred-1",
            "httpBasicAuth",
            "Test Basic",
            json!({ "user": "alice", "password": "x" }),
        )
        .build();
    assert_eq!(store.len(), 1, "exactly one credential in the mock store");

    // Sanity: the record exposes plaintext for assertions.
    let rec = store.get_by_id("basic-cred-1").expect("record");
    assert_eq!(rec.credential_type, "httpBasicAuth");
    assert_eq!(rec.plaintext(), &json!({ "user": "alice", "password": "x" }));
    assert_eq!(rec.envelope.kek_id, "test");

    // Wire-format check: the persisted envelope round-trips through
    // the test KEK. Mirrors what `decryptCredential` in TS does.
    let kek: [u8; 32] = *b"sabflow-test-kek-32-bytes!!!!!!!";
    let decoded = rec
        .envelope
        .decrypt(&kek)
        .expect("envelope round-trip under default test KEK");
    assert_eq!(decoded, json!({ "user": "alice", "password": "x" }));

    // 2. Spin up the mock HTTP server with the expected
    //    Authorization header.
    let server = MockServer::start().await;
    let expected_b64 = base64::engine::general_purpose::STANDARD.encode("alice:x");
    let expected_header = format!("Basic {expected_b64}");
    Mock::given(wm_method("GET"))
        .and(wm_path("/whoami"))
        .and(header("authorization", expected_header.as_str()))
        .respond_with(ResponseTemplate::new(200).set_body_string("ok"))
        .expect(1)
        .mount(&server)
        .await;

    // 3. Build the execution context using the mock-flattened
    //    credentials — exactly how production wires them in.
    let creds: HashMap<String, Credential> = store.into_node_credentials();
    let http = Arc::new(reqwest::Client::builder().build().expect("reqwest"));
    let mut ctx = ExecutionContext::new("exec-test".to_string(), http).with_credentials(creds);

    // 4. Run the node.
    let node = FakeBasicAuthHttpNode;
    let params = json!({
        "credentialId": "basic-cred-1",
        "url": format!("{}/whoami", server.uri()),
    });
    let out = node
        .execute(&mut ctx, NodeInput::empty(), &params)
        .await
        .expect("node execution");

    // 5. Assertions.
    assert_eq!(out.branches.len(), 1);
    let items = &out.branches[0].items;
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].get("statusCode").and_then(|v| v.as_u64()), Some(200));
    assert_eq!(items[0].get("body").and_then(|v| v.as_str()), Some("ok"));

    // The wiremock `.expect(1)` above panics on drop if it didn't see
    // exactly one matching request, so reaching here proves the
    // `Authorization: Basic YWxpY2U6eA==` header was emitted.
    drop(server);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn missing_credential_id_surfaces_typed_error() {
    // No credentials wired in.
    let http = Arc::new(reqwest::Client::builder().build().expect("reqwest"));
    let mut ctx = ExecutionContext::new("exec-missing".to_string(), http);

    let node = FakeBasicAuthHttpNode;
    let params = json!({
        "credentialId": "does-not-exist",
        "url": "http://127.0.0.1:1/whoami", // unreachable; we never get here.
    });
    let err = node
        .execute(&mut ctx, NodeInput::empty(), &params)
        .await
        .expect_err("must reject when credential is absent");
    assert!(
        matches!(err, NodeError::MissingCredential(ref id) if id == "does-not-exist"),
        "expected MissingCredential, got {err:?}",
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn default_credential_lookup_returns_first_of_type() {
    // First-inserted credential of each type wins the "default" slot —
    // production parity (n8n `isDefault`).
    let store = CredentialsMock::new()
        .with_credential(
            "httpBasicAuth",
            "First",
            json!({ "user": "first", "password": "1" }),
        )
        .with_credential(
            "httpBasicAuth",
            "Second",
            json!({ "user": "second", "password": "2" }),
        )
        .build();

    let default = store
        .get_default("httpBasicAuth")
        .expect("default httpBasicAuth must resolve");
    assert_eq!(default.name, "First");
    assert_eq!(default.id, "cred_0");
    assert_eq!(default.plaintext().get("user").and_then(|v| v.as_str()), Some("first"));
}
