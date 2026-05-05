//! # wachat-send-router
//!
//! Phase 4 slice 9 of the SabNode wachat → Rust port. This crate owns
//! the axum router that mounts every **send-path** endpoint under
//! `/v1/wachat/*` (everything except the templates surface, which lives
//! in `wachat-templates-router`). It contains **no business logic** —
//! every handler delegates to one of the engine crates from Phase 4
//! slices 1–8:
//!
//! | Engine                                          | Slice |
//! | ----------------------------------------------- | ----- |
//! | [`wachat_send::MessageSender`]                  | 1     |
//! | [`wachat_send_cta::CtaSender`]                  | 2     |
//! | [`wachat_send_flows::FlowSender`]               | 3     |
//! | [`wachat_send_orders::OrdersSender`]            | 4     |
//! | [`wachat_contacts_resolve::ContactResolver`]    | 6     |
//! | [`wachat_chat_read::ChatReader`]                | 6     |
//! | [`wachat_chat_mark::ChatMarker`]                | 7     |
//! | [`wachat_payment_request::PaymentRequestSender`]| 8     |
//!
//! ## Mount path
//!
//! Routes are written **relative** (`/messages/send`, `/contacts/resolve`,
//! …). The caller (the `api` crate) is expected to nest the result under
//! `/v1/wachat`, giving final URLs like `/v1/wachat/messages/send`.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need only:
//!
//! - a [`WachatSendState`] bundle (engine handles + `MongoHandle`), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.
//!
//! ## Auth
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor — there is no anonymous access. Per-project endpoints
//! additionally enforce
//! `user.tenant_id == project.userId.to_hex()` after loading the
//! project. The contact-scoped endpoints (`/chat/conversation/:id`,
//! `/chat/mark-{read,unread}/:id`) load the contact, read its
//! `projectId`, and then run the same project tenancy guard. The
//! follow-up `sabnode-tenancy` slice will swap the owner check for a
//! `project_members` membership lookup.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod state;

pub use state::WachatSendState;

/// Build the wachat send-path router.
///
/// Routes (mounted relative — caller nests under `/v1/wachat`):
///
/// ```text
/// POST /messages/send                         — generic send (kind: text|image|video|document|audio)
/// POST /messages/catalog                      — interactive product_list
/// POST /messages/cta-url                      — interactive cta_url
/// POST /messages/location-request             — interactive location_request_message
/// POST /messages/address                      — interactive address_message
/// POST /messages/order-details                — interactive order_details
/// POST /messages/order-status                 — interactive order_status
/// POST /contacts/resolve                      — find_or_create contact
/// GET  /chat/initial?project_id=&phone_number_id=&contact_id=&wa_id=
///                                             — initial chat bootstrap
/// GET  /chat/conversation/{contact_id}?limit= — paginated history
/// POST /chat/mark-read/{contact_id}           — mark conversation read
/// POST /chat/mark-unread/{contact_id}         — mark conversation unread
/// POST /payment-requests/send                 — send a payment request
/// GET  /payment-requests/by-reference/{reference_id}
///                                             — get one by reference id
/// GET  /payment-requests?project_id=          — list for a project
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`WachatSendState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Important**: `/payment-requests/by-reference/{reference_id}` is
/// registered **before** the bare `/payment-requests` route so axum's
/// matcher prefers the literal `by-reference` segment. Similarly the
/// chat `mark-read` / `mark-unread` literals come before the
/// `/chat/conversation/{contact_id}` pattern so axum doesn't try to
/// interpret them as a contact id.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatSendState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- /messages/* ----------------------------------------------------
        .route("/messages/send", post(handlers::send_message))
        .route("/messages/catalog", post(handlers::send_catalog))
        .route("/messages/cta-url", post(handlers::send_cta_url))
        .route(
            "/messages/location-request",
            post(handlers::send_location_request),
        )
        .route("/messages/address", post(handlers::send_address))
        .route(
            "/messages/order-details",
            post(handlers::send_order_details),
        )
        .route("/messages/order-status", post(handlers::send_order_status))
        // ---- /contacts/* ----------------------------------------------------
        .route("/contacts/resolve", post(handlers::resolve_contact))
        // ---- /chat/* --------------------------------------------------------
        // Literal segments registered before /{contact_id} variants.
        .route("/chat/initial", get(handlers::chat_initial))
        .route(
            "/chat/mark-read/{contact_id}",
            post(handlers::chat_mark_read),
        )
        .route(
            "/chat/mark-unread/{contact_id}",
            post(handlers::chat_mark_unread),
        )
        .route(
            "/chat/conversation/{contact_id}",
            get(handlers::chat_conversation),
        )
        // ---- /payment-requests/* -------------------------------------------
        // `by-reference` literal goes before the bare list route.
        .route(
            "/payment-requests/by-reference/{reference_id}",
            get(handlers::payment_request_status),
        )
        .route(
            "/payment-requests/send",
            post(handlers::payment_request_send),
        )
        .route("/payment-requests", get(handlers::payment_request_list))
}
