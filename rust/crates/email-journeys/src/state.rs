//! Shared state for the journeys router.
//!
//! The router needs:
//!   * a Mongo handle for reads/writes against `email_journeys` and
//!     `email_journey_runs`, plus enrol-time reads from `email_subscribers`,
//!   * a BullMQ producer to push `journey-tick` / `journey-enroll-bulk`
//!     jobs onto the `"email-journey"` queue drained by the worker.

use sabnode_db::mongo::MongoHandle;
use wachat_queue::BullProducer;

#[derive(Clone)]
pub struct EmailJourneysState {
    /// Mongo handle. Internally `Arc`-wrapped; cheap to clone.
    pub mongo: MongoHandle,

    /// BullMQ producer targeting the `"email-journey"` queue.
    pub bull: BullProducer,
}
