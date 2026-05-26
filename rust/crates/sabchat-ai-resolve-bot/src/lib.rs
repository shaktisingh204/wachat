//! # sabchat-ai-resolve-bot
//!
//! Phase — axum router for the SabChat **auto-resolve RAG bot**. Mounted
//! under `/v1/sabchat/ai/resolve-bot` by the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/ai/resolve-bot",
//!       sabchat_ai_resolve_bot::router::<AppState>())
//! ```
//!
//! ## What it does
//!
//! Given an incoming visitor question, the bot:
//!
//! 1. Retrieves the top-k matching documents from
//!    `sabchat_kb_articles` (lexical `$text` match on title + body), all
//!    scoped to the caller's tenant.
//! 2. Composes a prompt out of those snippets plus the question.
//! 3. Calls the configured [`Bot`](llm::Bot) adapter for an answer +
//!    confidence + cited sources.
//! 4. If the bot's confidence meets the per-inbox
//!    `confidence_threshold`, returns the answer (and on the
//!    `/auto-reply` path also appends a [`SabChatMessage`] to the
//!    conversation + writes a `message_sent` audit row with
//!    `actor_type = "bot"`).
//! 5. Otherwise marks the response as `escalate = true` so the calling
//!    surface can hand off to a human.
//!
//! ## Scope
//!
//! | HTTP route                              | Handler                |
//! |-----------------------------------------|------------------------|
//! | `POST   /answer`                        | [`handlers::answer`]   |
//! | `POST   /auto-reply`                    | [`handlers::auto_reply`] |
//!
//! Auto-reply additionally touches two side collections:
//!
//! - `sabchat_conversations` — `last_message_at`,
//!   `last_message_preview`, `first_response_at` (first outbound).
//! - `sabchat_audit_log` — `message_sent` event with
//!   `actor_type = "bot"`.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`SabChatAiResolveBotState`] bundle (Mongo handle + the boxed
//!   [`Bot`](llm::Bot) adapter), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled via [`FromRef`](axum::extract::FromRef) so this crate
//! stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod llm;
pub mod retriever;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;

pub use state::SabChatAiResolveBotState;

/// Build the SabChat auto-resolve RAG bot router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/ai/resolve-bot`):
///
/// ```text
/// POST   /answer       — handlers::answer
/// POST   /auto-reply   — handlers::auto_reply
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatAiResolveBotState`] bundle and the JWT verifier config; both
/// are pulled via [`FromRef`] so the router does not have to know about
/// a concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAiResolveBotState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/answer", post(handlers::answer))
        .route("/auto-reply", post(handlers::auto_reply))
}
