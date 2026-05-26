//! Pluggable conversation **grader**.
//!
//! The grader is responsible for turning a `(rubric, recent messages)`
//! pair into a structured score: one numeric value per criterion plus a
//! short coaching note for the agent. The HTTP handler then persists
//! that score into `sabchat_qa_scores`.
//!
//! Design notes:
//!
//! * **Narrower than `LlmClient`** — see `crate::state` for the
//!   rationale. We do not want to force every caller to re-parse a
//!   free-form LLM string into a structured score.
//! * **Object-safe** — the trait is held as `Arc<dyn Grader>` so
//!   handlers stay agnostic of the underlying implementation.
//! * **Deterministic stub today** — [`StubGrader`] returns a flat `0.7`
//!   per criterion and a generic coaching note so the slice is
//!   exercisable end-to-end before a provider is wired.

use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ===========================================================================
// Rubric (input)
// ===========================================================================

/// One row in a rubric. `key` is the machine identifier the persisted
/// score document references (`scores: [{ key, score }]`); `label` is
/// the human-readable name shown in the UI. `weight` is multiplied
/// against the per-criterion `[0.0, 1.0]` score during totalling, so
/// the totals are comparable across rubrics with different shapes.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RubricCriterion {
    pub key: String,
    pub label: String,
    /// Multiplier applied during totalling. Typical values are `1.0`
    /// (neutral), `0.5` (nice-to-have), or `2.0` (mandatory).
    pub weight: f32,
}

/// Snapshot of the rubric definition the grader receives. The DB model
/// holds extra audit fields (`tenantId`, `createdAt`, …) that the
/// grader does not need — we hand it only the part that affects the
/// scoring decision.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Rubric {
    /// Hex ObjectId of the persisted rubric. Surfaced so future LLM
    /// graders can attribute their decisions in the prompt.
    pub id: String,
    pub name: String,
    pub criteria: Vec<RubricCriterion>,
}

// ===========================================================================
// Message slice (input)
// ===========================================================================

/// Lightweight, serde-friendly view of a message used to build the
/// grader prompt. We could pass the full [`sabchat_types::SabChatMessage`]
/// here, but most fields are irrelevant to a grader and the indirection
/// makes test doubles trivial to construct.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraderMessage {
    /// `"visitor"` | `"agent"` | `"bot"` | `"system"`.
    pub sender_type: String,
    /// Best-effort text extraction. Non-text content blocks are
    /// rendered to a short `[image]` / `[file]` placeholder so the
    /// grader sees the shape without re-implementing content decoding.
    pub text: String,
    /// Was this message a private internal note? Private notes do not
    /// contribute to greeting / empathy / resolution scoring because
    /// the visitor never saw them.
    #[serde(default)]
    pub private: bool,
}

// ===========================================================================
// Grade (output)
// ===========================================================================

/// One numeric score against one criterion. `notes` carries any
/// free-form per-criterion comment the grader chose to emit (for
/// example: "Agent didn't acknowledge the customer's frustration.").
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CriterionScore {
    pub key: String,
    /// Raw score in `[0.0, 1.0]`. The handler multiplies this by the
    /// matching rubric weight to compute the leaderboard total.
    pub score: f32,
    #[serde(default)]
    pub notes: Option<String>,
}

/// Structured grader output.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GradeResult {
    pub scores: Vec<CriterionScore>,
    /// Short free-form note the agent should read after the chat (e.g.
    /// "Great resolution, but try opening with the customer's name").
    #[serde(default)]
    pub coaching: Option<String>,
}

// ===========================================================================
// Trait
// ===========================================================================

/// Pluggable grader trait. One method: `grade(rubric, history)` returns
/// a structured per-criterion score plus optional coaching.
///
/// Implementations must be cheap to clone via `Arc` (we hand the grader
/// out to every request) and safe to call concurrently — every real
/// provider supports a single shared HTTP client behind the scenes.
#[async_trait]
pub trait Grader: Send + Sync {
    async fn grade(
        &self,
        rubric: &Rubric,
        history: &[GraderMessage],
    ) -> anyhow::Result<GradeResult>;
}

// ===========================================================================
// StubGrader — deterministic placeholder
// ===========================================================================

/// Deterministic stub. Returns `0.7` against every criterion plus a
/// generic coaching note so the rest of the QA stack (persistence,
/// leaderboard, UI) can be exercised before a provider is wired.
///
/// `0.7` was chosen so the stub neither passes everything (which would
/// hide bugs in the totalling math) nor fails everything (which would
/// trigger spurious downstream "low score" alerts).
#[derive(Debug, Default, Clone)]
pub struct StubGrader;

impl StubGrader {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Grader for StubGrader {
    async fn grade(
        &self,
        rubric: &Rubric,
        _history: &[GraderMessage],
    ) -> anyhow::Result<GradeResult> {
        let scores = rubric
            .criteria
            .iter()
            .map(|c| CriterionScore {
                key: c.key.clone(),
                score: 0.7,
                notes: None,
            })
            .collect();
        Ok(GradeResult {
            scores,
            coaching: Some(
                "Good baseline. Consider personalising the greeting and confirming \
                 the resolution explicitly before closing."
                    .to_owned(),
            ),
        })
    }
}

// ===========================================================================
// Provider selection
// ===========================================================================

/// Build the grader the QA router will use at runtime.
///
/// Today this unconditionally returns a [`StubGrader`]. When a real
/// LLM-backed grader lands the dispatch will read e.g.
/// `SABCHAT_QA_GRADER_PROVIDER` here and pick an implementation
/// accordingly — the call site in [`crate::state::SabChatAiQaState::new`]
/// does not need to change.
pub fn make_grader_from_env() -> Arc<dyn Grader> {
    Arc::new(StubGrader::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_rubric() -> Rubric {
        Rubric {
            id: "000000000000000000000000".to_owned(),
            name: "default".to_owned(),
            criteria: vec![
                RubricCriterion {
                    key: "greeting".to_owned(),
                    label: "Greeting".to_owned(),
                    weight: 1.0,
                },
                RubricCriterion {
                    key: "empathy".to_owned(),
                    label: "Empathy".to_owned(),
                    weight: 1.0,
                },
            ],
        }
    }

    #[tokio::test]
    async fn stub_grader_scores_every_criterion() {
        let g = StubGrader::new();
        let rubric = sample_rubric();
        let out = g.grade(&rubric, &[]).await.expect("stub never errors");
        assert_eq!(out.scores.len(), 2);
        for s in &out.scores {
            assert!((s.score - 0.7).abs() < f32::EPSILON);
        }
        assert!(out.coaching.is_some());
    }
}
