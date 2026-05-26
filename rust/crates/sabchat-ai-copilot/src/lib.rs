//! # sabchat-ai-copilot
//!
//! Agent-side AI assistant for the SabChat inbox. The copilot helps human
//! agents move faster:
//!
//! * **`POST /draft`** — given a conversation, produce a suggested reply
//!   the agent can accept, edit, or discard.
//! * **`POST /summarize`** — produce a short summary of the thread so a
//!   reassigned / handed-off agent can catch up at a glance.
//! * **`POST /suggest-actions`** — suggest next operational steps on the
//!   conversation (apply a label, escalate, resolve, or send a canned
//!   reply).
//! * **`POST /wrap-up`** — internal close note. Captured when the agent
//!   resolves the conversation so the audit trail records *why*.
//!
//! ## LLM client
//!
//! The actual model call is hidden behind an [`llm::LlmClient`] trait. A
//! deterministic [`llm::StubClient`] ships in-tree so the rest of the
//! stack can be wired up and tested before we have OpenAI / Anthropic
//! credentials. Provider selection happens in
//! [`llm::make_client_from_env`] which the [`state::SabChatAiCopilotState`]
//! constructor calls — the orchestrating `api` binary does **not** need
//! to know anything about LLM internals.
//!
//! ```ignore
//! let state = SabChatAiCopilotState::new(mongo);   // picks an LLM client
//! let app   = Router::new()
//!     .nest("/v1/sabchat/ai/copilot", sabchat_ai_copilot::router::<AppState>())
//!     ...
//! ```
//!
//! ## Data access
//!
//! Read-only against `sabchat_conversations` and `sabchat_messages`. Every
//! query is tenant-scoped via [`AuthUser`](sabnode_auth::AuthUser). The
//! prompt builder loads the last 30 messages of the target conversation
//! in chronological order so the LLM sees the thread the way a human
//! would.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`SabChatAiCopilotState`] bundle (Mongo handle + LLM client), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod llm;
pub(crate) mod prompts;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;

pub use llm::{LlmClient, LlmResp, StubClient, make_client_from_env};
pub use state::SabChatAiCopilotState;

/// Build the SabChat AI copilot router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/ai/copilot`):
///
/// ```text
/// POST /draft             — draft a reply for the next agent turn
/// POST /summarize         — short thread summary
/// POST /suggest-actions   — suggested next agent actions
/// POST /wrap-up           — internal resolution note
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatAiCopilotState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAiCopilotState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/draft", post(handlers::draft))
        .route("/summarize", post(handlers::summarize))
        .route("/suggest-actions", post(handlers::suggest_actions))
        .route("/wrap-up", post(handlers::wrap_up))
}
