//! State slice consumed by the SabChat AI QA router.
//!
//! Bundles the Mongo handle (for rubric admin, conversation/message
//! lookup, and score persistence) together with a shared
//! [`Grader`](crate::grader::Grader) implementation. The grader is held
//! behind an `Arc<dyn Grader>` so handlers stay agnostic of whether the
//! underlying model is the deterministic stub or a remote LLM call.
//!
//! ## Why a separate trait from `LlmClient`?
//!
//! `LlmClient` (in `sabchat-ai-copilot`) is a generic single-shot
//! `(system, user) -> text` interface. QA grading needs **structured**
//! output: one numeric score per rubric criterion plus a coaching note.
//! Squeezing that through `LlmClient` would force every consumer of
//! grading to re-parse a free-form LLM string. A narrower
//! [`Grader`](crate::grader::Grader) trait keeps that parsing inside the
//! grader implementation where it belongs and lets the router treat the
//! result as a typed value.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;

use crate::grader::{Grader, make_grader_from_env};

/// Bundle of handles the AI QA router needs. Cheap to clone — the
/// underlying [`MongoHandle`] is `Arc`-backed and the grader already
/// lives behind an `Arc`.
#[derive(Clone)]
pub struct SabChatAiQaState {
    pub mongo: MongoHandle,
    pub grader: Arc<dyn Grader>,
}

impl SabChatAiQaState {
    /// Build a fresh state bundle. Picks the grader implementation out
    /// of environment configuration via [`make_grader_from_env`] so the
    /// api binary stays decoupled from grader-provider selection.
    pub fn new(mongo: MongoHandle) -> Self {
        Self {
            mongo,
            grader: make_grader_from_env(),
        }
    }

    /// Test / advanced construction — inject a custom grader (for
    /// integration tests, a deterministic fixture, or a future custom
    /// provider). Production code should call [`Self::new`].
    pub fn with_grader(mongo: MongoHandle, grader: Arc<dyn Grader>) -> Self {
        Self { mongo, grader }
    }
}
