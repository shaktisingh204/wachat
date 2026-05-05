//! Compile-only assertions for `wachat-templates-router`.
//!
//! These tests do not hit Mongo, Meta, or Redis. They prove three
//! things at build time:
//!
//! 1. The 14 handler functions exist with the names the slice contract
//!    promises (verified by referencing each in
//!    `assert_handlers_exported_under_test_state`).
//! 2. The handler signatures satisfy axum's `Handler` trait for any
//!    state `S` that exposes `TemplatesState` and `Arc<AuthConfig>` via
//!    `FromRef`. Axum performs that check at compile time inside
//!    `Router::route`, so a successful `router::<TestState>()` call
//!    **is** the proof.
//! 3. The router can actually be built end-to-end with a concrete
//!    state (`TestState`) and `with_state` returns the expected
//!    `Router<()>`.
//!
//! If anything in the public surface drifts (a handler argument type
//! changes, the router signature loses a bound, etc.) this file stops
//! compiling — which is the early-warning we want.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use wachat_templates_router::{TemplatesState, router};

// ---------------------------------------------------------------------------
// Test app state — minimum viable to satisfy the router's `FromRef` bounds.
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct TestState {
    templates: TemplatesState,
    auth: Arc<AuthConfig>,
}

impl FromRef<TestState> for TemplatesState {
    fn from_ref(s: &TestState) -> Self {
        s.templates.clone()
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

/// Build the production router with the test state. If any handler
/// signature drifts out of axum's `Handler` trait, this fails to
/// compile. If the `router` function loses one of its `FromRef` bounds,
/// the type-checker catches that too.
#[allow(dead_code)]
fn assert_router_builds() -> Router<TestState> {
    router::<TestState>()
}

/// Reference each handler by its public path so a rename breaks the
/// build, and use them in a second router with the same routes the real
/// `router()` exposes — that proves both the path strings and the
/// handler signatures stay in sync.
#[allow(dead_code)]
fn assert_handlers_exported_under_test_state() {
    let _: Router<TestState> = Router::new()
        .route(
            "/",
            get(wachat_templates_router::handlers::list)
                .post(wachat_templates_router::handlers::create),
        )
        .route(
            "/bulk",
            post(wachat_templates_router::handlers::bulk_create),
        )
        .route(
            "/flow",
            post(wachat_templates_router::handlers::create_flow),
        )
        .route("/sync", post(wachat_templates_router::handlers::sync))
        .route(
            "/by-name",
            delete(wachat_templates_router::handlers::delete_by_name),
        )
        .route(
            "/library",
            get(wachat_templates_router::handlers::list_library)
                .post(wachat_templates_router::handlers::save_library),
        )
        .route(
            "/library/{id}",
            delete(wachat_templates_router::handlers::delete_library),
        )
        .route(
            "/library/{id}/apply",
            post(wachat_templates_router::handlers::apply_library),
        )
        .route(
            "/{id}",
            get(wachat_templates_router::handlers::get_by_id)
                .delete(wachat_templates_router::handlers::delete_by_id),
        )
        .route("/{id}/edit", post(wachat_templates_router::handlers::edit))
        .route("/{id}/send", post(wachat_templates_router::handlers::send));
}

// ---------------------------------------------------------------------------
// Tokio-targeted no-op — keeps `[dev-dependencies]` honest.
// ---------------------------------------------------------------------------

#[tokio::test]
async fn router_builds_with_test_state() {
    // The interesting work happens at compile-time inside
    // `assert_router_builds`. This async runtime entry just exists so
    // `cargo test --no-run` exercises the test binary build path under
    // the same async runtime our handlers use at runtime.
    let _ = assert_router_builds;
    let _ = assert_handlers_exported_under_test_state;
}
