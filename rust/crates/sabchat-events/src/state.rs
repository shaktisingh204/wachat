//! State slice consumed by the SabChat events router.
//!
//! Bundles the two things every handler needs: the Mongo handle backing
//! the `sabchat_events` collection, and the [`EventBus`] used by the
//! replay route to re-broadcast a stored envelope. Sibling SabChat
//! crates also `FromRef` the bus out of the orchestrator's app state so
//! they can call `bus.publish(...)` without depending on this state
//! struct directly.
//!
//! Cheap to `Clone` — both the inner [`MongoHandle`] and the bus's
//! `broadcast::Sender` are `Arc`-backed.

use sabnode_db::mongo::MongoHandle;

use crate::EventBus;

/// Bundle of handles the SabChat events router needs. Cheap to clone —
/// the underlying [`MongoHandle`] and broadcast sender inside the bus
/// are both `Arc`-backed.
#[derive(Clone)]
pub struct SabChatEventsState {
    /// Mongo handle used by the read endpoints to query the persisted
    /// log. Kept as a sibling of the bus (rather than going through
    /// `bus.mongo()`) so callers can read the log even when the bus is
    /// stubbed out in tests.
    pub mongo: MongoHandle,

    /// The in-process event bus. Cloning is cheap. Sibling crates pull
    /// this out via `FromRef` so they can call
    /// [`EventBus::publish`](crate::EventBus::publish) from their own
    /// handlers without depending on this struct.
    pub bus: EventBus,
}

impl SabChatEventsState {
    /// Construct a state bundle from a Mongo handle. The bus is built
    /// internally via [`EventBus::new`], so callers only need to thread
    /// one handle through.
    ///
    /// Call this **once** at process startup and stash the result in
    /// the orchestrator's `AppState`. Cloning thereafter is cheap.
    pub fn new(mongo: MongoHandle) -> Self {
        let bus = EventBus::new(mongo.clone());
        Self { mongo, bus }
    }
}
