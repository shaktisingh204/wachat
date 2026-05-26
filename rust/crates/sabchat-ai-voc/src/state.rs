//! State slice consumed by the SabChat AI voice-of-customer router.
//!
//! Bundles the Mongo handle (for reading visitor messages and writing
//! topic / run documents) together with a shared
//! [`Clusterer`](crate::cluster::Clusterer) implementation. The
//! clusterer is held behind an `Arc<dyn Clusterer>` so handlers stay
//! agnostic of whether the underlying algorithm is the keyword stub, an
//! embedding-backed k-means, or a remote LLM call.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;

use crate::cluster::{Clusterer, make_clusterer_from_env};

/// Bundle of handles the AI voice-of-customer router needs. Cheap to
/// clone — the underlying `MongoHandle` is `Arc`-backed and the
/// clusterer already lives behind an `Arc`.
#[derive(Clone)]
pub struct SabChatAiVocState {
    pub mongo: MongoHandle,
    pub clusterer: Arc<dyn Clusterer>,
}

impl SabChatAiVocState {
    /// Construct a state slice with the default clusterer chosen by
    /// [`make_clusterer_from_env`]. Callers that want to inject a custom
    /// implementation (tests, an LLM-backed variant) should build the
    /// struct literally.
    pub fn new(mongo: MongoHandle) -> Self {
        Self {
            mongo,
            clusterer: make_clusterer_from_env(),
        }
    }

    /// Construct a state slice with an explicit clusterer. Useful for
    /// tests that want a deterministic stub or for orchestrators that
    /// wire a real embedding service.
    pub fn with_clusterer(mongo: MongoHandle, clusterer: Arc<dyn Clusterer>) -> Self {
        Self { mongo, clusterer }
    }
}
