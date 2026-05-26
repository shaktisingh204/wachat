//! State slice consumed by the SabChat AI translate router.
//!
//! Handlers need a Mongo handle (to persist translations on existing
//! `sabchat_messages` documents) and an `Arc<dyn Translator>` resolved
//! at startup by [`crate::translator::make_translator_from_env`]. Both
//! are bundled here so the orchestrator can register a single slice
//! without leaking the translator backend to every router.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;

use crate::translator::Translator;

/// Bundle of handles the AI translate router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed and the translator is
/// already wrapped in an `Arc`.
#[derive(Clone)]
pub struct SabChatAiTranslateState {
    pub mongo: MongoHandle,
    pub translator: Arc<dyn Translator>,
}

impl SabChatAiTranslateState {
    pub fn new(mongo: MongoHandle, translator: Arc<dyn Translator>) -> Self {
        Self { mongo, translator }
    }
}
