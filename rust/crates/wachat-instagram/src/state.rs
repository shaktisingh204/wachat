//! State bundle consumed by the wachat-instagram router.
//!
//! Every endpoint needs both a Mongo handle (to read the project document
//! for the `accessToken` / `facebookPageId`) and a `MetaClient` (to talk to
//! `graph.facebook.com`). They're pre-bundled here so the calling `api`
//! crate threads exactly one extractor through `axum::FromRef`, mirroring
//! how `meta-suite` and `wachat-features` are wired.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every Instagram endpoint needs. Cheap to clone —
/// `MongoHandle` is `Arc`-backed and `MetaClient` wraps a `reqwest::Client`
/// which is itself `Arc`-backed.
#[derive(Clone)]
pub struct WachatInstagramState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatInstagramState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
