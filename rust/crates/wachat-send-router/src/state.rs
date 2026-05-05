//! Application state slice consumed by the send-path router.
//!
//! The router is generic over the caller's outer state `S` and only asks
//! for two things via [`FromRef`](axum::extract::FromRef):
//!
//! 1. A [`WachatSendState`] — the bundle of engine handles below.
//! 2. An `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!    [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Each engine handle is internally `Arc`-backed and cheap to clone, so
//! the bundle itself is also cheap. The orchestrating `api` crate
//! constructs a single `WachatSendState` at boot and exposes it from its
//! `AppState` via `FromRef`.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;
use wachat_chat_mark::ChatMarker;
use wachat_chat_read::ChatReader;
use wachat_contacts_resolve::ContactResolver;
use wachat_payment_request::PaymentRequestSender;
use wachat_send::MessageSender;
use wachat_send_cta::CtaSender;
use wachat_send_flows::FlowSender;
use wachat_send_orders::OrdersSender;

/// Bundle of engine handles the send-path router needs to satisfy every
/// route. Clone is cheap — every field is `Arc`-backed.
///
/// `mongo` is held alongside the engines because most handlers need to
/// look up a `Project` document to enforce per-project tenancy
/// (`AuthUser::tenant_id == project.userId.to_hex()`) before delegating
/// to an engine that takes `&Project`.
#[derive(Clone)]
pub struct WachatSendState {
    /// Main text + media sender (slice 1).
    pub message: Arc<MessageSender>,

    /// Catalog + CTA URL interactive sender (slice 2).
    pub cta: Arc<CtaSender>,

    /// Location-request + address interactive sender (slice 3).
    pub flows: Arc<FlowSender>,

    /// `order_details` + `order_status` interactive sender (slice 4).
    pub orders: Arc<OrdersSender>,

    /// Contact upsert engine (slice 6).
    pub contacts: Arc<ContactResolver>,

    /// Chat-UI read engine — initial bootstrap + paginated history (slice 6).
    pub chat_read: Arc<ChatReader>,

    /// Mark-read / mark-unread engine for the agent inbox (slice 7).
    pub chat_mark: Arc<ChatMarker>,

    /// Payment-request sender + status reader (slice 8).
    pub payment: Arc<PaymentRequestSender>,

    /// Mongo handle for direct project lookups (per-project tenancy
    /// guard runs before delegating to engines that take `&Project`).
    pub mongo: MongoHandle,
}
