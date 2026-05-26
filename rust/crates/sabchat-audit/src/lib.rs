//! # sabchat-audit
//!
//! Append-only audit log for the SabChat module. Owns two HTTP routes
//! (list + get-by-id) and one library helper (`record(...)`).
//!
//! Mounted under `/v1/sabchat/audit` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/audit", sabchat_audit::router::<AppState>())
//! ```
//!
//! ## Why this crate is read-only on the HTTP side
//!
//! Audit *writes* happen inline inside the crates that mutate SabChat
//! state — when `sabchat-conversations` flips a conversation's status,
//! it appends a `ConversationStatusChanged` event in the same handler
//! as part of the same transactional moment. Cramming all those writes
//! through a remote HTTP call would force every sibling crate to pay a
//! network round trip per mutation, double the failure modes, and
//! couple them to this crate's deployment.
//!
//! What this crate owns:
//!
//! 1. The **read** surface (`GET /` + `GET /{id}`) used by dashboards
//!    and operator tooling to inspect the log.
//! 2. The canonical [`record`] helper. Right now sibling crates write
//!    directly via `mongo.collection("sabchat_audit_log").insert_one`,
//!    but once they take a `sabchat-audit` path dep they should switch
//!    to [`record`] so the encoding stays in one place.
//!
//! ## HTTP surface
//!
//! | Method | Path                                                                 | Handler                |
//! |--------|----------------------------------------------------------------------|------------------------|
//! | GET    | `/?conversationId=&contactId=&inboxId=&action=&actorId=&since=&until=&limit=&cursor=` | [`list_events`]       |
//! | GET    | `/{id}`                                                              | [`get_event`]          |
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatAuditState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use bson::{Document, to_bson};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub use handlers::{get_event, list_events};
pub use state::SabChatAuditState;

/// Mongo collection that stores the audit log. Exposed `pub(crate)` so
/// both the handlers and the [`record`] helper agree on the name
/// without duplicating it.
pub(crate) const AUDIT_COLL: &str = "sabchat_audit_log";

/// Build the SabChat audit router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/audit`):
///
/// ```text
/// GET    /          — list_events (filtered, cursor-paginated)
/// GET    /{id}      — get_event   (single event by id)
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatAuditState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAuditState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_events))
        .route("/{id}", get(handlers::get_event))
}

/// Append an audit event to `sabchat_audit_log`. Fire-and-forget by
/// callers is fine — we still surface errors so the caller can log
/// them.
///
/// This is the **canonical** write path. Sibling crates that currently
/// hand-roll `mongo.collection("sabchat_audit_log").insert_one(doc!{…})`
/// should migrate to this helper once they take a `sabchat-audit` path
/// dep — that way the BSON encoding of [`sabchat_types::SabChatAuditEvent`]
/// lives in exactly one place and the collection name (`sabchat_audit_log`)
/// is not stringly-typed at every call site.
///
/// ## Errors
///
/// Returns the Mongo driver error wrapped in `anyhow::Error` if the
/// insert fails. Serializing a [`sabchat_types::SabChatAuditEvent`] to
/// BSON is infallible in practice (every field is a primitive or an
/// `ObjectId` / `chrono::DateTime`), but we still surface the error
/// path rather than `.expect`-ing inside the library.
///
/// ## Example
///
/// ```ignore
/// use sabchat_audit::record;
/// use sabchat_types::{AuditAction, SabChatAuditEvent};
/// use bson::oid::ObjectId;
/// use chrono::Utc;
///
/// let event = SabChatAuditEvent {
///     id: ObjectId::new(),
///     tenant_id: tenant_oid,
///     conversation_id: Some(conversation_oid),
///     contact_id: None,
///     inbox_id: None,
///     action: AuditAction::ConversationAssigned,
///     actor_type: "agent".into(),
///     actor_id: Some(agent_oid),
///     before: serde_json::json!({ "assignee": null }),
///     after:  serde_json::json!({ "assignee": agent_oid.to_hex() }),
///     created_at: Utc::now(),
/// };
/// record(&mongo, event).await?;
/// ```
pub async fn record(
    mongo: &MongoHandle,
    event: sabchat_types::SabChatAuditEvent,
) -> anyhow::Result<()> {
    // Serialize via the `Serialize` impl so the `#[serde(rename_all =
    // "camelCase")]` and the `chrono_datetime_as_bson_datetime` codec
    // on `created_at` are both honoured. The wire shape we land in
    // Mongo matches what the read endpoints already expect.
    let bson = to_bson(&event)
        .map_err(|e| anyhow::Error::new(e).context("serialize SabChatAuditEvent to BSON"))?;
    let doc: Document = match bson {
        bson::Bson::Document(d) => d,
        other => {
            return Err(anyhow::anyhow!(
                "SabChatAuditEvent serialized to non-document BSON: {other:?}"
            ));
        }
    };

    mongo
        .collection::<Document>(AUDIT_COLL)
        .insert_one(doc)
        .await
        .map_err(|e| anyhow::Error::new(e).context("sabchat_audit_log.insert_one"))?;

    Ok(())
}
