//! # sabchat-reports
//!
//! Read-only analytics router for the SabChat module. Drives the live
//! queue widget, the conversation-volume timeline, the response-time
//! percentile chart, the per-agent / per-inbox / per-channel breakdowns,
//! and the CSAT roll-up.
//!
//! Mounted under `/v1/sabchat/reports` from the orchestrating `api`
//! crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/reports", sabchat_reports::router::<AppState>())
//! ```
//!
//! ## HTTP surface
//!
//! | Method | Path                                                   | Handler                |
//! |--------|--------------------------------------------------------|------------------------|
//! | GET    | `/live`                                                | [`handlers::live`]     |
//! | GET    | `/volume?from=&to=&groupBy=hour\|day\|week`            | [`handlers::volume`]   |
//! | GET    | `/response-times?from=&to=`                            | [`handlers::response_times`] |
//! | GET    | `/by-agent?from=&to=`                                  | [`handlers::by_agent`] |
//! | GET    | `/by-inbox?from=&to=`                                  | [`handlers::by_inbox`] |
//! | GET    | `/by-channel?from=&to=`                                | [`handlers::by_channel`] |
//! | GET    | `/csat?from=&to=`                                      | [`handlers::csat`]     |
//!
//! ## Tenancy
//!
//! Every read filters on `tenantId == ObjectId(auth.tenant_id)`. The
//! tenant id is taken from the JWT — there is no cross-tenant report
//! query. A malformed `tid` claim is treated as `401 Unauthorized`
//! (matches the sabchat-audit convention).
//!
//! ## Window defaults
//!
//! When `from` / `to` are omitted the window defaults to the last
//! **7 days** ending at "now". Buckets in `/volume` are capped at 500
//! per response so a misconfigured `groupBy=hour` over a year-long
//! window cannot blow the response size.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatReportsState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub(crate) mod pipelines;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;

pub use state::SabChatReportsState;

// ---------------------------------------------------------------------------
// Collection names — kept in one place so the handlers and the
// pipelines builder agree on the wire-level identifiers without any
// stringly-typed drift.
// ---------------------------------------------------------------------------

/// `sabchat_conversations` — primary fact table for volume + response
/// time + status reports.
pub(crate) const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// `sabchat_messages` — driven for message-count buckets in `/volume`.
pub(crate) const MESSAGES_COLL: &str = "sabchat_messages";

/// `sabchat_assignments` — audit trail used by `/by-agent` to compute
/// "conversations handled" (a single conversation may pass through
/// multiple agents in its lifetime).
pub(crate) const ASSIGNMENTS_COLL: &str = "sabchat_assignments";

/// `sabchat_inboxes` — joined into `/by-inbox` to attach the inbox
/// `name` + `channelType` to the aggregation result.
pub(crate) const INBOXES_COLL: &str = "sabchat_inboxes";

/// Build the SabChat reports router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/reports`):
///
/// ```text
/// GET /live              — live queue snapshot (open / pending / snoozed / SLA / queue-by-inbox)
/// GET /volume            — conversation + message buckets over the window
/// GET /response-times    — mean / p50 / p95 / p99 of first-response latency
/// GET /by-agent          — per-agent breakdown
/// GET /by-inbox          — per-inbox breakdown (with name + channelType)
/// GET /by-channel        — channelType roll-up of `by-inbox`
/// GET /csat              — count / mean / distribution of CSAT scores
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatReportsState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatReportsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/live", get(handlers::live))
        .route("/volume", get(handlers::volume))
        .route("/response-times", get(handlers::response_times))
        .route("/by-agent", get(handlers::by_agent))
        .route("/by-inbox", get(handlers::by_inbox))
        .route("/by-channel", get(handlers::by_channel))
        .route("/csat", get(handlers::csat))
}
