//! Application state slice consumed by the broadcast router.
//!
//! The router is generic over the caller's outer state `S` and only asks
//! for two things via [`FromRef`](axum::extract::FromRef):
//!
//! 1. A [`WachatBroadcastState`] — the bundle of handles below.
//! 2. An `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!    [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Both fields are internally `Arc`-backed (via the underlying client
//! handles) and cheap to clone. The orchestrating `api` crate
//! constructs a single `WachatBroadcastState` at boot and exposes it
//! from its `AppState` via `FromRef`.

use sabnode_db::mongo::MongoHandle;
use wachat_queue::BullProducer;

/// Bundle of handles the broadcast router needs to satisfy every route.
/// Clone is cheap — every field is `Arc`-backed (Mongo wraps an `Arc`
/// internally; `BullProducer` is `Clone` over an `Arc<Redis>`).
#[derive(Clone)]
pub struct WachatBroadcastState {
    /// Mongo handle for direct collection access. The router does its
    /// own Mongo I/O rather than delegate to a separate engine because
    /// the broadcast surface is largely CRUD over `broadcasts` /
    /// `broadcast_contacts` / `broadcast_logs` — the engine layer would
    /// be a one-method-per-handler shim with no reuse value.
    pub mongo: MongoHandle,

    /// BullMQ producer for the `broadcast-control` queue. We keep the
    /// queue name out of state on purpose; the producer takes the queue
    /// name on each `add()` so the same producer can target multiple
    /// queues without state churn.
    pub bull: BullProducer,
}
