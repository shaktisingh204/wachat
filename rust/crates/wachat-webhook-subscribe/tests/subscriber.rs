//! Integration tests for `WebhookSubscriber` against a `wiremock` mock
//! of `graph.facebook.com`.
//!
//! These tests cover the two Meta-facing methods (`status` and
//! `subscribe_one`). `subscribe_all` additionally requires a live Mongo
//! instance and is exercised in the consuming router crate's
//! testcontainers suite (out of scope here per the slice contract).

use serde_json::json;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;
use wachat_webhook_subscribe::WebhookSubscriber;

const VERSION: &str = "v23.0";
const WABA: &str = "1122334455";
const APP_ID: &str = "999888777";
const TOKEN: &str = "EAAtoken";

// `WebhookSubscriber::new` requires a `MongoHandle` even though `status`
// and `subscribe_one` never touch Mongo. We build one with a bogus URI
// — `MongoHandle::connect` only parses + validates the URI, it doesn't
// dial the server, so this stays in-memory.
async fn dummy_mongo() -> MongoHandle {
    MongoHandle::connect("mongodb://127.0.0.1:1/", "wachat_test")
        .await
        .expect("dummy MongoHandle should construct (no server contact)")
}

fn meta_for(server: &MockServer) -> MetaClient {
    let base = url::Url::parse(&format!("{}/", server.uri().trim_end_matches('/'))).unwrap();
    MetaClient::with_base(base, VERSION)
}

#[tokio::test]
async fn status_returns_active_when_data_non_empty() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path(format!("/{VERSION}/{WABA}/subscribed_apps")))
        .and(header("authorization", format!("Bearer {TOKEN}")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": [
                { "whatsapp_business_api_data": { "id": "999888777", "name": "SabNode" } }
            ]
        })))
        .mount(&server)
        .await;

    let sub = WebhookSubscriber::new(dummy_mongo().await, meta_for(&server));
    let status = sub.status(WABA, TOKEN).await.expect("status ok");
    assert!(status.is_active);
}

#[tokio::test]
async fn status_returns_inactive_when_data_empty() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path(format!("/{VERSION}/{WABA}/subscribed_apps")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "data": [] })))
        .mount(&server)
        .await;

    let sub = WebhookSubscriber::new(dummy_mongo().await, meta_for(&server));
    let status = sub.status(WABA, TOKEN).await.expect("status ok");
    assert!(!status.is_active);
}

#[tokio::test]
async fn status_rejects_empty_args_without_calling_meta() {
    // No mock — if we hit Meta this test would fail with a 404.
    let server = MockServer::start().await;
    let sub = WebhookSubscriber::new(dummy_mongo().await, meta_for(&server));

    let err = sub.status("", TOKEN).await.unwrap_err();
    assert!(
        matches!(err, ApiError::BadRequest(_)),
        "expected BadRequest, got {err:?}"
    );

    let err = sub.status(WABA, "").await.unwrap_err();
    assert!(
        matches!(err, ApiError::BadRequest(_)),
        "expected BadRequest, got {err:?}"
    );
}

#[tokio::test]
async fn subscribe_one_posts_to_subscribed_apps() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(format!("/{VERSION}/{WABA}/subscribed_apps")))
        .and(header("authorization", format!("Bearer {TOKEN}")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "success": true })))
        .mount(&server)
        .await;

    let sub = WebhookSubscriber::new(dummy_mongo().await, meta_for(&server));
    sub.subscribe_one(WABA, APP_ID, TOKEN)
        .await
        .expect("subscribe_one ok");
}

#[tokio::test]
async fn subscribe_one_surfaces_meta_4xx_as_api_error() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(format!("/{VERSION}/{WABA}/subscribed_apps")))
        .respond_with(ResponseTemplate::new(400).set_body_json(json!({
            "error": {
                "message": "Invalid OAuth access token",
                "type": "OAuthException",
                "code": 190,
                "fbtrace_id": "trace-123"
            }
        })))
        .mount(&server)
        .await;

    let sub = WebhookSubscriber::new(dummy_mongo().await, meta_for(&server));
    let err = sub.subscribe_one(WABA, APP_ID, TOKEN).await.unwrap_err();
    // 400 from Meta is mapped through `MetaError -> ApiError` in
    // `wachat-meta-client`. "Invalid …" is heuristically classified as
    // a `Validation` error there; either Validation or BadRequest is
    // acceptable — what matters is we did not silently swallow it.
    assert!(
        matches!(err, ApiError::Validation(_) | ApiError::BadRequest(_)),
        "expected Validation/BadRequest, got {err:?}"
    );
}

#[tokio::test]
async fn subscribe_one_rejects_empty_args() {
    let server = MockServer::start().await;
    let sub = WebhookSubscriber::new(dummy_mongo().await, meta_for(&server));

    assert!(matches!(
        sub.subscribe_one("", APP_ID, TOKEN).await.unwrap_err(),
        ApiError::BadRequest(_)
    ));
    assert!(matches!(
        sub.subscribe_one(WABA, "", TOKEN).await.unwrap_err(),
        ApiError::BadRequest(_)
    ));
    assert!(matches!(
        sub.subscribe_one(WABA, APP_ID, "").await.unwrap_err(),
        ApiError::Unauthorized(_)
    ));
}
