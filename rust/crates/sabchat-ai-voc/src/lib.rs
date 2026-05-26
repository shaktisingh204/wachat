//! # sabchat-ai-voc
//!
//! Phase — axum router that adds **voice-of-customer** clustering on top
//! of the SabChat message log. Mounted under `/v1/sabchat/ai/voc` from
//! the orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/ai/voc",
//!     sabchat_ai_voc::router::<AppState>(),
//! )
//! ```
//!
//! ## Scope
//!
//! Five endpoints — one mutating "kick off a clustering run" and four
//! read-only views over the resulting topics + run history.
//!
//! | HTTP                                     | Handler                          |
//! |------------------------------------------|----------------------------------|
//! | `POST /run`                              | [`handlers::run_voc`]            |
//! | `GET  /runs`                             | [`handlers::list_runs`]          |
//! | `GET  /runs/{id}`                        | [`handlers::get_run`]            |
//! | `GET  /topics`                           | [`handlers::list_topics`]        |
//! | `GET  /topics/{id}/messages`             | [`handlers::list_topic_messages`]|
//!
//! ### `POST /run`
//!
//! Loads visitor (`senderType == "visitor"`) text messages for the
//! caller's tenant since `body.since` (default: last 7 days), runs the
//! configured [`Clusterer`](cluster::Clusterer) over their text, and
//! **replaces** the tenant's `sabchat_voc_topics` collection rows with
//! the new cluster set. The run itself is logged in `sabchat_voc_runs`
//! with status transitions `running → done | failed`.
//!
//! ### `GET /runs` / `GET /runs/{id}`
//!
//! Tenant-scoped run history. `limit` defaults to 20 and is capped at
//! 100. The detail endpoint 404s for cross-tenant ids.
//!
//! ### `GET /topics`
//!
//! Current topic set sorted by `messageCount DESC` (highest signal
//! first). `limit` defaults to 50, capped at 200.
//!
//! ### `GET /topics/{id}/messages`
//!
//! Best-effort sampling: looks up the topic's label, derives a case-
//! insensitive regex from it, and returns the most recent matching
//! visitor messages within the tenant. Useful for "show me a few real
//! quotes behind this cluster" affordances in the UI.
//!
//! ## Storage shape
//!
//! ```text
//! sabchat_voc_topics = {
//!   _id, tenantId, label, examples: [string], messageCount,
//!   lastSeenAt, sentimentSkew, computedAt
//! }
//!
//! sabchat_voc_runs = {
//!   _id, tenantId, startedAt, completedAt?, status: "running"|"done"|"failed",
//!   messageCount, topicCount, error?, createdAt
//! }
//! ```
//!
//! ## Clusterer
//!
//! The HTTP layer is decoupled from the algorithm via the
//! [`Clusterer`](cluster::Clusterer) trait. The default
//! [`StubClusterer`](cluster::StubClusterer) ships a keyword-bucket
//! implementation (refund / billing / shipping / bug / feature /
//! pricing / other) so the slice is self-contained; an embedding-backed
//! implementation can swap in via
//! [`make_clusterer_from_env`](cluster::make_clusterer_from_env)
//! without touching handlers.
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. Reads + writes scope by
//! `tenantId == auth.tenant_id` — cross-tenant ids look indistinguishable
//! from "not found" to the caller, matching the SabChat convention.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`SabChatAiVocState`] bundle (Mongo handle + clusterer), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod cluster;
pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use cluster::{Cluster, Clusterer, StubClusterer, make_clusterer_from_env};
pub use state::SabChatAiVocState;

/// Build the SabChat AI voice-of-customer router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/ai/voc`):
///
/// ```text
/// POST /run                       — kick off a clustering run
/// GET  /runs                      — list recent runs
/// GET  /runs/{id}                 — fetch one run
/// GET  /topics                    — current top topics
/// GET  /topics/{id}/messages      — sample messages behind a topic
/// ```
///
/// **Route ordering note:** the literal `/runs` and `/topics` collection
/// roots are registered first so axum's matcher prefers them over the
/// parameterised siblings.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAiVocState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/run", post(handlers::run_voc))
        .route("/runs", get(handlers::list_runs))
        .route("/runs/{id}", get(handlers::get_run))
        .route("/topics", get(handlers::list_topics))
        .route("/topics/{id}/messages", get(handlers::list_topic_messages))
}
