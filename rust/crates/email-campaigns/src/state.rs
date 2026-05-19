//! Shared state for the campaigns router.
//!
//! The router needs:
//!   * a Mongo handle for reads/writes against `email_campaigns`,
//!     `email_subscribers`, `email_suppressions`, `email_reports_cache`,
//!     and `email_brand_kits`, and
//!   * a BullMQ producer to enqueue jobs onto the `"email-send"` queue
//!     drained by `email-sender`.

use sabnode_db::mongo::MongoHandle;
use wachat_queue::BullProducer;

#[derive(Clone)]
pub struct EmailCampaignsState {
    /// Mongo handle. Cheap to clone — internally `Arc`-wrapped.
    pub mongo: MongoHandle,

    /// BullMQ producer targeting the `"email-send"` queue. The queue name
    /// is passed on every `add()` call so the same producer can target
    /// any future email queues without state churn.
    pub bull: BullProducer,
}
