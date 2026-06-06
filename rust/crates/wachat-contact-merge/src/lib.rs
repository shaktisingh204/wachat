//! # wachat-contact-merge
//!
//! Axum router for the `/wachat/contact-merge` page: field-level merge of
//! two WhatsApp contacts. Mounted under `/v1/wachat/contact-merge`:
//!
//! ```ignore
//! .nest("/v1/wachat/contact-merge", wachat_contact_merge::router::<AppState>())
//! ```
//!
//! A single destructive endpoint: `POST /` folds the `secondaryId` contact
//! into the `primaryId` contact (union of non-null fields, primary wins),
//! re-points every `incoming_messages` / `outgoing_messages` FK from the
//! secondary to the primary, drops the secondary's stale `conversations`
//! rows, then deletes the secondary contact. The whole operation is gated
//! by the owner-or-agent project guard (mirrors `wachat-contacts`) and
//! scoped to a single project.
//!
//! Generic over the caller's state `S`; needs a [`WachatContactMergeState`]
//! and the JWT verifier config, both pulled via
//! [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;

pub use state::WachatContactMergeState;

/// Build the contact-merge router (caller nests under `/v1/wachat/contact-merge`).
///
/// ```text
/// POST /   — merge_contacts
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatContactMergeState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/", post(handlers::merge_contacts))
}
