//! Slice state for the user-facing webhook actions surface.
//!
//! The underlying handlers (re-exported from `wachat-webhook-config`) only
//! need `MongoHandle` and `Arc<AuthConfig>` — both already live on the
//! outer `AppState`. This struct is a typed marker so the outer state
//! declares "the webhook-actions slice is wired"; it currently carries no
//! per-slice handles. When future per-action state lands (feature flags,
//! per-project rate limit, reprocess dispatcher) it grows here without
//! touching call sites.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the webhook-actions surface needs.
///
/// Today this is just the Mongo handle (handlers extract it directly via
/// `FromRef<AppState> for MongoHandle`); the type is kept distinct so
/// adding fields later is a non-breaking change for the `api` crate.
#[derive(Clone)]
pub struct WachatWebhookActionsState {
    pub mongo: MongoHandle,
}

impl WachatWebhookActionsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
