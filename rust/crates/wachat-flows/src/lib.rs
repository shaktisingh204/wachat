//! `wachat-flows` — wachat-specific trigger-based flow CRUD.
//!
//! Ports the SabNode flow CRUD currently in
//! `src/app/actions/flow.actions.ts`. These are the **wachat** trigger-keyword
//! flows stored in the `flows` Mongo collection — NOT Meta Flows (those live
//! in the `meta-flows` crate).
//!
//! ```text
//! GET    /v1/flows?projectId={pid}      list summaries for a project
//! GET    /v1/flows/{id}                 full flow
//! POST   /v1/flows                      upsert (create when no `_id`)
//! DELETE /v1/flows/{id}                 delete + cleanup contacts.activeFlow
//! GET    /v1/flows/builder-data?projectId={pid}  list + initial flow combo
//! ```
//!
//! Project access is owner-or-agent (mirrors the TS `getProjectById`).
//! Cycle detection runs on the supplied (`nodes`, `edges`) BEFORE any write.

pub mod cycle;
pub mod dto;
pub mod handlers;
pub mod state;
pub mod store;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatFlowsState;

/// Mount the router at `/v1/flows` from the API binary.
///
/// ```ignore
/// .nest("/v1/flows", wachat_flows::router::<AppState>())
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFlowsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_flows).post(handlers::save_flow))
        .route("/builder-data", get(handlers::builder_data))
        // Literal bulk-op segments MUST precede the `/{id}` param routes so
        // axum 0.8 doesn't capture `bulk-delete` / `bulk-status` as an `:id`.
        .route("/bulk-delete", delete(handlers::bulk_delete))
        .route("/bulk-status", patch(handlers::bulk_status))
        .route(
            "/{id}",
            get(handlers::get_flow).delete(handlers::delete_flow),
        )
        .route("/{id}/clone", post(handlers::clone_flow))
}
