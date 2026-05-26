//! # sabchat-crm-bridge
//!
//! Axum router that bridges the **SabChat** inbox surface
//! (`sabchat_contacts`, `sabchat_conversations`) with the **CRM** core
//! (`crm_contacts`, `crm_deals`, `crm_tickets`, `crm_bookings`). Mounted
//! under `/v1/sabchat/crm-bridge` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/crm-bridge", sabchat_crm_bridge::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! Six endpoints — three for the contact two-way sync, three for the
//! "open a CRM record from a conversation" shortcuts.
//!
//! | Route                                                      | Purpose                                  |
//! |------------------------------------------------------------|------------------------------------------|
//! | `POST /link-contact/{sabChatContactId}`                    | Match-or-create a `crm_contacts` row and link it |
//! | `POST /push-to-crm/{sabChatContactId}`                     | Force-push sabchat fields into the linked CRM row |
//! | `POST /pull-from-crm/{sabChatContactId}`                   | Force-pull linked CRM fields back onto the sabchat row |
//! | `POST /conversation-to-deal/{conversationId}`              | Create a `crm_deals` row, attach to `customAttrs.dealIds[]` |
//! | `POST /conversation-to-ticket/{conversationId}`            | Create a `crm_tickets` row, attach to `customAttrs.ticketIds[]` |
//! | `POST /conversation-to-booking/{conversationId}`           | Create a `crm_bookings` row, attach to `customAttrs.bookingIds[]` |
//!
//! ## Tenancy
//!
//! Every endpoint runs under the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. SabChat scopes by `tenantId`; the CRM collections are
//! older and sometimes scope by `userId` instead — we accept **both**
//! via an `$or` filter on every CRM read/write so the bridge works
//! against either schema dialect.
//!
//! ## Best-effort sync
//!
//! The CRM schema is not stabilised, so we go through `bson::doc!`
//! directly rather than typed DTOs. Fields written: `name`, `emails`,
//! `phones`, plus a `_sabchatContactId` back-link. Anything else on the
//! CRM document is preserved by using `$set` (never `$replace`).
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`SabChatCrmBridgeState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;

pub use state::SabChatCrmBridgeState;

/// Build the SabChat ↔ CRM bridge router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/crm-bridge`):
///
/// ```text
/// POST /link-contact/{sabChatContactId}
/// POST /push-to-crm/{sabChatContactId}
/// POST /pull-from-crm/{sabChatContactId}
/// POST /conversation-to-deal/{conversationId}
/// POST /conversation-to-ticket/{conversationId}
/// POST /conversation-to-booking/{conversationId}
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatCrmBridgeState`] bundle and the JWT verifier config; both
/// are pulled via [`FromRef`] so the router does not have to know about
/// a concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCrmBridgeState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/link-contact/{sabchat_contact_id}",
            post(handlers::link_contact),
        )
        .route(
            "/push-to-crm/{sabchat_contact_id}",
            post(handlers::push_to_crm),
        )
        .route(
            "/pull-from-crm/{sabchat_contact_id}",
            post(handlers::pull_from_crm),
        )
        .route(
            "/conversation-to-deal/{conversation_id}",
            post(handlers::conversation_to_deal),
        )
        .route(
            "/conversation-to-ticket/{conversation_id}",
            post(handlers::conversation_to_ticket),
        )
        .route(
            "/conversation-to-booking/{conversation_id}",
            post(handlers::conversation_to_booking),
        )
}
