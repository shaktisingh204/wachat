//! # sabchat-commerce
//!
//! Phase — axum router that owns the **conversational commerce** HTTP
//! surface for SabChat. Mounted under `/v1/sabchat/commerce` from the
//! orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/commerce", sabchat_commerce::router::<AppState>())
//! .nest("/v1/sabchat/commerce/webhooks", sabchat_commerce::webhook_router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! Three workflows agents need inside the inbox without bouncing to a
//! separate shop UI:
//!
//! 1. **Send product card** — look up one product in the existing
//!    `shop` / `crm_items` collection, append a [`ContentBlock::Card`]
//!    message to the conversation so the visitor sees a rendered card.
//! 2. **Send catalog carousel** — same, but for many products at once,
//!    rendered as a [`ContentBlock::Carousel`].
//! 3. **Generate payment link** — mint a (currently dummy)
//!    provider-agnostic checkout URL, persist a row in
//!    `sabchat_payment_requests`, and append a [`ContentBlock::Payment`]
//!    so the visitor gets a tap-to-pay button.
//!
//! A fourth public endpoint (`POST /payment-callback`) lets the chosen
//! payment provider flip a request's status when the visitor pays /
//! fails / lets the link expire; on `paid` we append a
//! [`ContentBlock::System`] receipt note to the conversation.
//!
//! ## Catalog source
//!
//! Best-effort, tenant-scoped read against two collections:
//!
//! - `crm_items` (the CRM products module's canonical store).
//! - `shop` (the standalone storefront's product collection).
//!
//! On lookup we try `crm_items` first, then fall back to `shop`. Each
//! product is matched on `_id` AND either `tenant_id` or `userId`
//! (legacy collections use both shapes). Whichever document hits is the
//! one we render.
//!
//! ## Auth surface
//!
//! [`router`] returns the **agent-facing** routes — every handler
//! requires an [`AuthUser`](sabnode_auth::AuthUser). Tenancy scopes via
//! `auth.tenant_id` parsed as an `ObjectId`, mirroring the pattern in
//! `sabchat-messages`.
//!
//! [`webhook_router`] returns the **public** callback route — no
//! `AuthUser` extractor, no tenant scope. Provider callbacks identify
//! the payment request by `paymentRequestId` and we re-derive tenancy
//! from the stored row. The orchestrator mounts the two routers under
//! different prefixes so the auth boundary stays explicit.
//!
//! ## Side effects per route
//!
//! | Route                            | Reads                                          | Writes                                                                               |
//! |----------------------------------|------------------------------------------------|--------------------------------------------------------------------------------------|
//! | `POST /send-product/{id}`        | `crm_items` ∪ `shop`, `sabchat_conversations`  | `sabchat_messages`, `sabchat_audit_log`                                              |
//! | `POST /send-catalog/{id}`        | `crm_items` ∪ `shop`, `sabchat_conversations`  | `sabchat_messages`, `sabchat_audit_log`                                              |
//! | `POST /payment-link/{id}`        | `sabchat_conversations`                        | `sabchat_payment_requests`, `sabchat_messages`, `sabchat_audit_log`                  |
//! | `POST /payment-callback`         | `sabchat_payment_requests`                     | `sabchat_payment_requests` (status), `sabchat_messages` (if paid), `sabchat_audit_log` |
//! | `GET  /payment-requests`         | `sabchat_payment_requests`                     | —                                                                                    |
//!
//! All writes preserve tenancy: payment-request rows carry `tenantId`,
//! and the callback re-reads it from the row rather than trusting the
//! caller. Audit events use the canonical `sabchat_audit_log` shape so
//! the existing `sabchat-audit` read endpoints render commerce activity
//! alongside conversation activity for free.
//!
//! ## State contract
//!
//! Both [`router`] and [`webhook_router`] are generic over the caller's
//! outer state `S`. The handlers need:
//!
//! - a [`SabChatCommerceState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads — only the
//!   agent-facing router uses it, but we still require it via the same
//!   `FromRef` bound so the orchestrator can wire both routers off a
//!   single shared state struct).

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

pub use state::SabChatCommerceState;

/// Build the agent-facing commerce router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/commerce`):
///
/// ```text
/// POST   /send-product/{conversationId}       — send_product
/// POST   /send-catalog/{conversationId}       — send_catalog
/// POST   /payment-link/{conversationId}       — payment_link
/// GET    /payment-requests?conversationId=    — list_payment_requests
/// ```
///
/// Every route requires an [`AuthUser`](sabnode_auth::AuthUser); the
/// public payment-callback endpoint lives on [`webhook_router`] instead.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCommerceState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/send-product/{conversation_id}",
            post(handlers::send_product),
        )
        .route(
            "/send-catalog/{conversation_id}",
            post(handlers::send_catalog),
        )
        .route(
            "/payment-link/{conversation_id}",
            post(handlers::payment_link),
        )
        .route("/payment-requests", get(handlers::list_payment_requests))
}

/// Build the public webhook router.
///
/// One route, no auth — the payment provider (Razorpay / Stripe / UPI)
/// calls this with the `paymentRequestId` it received when the link was
/// minted. Tenancy is re-derived from the stored row, never trusted
/// from the caller.
///
/// ```text
/// POST   /payment-callback   — payment_callback
/// ```
///
/// The orchestrator mounts this under a separate prefix (typically
/// `/v1/sabchat/commerce/webhooks`) so the public surface is obvious
/// from the route table.
pub fn webhook_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCommerceState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/payment-callback", post(handlers::payment_callback))
}
