//! State bundle consumed by the wachat-features router.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles the wachat-features router needs to satisfy every
/// route. Clone is cheap (Mongo handle is `Arc`-backed; `MetaClient`
/// wraps a `reqwest::Client` which is itself `Arc`-backed).
#[derive(Clone)]
pub struct WachatFeaturesState {
    /// Shared Mongo handle. The vast majority of feature handlers are
    /// thin Mongo CRUD shims.
    pub mongo: MongoHandle,

    /// Shared Meta Cloud-API HTTP wrapper. Used by:
    /// - `POST /projects/{id}/phone-numbers/{pnid}/profile`
    /// - `POST /projects/{id}/bulk-send`
    pub meta: MetaClient,
}
