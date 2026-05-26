//! # sabchat-ai-sentiment
//!
//! Phase — axum router that adds **sentiment / intent / topic / PII**
//! classification on top of the SabChat message log. Mounted under
//! `/v1/sabchat/ai/sentiment` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/ai/sentiment",
//!     sabchat_ai_sentiment::router::<AppState>(),
//! )
//! ```
//!
//! ## Scope
//!
//! Three endpoints, all `POST` (writes mutate Mongo documents):
//!
//! | HTTP                                 | Handler                       |
//! |--------------------------------------|-------------------------------|
//! | `POST /classify`                     | [`handlers::classify`]        |
//! | `POST /message`                      | [`handlers::classify_message`]|
//! | `POST /conversation`                 | [`handlers::classify_conversation`] |
//!
//! ### `POST /classify` — stateless
//!
//! Run the configured [`Classifier`](classifier::Classifier) over an
//! arbitrary chunk of text. No persistence, no Mongo access. Useful for
//! preview UIs and for the front-end "classify before sending" affordance.
//!
//! ### `POST /message` — single message
//!
//! Load `sabchat_messages/{messageId}` under the caller's tenant, run the
//! classifier over the message's text content (skipped for non-text
//! blocks), and persist the result under
//! `provider_metadata.classification`. Returns the classification.
//!
//! ### `POST /conversation` — last 10 visitor messages
//!
//! Load the conversation under the caller's tenant, pull the most recent
//! 10 visitor (inbound) messages, classify each, persist
//! `provider_metadata.classification` on each, and update the parent
//! conversation's `customAttrs.churnRisk` (average negative score) and
//! `customAttrs.lastSentiment`. Returns `{ scored, churnRisk }`.
//!
//! ## Storage shape
//!
//! ```text
//! sabchat_messages.providerMetadata.classification = {
//!   sentiment: "positive" | "negative" | "neutral",
//!   score: f32,
//!   intent: string | null,
//!   topic: string | null,
//!   pii: { hasEmail, hasPhone, hasCard, hasSsn }
//! }
//!
//! sabchat_conversations.customAttrs.churnRisk     = f32 in [0.0, 1.0]
//! sabchat_conversations.customAttrs.lastSentiment = "positive"|"negative"|"neutral"
//! ```
//!
//! ## Classifier
//!
//! The HTTP layer is decoupled from the model via the
//! [`Classifier`](classifier::Classifier) trait. The default
//! [`StubClassifier`](classifier::StubClassifier) ships keyword
//! heuristics + regex PII detection so the slice is self-contained; an
//! LLM-backed implementation can swap in via
//! [`make_classifier_from_env`](classifier::make_classifier_from_env)
//! without touching handlers.
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. The two mutating endpoints scope the loaded message /
//! conversation by `tenantId == auth.tenant_id` so a cross-tenant id
//! lookup 404s.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`SabChatAiSentimentState`] bundle (Mongo handle + classifier), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod classifier;
pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;

pub use classifier::{
    Classification, Classifier, PiiFlags, Sentiment, StubClassifier, make_classifier_from_env,
};
pub use state::SabChatAiSentimentState;

/// Build the SabChat AI sentiment router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/ai/sentiment`):
///
/// ```text
/// POST /classify        — stateless text classification
/// POST /message         — classify + persist on one message
/// POST /conversation    — classify + persist last 10 visitor messages,
///                         update conversation churnRisk + lastSentiment
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatAiSentimentState`] bundle and the JWT verifier config; both
/// are pulled via [`FromRef`] so the router does not have to know about
/// a concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAiSentimentState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/classify", post(handlers::classify))
        .route("/message", post(handlers::classify_message))
        .route("/conversation", post(handlers::classify_conversation))
}
