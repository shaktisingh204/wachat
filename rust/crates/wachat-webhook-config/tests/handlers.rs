//! Compile-time tests for `wachat-webhook-config`.
//!
//! These tests do not hit Mongo — that requires the integration harness
//! in `sabnode-db`. They prove three things:
//!
//! 1. The four handler functions exist with the names the slice contract
//!    promises (verified by referencing them in `assert_handlers_exported`).
//! 2. The handler signatures satisfy axum's `Handler` trait for any state
//!    `S` that exposes `MongoHandle` and `Arc<AuthConfig>` via `FromRef`.
//!    Axum performs that check at compile time inside `Router::route`,
//!    so a successful `router::<TestState>()` call **is** the proof.
//! 3. The router can actually be built end-to-end with a concrete state
//!    (`TestState`) and `with_state` returns the expected `Router<()>`.
//!
//! If anything in the public surface drifts (a handler argument type
//! changes, the router signature loses a bound, etc.) this file stops
//! compiling — which is the early-warning we want.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;
use wachat_webhook_config::{ClearResp, ListLogsQuery, ListLogsResp, ReprocessResp, router};

// ---------------------------------------------------------------------------
// Test app state — minimum viable to satisfy the router's `FromRef` bounds.
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct TestState {
    mongo: MongoHandle,
    auth: Arc<AuthConfig>,
}

impl FromRef<TestState> for MongoHandle {
    fn from_ref(s: &TestState) -> Self {
        s.mongo.clone()
    }
}

impl FromRef<TestState> for Arc<AuthConfig> {
    fn from_ref(s: &TestState) -> Self {
        s.auth.clone()
    }
}

// ---------------------------------------------------------------------------
// Surface-area assertions — these only need to compile.
// ---------------------------------------------------------------------------

/// Reference each handler by its public path so a rename breaks this
/// build, and use them in a second router with the same routes the real
/// `router()` exposes — that proves both the path strings and the
/// handler signatures stay in sync.
#[allow(dead_code)]
fn assert_handlers_exported_under_test_state() {
    let _: Router<TestState> = Router::new()
        .route(
            "/admin/logs",
            get(wachat_webhook_config::handlers::list_logs),
        )
        .route(
            "/admin/logs/{id}/payload",
            get(wachat_webhook_config::handlers::get_payload),
        )
        .route(
            "/admin/logs/{id}/reprocess",
            post(wachat_webhook_config::handlers::reprocess),
        )
        .route(
            "/admin/logs/clear",
            post(wachat_webhook_config::handlers::clear_processed),
        );
}

/// The DTO re-exports are part of the slice contract — keep them callable
/// so a deletion or rename in `lib.rs` breaks this build.
#[allow(dead_code)]
fn assert_dto_reexports_visible() {
    let _: fn(ListLogsQuery) -> Option<ListLogsResp> = |_| None;
    let _: fn() -> Option<ReprocessResp> = || None;
    let _: fn() -> Option<ClearResp> = || None;
}

// ---------------------------------------------------------------------------
// Router build test — exercises the generic bounds on real types.
// ---------------------------------------------------------------------------

/// The router builds for the test state and survives `with_state` collapse
/// to `Router<()>`. We don't actually serve traffic — connecting to Mongo
/// belongs in the integration harness — but composing the router is the
/// load-bearing thing this slice promises.
#[tokio::test]
async fn router_composes_with_test_state() {
    // We intentionally don't `connect()` — the test never issues a
    // request, so the lazy mongo client never opens a socket.
    let client = mongodb::Client::with_uri_str("mongodb://127.0.0.1:1/")
        .await
        .expect("mongo client builds with a syntactically-valid URI");
    let mongo = MongoHandle {
        client,
        db_name: "sabnode_test".to_owned(),
    };

    let auth = Arc::new(AuthConfig {
        secret: b"test-secret-not-used-in-this-test".to_vec(),
    });

    let state = TestState { mongo, auth };

    // `router::<TestState>()` must return `Router<TestState>`; once we
    // attach the state with `with_state`, axum collapses it to
    // `Router<()>`. Both sides of that assignment have to type-check or
    // the slice's public API is wrong.
    let app: Router<TestState> = router::<TestState>();
    let _final: Router<()> = app.with_state(state);
}
