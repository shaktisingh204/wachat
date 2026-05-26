//! # sabchat-ai-translate
//!
//! Phase — axum router that exposes live translation for the SabChat
//! omnichannel inbox. Mounted under `/v1/sabchat/ai/translate` from the
//! orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/ai/translate",
//!     sabchat_ai_translate::router::<AppState>(),
//! )
//! ```
//!
//! ## Scope
//!
//! Three endpoints. The first two are pure pass-throughs to the bound
//! [`Translator`] implementation; the third persists the translation
//! against a stored [`sabchat_types::SabChatMessage`] under
//! `provider_metadata.translations[targetLang]`:
//!
//! | HTTP route                              | Handler                       |
//! |-----------------------------------------|-------------------------------|
//! | `POST /text`                            | [`handlers::translate_text`]  |
//! | `POST /detect`                          | [`handlers::detect`]          |
//! | `POST /message`                         | [`handlers::translate_message`] |
//!
//! ## Translator backend
//!
//! Handlers depend on an `Arc<dyn `[`Translator`]`>` resolved at startup
//! by [`make_translator_from_env`]. The default build ships a
//! [`StubTranslator`] which echoes the input text back unchanged with
//! `detected_source_lang = "en"` and `model = "stub"` — production wires
//! in a real provider (OpenAI / DeepL / Google) without touching this
//! crate.
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. The on-message route additionally enforces tenant scope:
//! the target `sabchat_messages` document must live under
//! `auth.tenant_id` parsed as an `ObjectId`, mirroring the guard used by
//! sibling crates (`sabchat-messages`, `sabchat-conversations`).
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`SabChatAiTranslateState`] bundle (Mongo handle + translator), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled via [`FromRef`](axum::extract::FromRef) so this crate
//! stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;
pub mod translator;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;

pub use state::SabChatAiTranslateState;
pub use translator::*;

/// Build the SabChat AI translate router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/ai/translate`):
///
/// ```text
/// POST   /text                      — translate_text
/// POST   /detect                    — detect
/// POST   /message                   — translate_message
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatAiTranslateState`] bundle and the JWT verifier config; both
/// are pulled via [`FromRef`] so the router does not have to know about
/// a concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAiTranslateState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/text", post(handlers::translate_text))
        .route("/detect", post(handlers::detect))
        .route("/message", post(handlers::translate_message))
}
