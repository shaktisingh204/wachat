//! Webhook receiver state.
//!
//! `WebhookState` aggregates every dependency the [`crate::handlers::receive`]
//! handler and [`crate::dispatcher::dispatch_change`] need at request time.
//! It is `Clone` (every field is either an `Arc<…>` or already cheap to clone)
//! so axum can hand a copy to each request without any locking.
//!
//! Each processor is owned by its own crate and takes a `&MongoHandle` (or a
//! cloned handle) at construction. The receiver only knows the **public
//! `process(...)`/`upsert_from_inbound(...)`/`on_*` API**, never the storage
//! details — keeping this file impossible to break with internal refactors of
//! a sibling crate.

use std::sync::Arc;

use sabnode_db::{MongoHandle, RedisHandle};

use wachat_webhook_account::AccountProcessor;
use wachat_webhook_contacts::ContactsUpserter;
use wachat_webhook_conversations::ConversationTracker;
use wachat_webhook_dlq::DlqWriter;
use wachat_webhook_inbound::InboundProcessor;
use wachat_webhook_status::StatusProcessor;
use wachat_webhook_template_events::TemplateEventsProcessor;

/// Aggregated dependencies for the wachat webhook receiver.
///
/// Stored in the host application's outer state and surfaced to handlers via
/// `axum::extract::FromRef`. All processor fields are `Arc<_>` so cloning the
/// state per request is a handful of refcount bumps — never an allocation.
#[derive(Clone)]
pub struct WebhookState {
    /// Mongo handle used to look up `Project` by `wabaId` (and forwarded to
    /// any inline persistence the dispatcher needs to run).
    pub mongo: MongoHandle,

    /// Redis handle used by sibling DLQ + queue producers. Stored on the
    /// receiver so the host doesn't have to plumb it twice.
    pub redis: RedisHandle,

    /// Handles `value.statuses[]` — `sent`/`delivered`/`read`/`failed`.
    pub status: Arc<StatusProcessor>,

    /// Handles `value.messages[]` — inbound user messages.
    pub inbound: Arc<InboundProcessor>,

    /// Handles `account_*`, `phone_number_*`, `security`,
    /// `business_capability_update`.
    pub account: Arc<AccountProcessor>,

    /// Handles `message_template_*_update` (status / quality / components).
    pub template_events: Arc<TemplateEventsProcessor>,

    /// Failure sink — every dispatch error and every unhandled `field` flows
    /// here with the original raw payload preserved for replay.
    pub dlq: Arc<DlqWriter>,

    /// Upserts the `wa_contacts` document from `value.contacts[]` whenever
    /// an inbound message arrives.
    pub contacts: Arc<ContactsUpserter>,

    /// Tracks the Meta 24h conversation window so billing telemetry is
    /// consistent across inbound + outbound flows.
    pub conversations: Arc<ConversationTracker>,
}
