//! State slice consumed by the SabChat AI sentiment router.
//!
//! Bundles the Mongo handle (for loading messages / conversations and
//! persisting classification results) together with a shared
//! [`Classifier`] implementation. The classifier is held behind an
//! `Arc<dyn Classifier>` so handlers stay agnostic of whether the
//! underlying model is the keyword stub, an embedded ONNX runtime, or a
//! remote LLM call.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;

use crate::classifier::Classifier;

/// Bundle of handles the AI sentiment router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed and the classifier already
/// lives behind an `Arc`.
#[derive(Clone)]
pub struct SabChatAiSentimentState {
    pub mongo: MongoHandle,
    pub classifier: Arc<dyn Classifier>,
}

impl SabChatAiSentimentState {
    /// Construct a new state slice from its parts.
    pub fn new(mongo: MongoHandle, classifier: Arc<dyn Classifier>) -> Self {
        Self { mongo, classifier }
    }
}
