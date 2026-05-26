//! State slice consumed by the SabChat AI copilot router.
//!
//! Two handles:
//!
//! * `mongo` — read-only access to `sabchat_conversations` and
//!   `sabchat_messages`. The copilot does not mutate any document; it
//!   only feeds context into the LLM.
//! * `llm`   — the pluggable language-model client. Selected at
//!   construction time via [`crate::llm::make_client_from_env`] so the
//!   orchestrating binary does not need to know about LLM internals.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;

use crate::llm::{LlmClient, make_client_from_env};

/// Bundle of handles the copilot router needs. Cheap to clone — the
/// underlying [`MongoHandle`] is `Arc`-backed and the LLM client is
/// already an `Arc<dyn LlmClient>`.
#[derive(Clone)]
pub struct SabChatAiCopilotState {
    pub mongo: MongoHandle,
    pub llm: Arc<dyn LlmClient>,
}

impl SabChatAiCopilotState {
    /// Build a fresh state bundle. Picks the LLM client implementation
    /// out of environment configuration via [`make_client_from_env`] so
    /// the api binary stays decoupled from provider selection.
    pub fn new(mongo: MongoHandle) -> Self {
        Self {
            mongo,
            llm: make_client_from_env(),
        }
    }

    /// Test / advanced construction — inject a custom LLM client (for
    /// integration tests, a deterministic fixture, or a future custom
    /// provider). Production code should call [`Self::new`].
    pub fn with_llm(mongo: MongoHandle, llm: Arc<dyn LlmClient>) -> Self {
        Self { mongo, llm }
    }
}
