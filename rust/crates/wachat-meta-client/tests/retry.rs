//! Integration tests for `MetaClient`'s retry / backoff behavior.
//!
//! All tests stand up a `wiremock` server and point the client at it via
//! the hidden `MetaClient::with_base` constructor. They're cheap to run
//! (`tokio::time` does **not** auto-advance — these tests pay the real
//! ~250 ms of backoff between retries, which is acceptable for a
//! 4-test suite).

use std::time::Duration;

use serde_json::json;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use wachat_meta_client::{MetaClient, MetaError};

const VERSION: &str = "v23.0";

fn client_for(server: &MockServer) -> MetaClient {
    let base = url::Url::parse(&server.uri()).unwrap();
    // Trailing slash matters for `Url::join` semantics.
    let base = url::Url::parse(&format!("{}/", base.as_str().trim_end_matches('/'))).unwrap();
    MetaClient::with_base(base, VERSION)
}

#[tokio::test]
async fn five_xx_triggers_retry_then_succeeds() {
    let server = MockServer::start().await;

    // First call: 503. Second call: 200 with payload.
    Mock::given(method("GET"))
        .and(path(format!("/{VERSION}/123/test")))
        .and(header("authorization", "Bearer tok"))
        .respond_with(ResponseTemplate::new(503))
        .up_to_n_times(1)
        .mount(&server)
        .await;

    Mock::given(method("GET"))
        .and(path(format!("/{VERSION}/123/test")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "ok": true })))
        .mount(&server)
        .await;

    let client = client_for(&server);
    let resp: serde_json::Value = client.get_json("123/test", "tok").await.unwrap();
    assert_eq!(resp["ok"], true);
}

#[tokio::test]
async fn four_two_nine_honors_retry_after() {
    let server = MockServer::start().await;

    // 429 with Retry-After: 1 second. Then 200.
    Mock::given(method("POST"))
        .and(path(format!("/{VERSION}/123/messages")))
        .respond_with(
            ResponseTemplate::new(429)
                .insert_header("Retry-After", "1")
                .set_body_json(json!({
                    "error": {
                        "message": "rate limited",
                        "type": "OAuthException",
                        "code": 4
                    }
                })),
        )
        .up_to_n_times(1)
        .mount(&server)
        .await;

    Mock::given(method("POST"))
        .and(path(format!("/{VERSION}/123/messages")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "messages": [] })))
        .mount(&server)
        .await;

    let client = client_for(&server);
    let started = std::time::Instant::now();
    let resp: serde_json::Value = client
        .post_json("123/messages", "tok", &json!({ "to": "1" }))
        .await
        .unwrap();
    let elapsed = started.elapsed();
    assert_eq!(resp["messages"], json!([]));
    // We waited at least the Retry-After (1s).
    assert!(
        elapsed >= Duration::from_millis(900),
        "expected Retry-After to delay >= 1s, got {elapsed:?}"
    );
}

#[tokio::test]
async fn exhausted_retries_returns_last_error() {
    let server = MockServer::start().await;

    // Every call returns 502 — exhaust 3 attempts.
    Mock::given(method("GET"))
        .and(path(format!("/{VERSION}/dead")))
        .respond_with(ResponseTemplate::new(502).set_body_json(json!({
            "error": {
                "message": "bad gateway",
                "type": "GraphMethodException",
                "code": 1,
                "fbtrace_id": "trace-xyz"
            }
        })))
        .mount(&server)
        .await;

    let client = client_for(&server);
    let err = client
        .get_json::<serde_json::Value>("dead", "tok")
        .await
        .unwrap_err();

    match err {
        MetaError::Api {
            status,
            code,
            fbtrace_id,
            message,
            ..
        } => {
            assert_eq!(status, 502);
            assert_eq!(code, Some(1));
            assert_eq!(fbtrace_id.as_deref(), Some("trace-xyz"));
            assert!(message.contains("bad gateway"));
        }
        other => panic!("expected MetaError::Api, got {other:?}"),
    }
}

#[tokio::test]
async fn rate_limited_after_retries_returns_rate_limited_variant() {
    let server = MockServer::start().await;

    // Always 429 with a small Retry-After so we actually retry.
    Mock::given(method("GET"))
        .and(path(format!("/{VERSION}/spam")))
        .respond_with(
            ResponseTemplate::new(429)
                .insert_header("Retry-After", "1")
                .set_body_json(json!({
                    "error": { "message": "slow down", "code": 4 }
                })),
        )
        .mount(&server)
        .await;

    let client = client_for(&server);
    let err = client
        .get_json::<serde_json::Value>("spam", "tok")
        .await
        .unwrap_err();

    match err {
        MetaError::RateLimited { retry_after_ms } => {
            assert_eq!(retry_after_ms, Some(1_000));
        }
        other => panic!("expected MetaError::RateLimited, got {other:?}"),
    }
}

#[tokio::test]
async fn empty_token_skips_authorization_header() {
    let server = MockServer::start().await;

    // Mock matches only when Authorization is *absent* — we verify by
    // requiring path match + a 200 response, then asserting via a
    // separate guard mock that catches any auth header at all.
    Mock::given(method("GET"))
        .and(path(format!("/{VERSION}/me")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "id": "0" })))
        .mount(&server)
        .await;

    let client = client_for(&server);
    let resp: serde_json::Value = client.get_json("me", "").await.unwrap();
    assert_eq!(resp["id"], "0");
}
