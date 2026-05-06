//! Application-state slice consumed by the broadcast-counter HTTP handler.
//!
//! Only the broadcast-counter HTTP endpoint (Phase 9, the broadcast worker
//! cutover) needs state — the legacy `StatusProcessor` library entry point
//! takes a `MongoHandle` directly via `::new`.
//!
//! The router is generic over the caller's outer state `S`; the orchestrator
//! `api` crate plugs in via `FromRef`. This pattern matches every sibling
//! domain router in the workspace (`wachat-broadcast`, `wachat-send-router`,
//! etc.) so the wiring step is one `FromRef` impl in `api/src/state.rs`.

use crate::broadcast::BroadcastCounterProcessor;

/// Bundle of handles the broadcast-counter handler needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Debug, Clone)]
pub struct WachatWebhookStatusState {
    /// Writer for the `broadcast_contacts.status` updates and the
    /// `broadcasts.$inc` counter rolls. Constructed once at boot from the
    /// shared `MongoHandle`.
    pub broadcast: BroadcastCounterProcessor,
}

impl WachatWebhookStatusState {
    /// Convenience constructor — most call sites have a `MongoHandle` lying
    /// around at AppState assembly time.
    pub fn new(mongo: sabnode_db::mongo::MongoHandle) -> Self {
        Self {
            broadcast: BroadcastCounterProcessor::new(mongo),
        }
    }
}
