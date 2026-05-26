//! State slice consumed by the SabChat auto-resolve RAG bot router.
//!
//! Handlers need a Mongo handle (for retrieval + message / audit writes)
//! and a pluggable [`Bot`](crate::llm::Bot) adapter that turns retrieved
//! snippets + a question into a final answer + confidence score.
//!
//! The LLM adapter is held as an `Arc<dyn Bot>` so the router stays
//! agnostic of the concrete provider (stub today, OpenAI / Anthropic /
//! Vercel AI Gateway tomorrow). [`crate::llm::make_bot_from_env`] is the
//! single construction site — wire it in from the orchestrator at
//! startup.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;

use crate::llm::Bot;

/// Bundle of handles the resolve-bot router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed and the `Bot` is already
/// behind an `Arc`.
#[derive(Clone)]
pub struct SabChatAiResolveBotState {
    pub mongo: MongoHandle,
    pub bot: Arc<dyn Bot>,
}

impl SabChatAiResolveBotState {
    /// Build a fresh state bundle. The orchestrator typically calls this
    /// once at startup with the global `MongoHandle` and a `Bot` built
    /// via [`crate::llm::make_bot_from_env`].
    pub fn new(mongo: MongoHandle, bot: Arc<dyn Bot>) -> Self {
        Self { mongo, bot }
    }
}
