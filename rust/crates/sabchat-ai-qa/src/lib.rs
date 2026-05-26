//! # sabchat-ai-qa
//!
//! Phase — axum router that adds **automated quality-assurance grading**
//! on top of the SabChat conversation log. Mounted under
//! `/v1/sabchat/ai/qa` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/ai/qa",
//!     sabchat_ai_qa::router::<AppState>(),
//! )
//! ```
//!
//! ## What QA is, in one paragraph
//!
//! Every conversation that closes can be auto-graded against a
//! tenant-defined **rubric** (a weighted criteria list — typically
//! greeting, empathy, resolution, upsell). The handler loads the
//! conversation + the last 50 messages, hands them to a pluggable
//! [`Grader`](grader::Grader), persists a `sabchat_qa_scores` document
//! with `gradedBy: "ai"` (or `"agent"` for the manual path), and uses
//! the persisted rows to drive a per-agent leaderboard. Coaching notes
//! the grader emits are stored alongside the score so support managers
//! can drill into low-scoring chats.
//!
//! ## Endpoints
//!
//! | HTTP                                              | Handler                                      |
//! |---------------------------------------------------|----------------------------------------------|
//! | `POST   /rubrics`                                 | [`handlers::create_rubric`]                  |
//! | `GET    /rubrics`                                 | [`handlers::list_rubrics`]                   |
//! | `GET    /rubrics/{id}`                            | [`handlers::get_rubric`]                     |
//! | `PATCH  /rubrics/{id}`                            | [`handlers::update_rubric`]                  |
//! | `DELETE /rubrics/{id}`                            | [`handlers::delete_rubric`]                  |
//! | `POST   /grade/{conversationId}`                  | [`handlers::grade_conversation`]             |
//! | `POST   /manual/{conversationId}`                 | [`handlers::manual_grade_conversation`]      |
//! | `GET    /scores`                                  | [`handlers::list_scores`]                    |
//! | `GET    /scores/{id}`                             | [`handlers::get_score`]                      |
//! | `GET    /leaderboard`                             | [`handlers::leaderboard`]                    |
//!
//! ## Collections
//!
//! ```text
//! sabchat_qa_rubrics = {
//!   _id, tenantId, name,
//!   criteria: [{ key, label, weight }],
//!   active, createdAt, updatedAt,
//! }
//!
//! sabchat_qa_scores = {
//!   _id, tenantId, conversationId, rubricId,
//!   scores: [{ key, score, notes? }],
//!   total, max,
//!   coaching?,
//!   gradedBy: "agent" | "ai",
//!   gradedAt,
//!   // denormalised for leaderboard joins:
//!   agentId?, inboxId?,
//! }
//! ```
//!
//! ## Tenancy
//!
//! Every read + write is scoped by `tenantId == auth.tenant_id`. A
//! rubric, conversation, or score that exists under a different tenant
//! looks indistinguishable from "not found" to the caller.
//!
//! ## Grader plug-point
//!
//! The HTTP layer is decoupled from the model via the
//! [`Grader`](grader::Grader) trait. The default
//! [`StubGrader`](grader::StubGrader) returns a flat `0.7` per criterion
//! + a generic coaching note so the whole slice is exercisable without
//! an upstream provider. An LLM-backed grader can swap in via
//! [`make_grader_from_env`](grader::make_grader_from_env) without
//! touching handlers.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`SabChatAiQaState`] bundle (Mongo handle + grader), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod grader;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use grader::{GradeResult, Grader, GraderMessage, Rubric, RubricCriterion, StubGrader,
    make_grader_from_env};
pub use state::SabChatAiQaState;

/// Build the SabChat AI QA router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/ai/qa`):
///
/// ```text
/// POST   /rubrics                       — create rubric
/// GET    /rubrics                       — list rubrics (tenant-scoped)
/// GET    /rubrics/{id}                  — get one
/// PATCH  /rubrics/{id}                  — partial update
/// DELETE /rubrics/{id}                  — delete
///
/// POST   /grade/{conversationId}        — AI auto-grade
/// POST   /manual/{conversationId}       — agent-submitted manual grade
///
/// GET    /scores                        — filtered + cursor-paginated
/// GET    /scores/{id}                   — single score
/// GET    /leaderboard                   — per-agent mean total
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatAiQaState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** the literal segments `/grade`, `/manual`,
/// `/scores`, `/leaderboard`, `/rubrics` all live at distinct prefixes
/// so there is no `/{id}` ambiguity at the router root.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAiQaState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- rubrics ---------------------------------------------------
        .route(
            "/rubrics",
            post(handlers::create_rubric).get(handlers::list_rubrics),
        )
        .route(
            "/rubrics/{id}",
            get(handlers::get_rubric)
                .patch(handlers::update_rubric)
                .delete(handlers::delete_rubric),
        )
        // ---- grading ---------------------------------------------------
        .route(
            "/grade/{conversation_id}",
            post(handlers::grade_conversation),
        )
        .route(
            "/manual/{conversation_id}",
            post(handlers::manual_grade_conversation),
        )
        // ---- score retrieval -------------------------------------------
        .route("/scores", get(handlers::list_scores))
        .route("/scores/{id}", get(handlers::get_score))
        // ---- leaderboard -----------------------------------------------
        .route("/leaderboard", get(handlers::leaderboard))
}
