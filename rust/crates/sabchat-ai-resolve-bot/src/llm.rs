//! Pluggable LLM adapter for the auto-resolve bot.
//!
//! The crate stays provider-agnostic by talking to a single
//! [`Bot`] trait. Today only the [`StubBot`] is wired up — it returns a
//! templated answer with `confidence = 0.4`, which deliberately sits
//! **below** every reasonable threshold so the bot always escalates
//! until a real provider is wired in.
//!
//! When the real adapter lands (Vercel AI Gateway / OpenAI / Anthropic)
//! it implements the same trait and [`make_bot_from_env`] flips over to
//! it based on env vars.

use std::sync::Arc;

use async_trait::async_trait;

use crate::retriever::Retrieval;

/// The bot's reply for a single question + retrieved context.
#[derive(Debug, Clone)]
pub struct BotAnswer {
    /// Drafted reply text (plain text; no markdown is rendered by the
    /// widget today).
    pub text: String,
    /// Self-reported confidence in `[0.0, 1.0]`. The handler compares
    /// this against the per-inbox `confidence_threshold` to decide
    /// whether to post or escalate.
    pub confidence: f32,
    /// Subset of the input `retrievals` the bot actually leaned on.
    /// Mapped back to `AnswerSource` rows on the wire.
    pub used: Vec<Retrieval>,
}

/// Pluggable adapter trait. All methods are async + `Send + Sync` so the
/// concrete bot can be stored as `Arc<dyn Bot>` inside the router state.
#[async_trait]
pub trait Bot: Send + Sync {
    /// Compose an answer from `question` + retrieved context.
    ///
    /// `persona` is the per-inbox bot persona string (free-form;
    /// passed through to the prompt). `max_tokens` is advisory — stub
    /// implementations may ignore it.
    async fn answer(
        &self,
        question: &str,
        retrievals: &[Retrieval],
        persona: Option<&str>,
        max_tokens: Option<u32>,
    ) -> anyhow::Result<BotAnswer>;
}

/// Stub adapter used until a real provider is wired in.
///
/// Returns a templated answer of the form
/// `Based on '{top_title}', {snippet}…` with `confidence = 0.4`. The low
/// confidence guarantees the handler escalates rather than auto-posting
/// — that way nothing the stub says ever reaches a real visitor.
#[derive(Debug, Default, Clone)]
pub struct StubBot;

#[async_trait]
impl Bot for StubBot {
    async fn answer(
        &self,
        question: &str,
        retrievals: &[Retrieval],
        _persona: Option<&str>,
        _max_tokens: Option<u32>,
    ) -> anyhow::Result<BotAnswer> {
        let text = if let Some(top) = retrievals.first() {
            // Trim the snippet a touch so the templated reply doesn't
            // dump the entire article body.
            let snippet: String = top.snippet.chars().take(160).collect();
            format!("Based on '{}', {snippet}…", top.title)
        } else {
            format!(
                "I could not find a clear answer for: \"{}\". A teammate will follow up.",
                question.trim(),
            )
        };

        Ok(BotAnswer {
            text,
            // Deliberately below every reasonable threshold so the
            // stub never auto-posts a real reply.
            confidence: 0.4,
            used: retrievals.to_vec(),
        })
    }
}

/// Construct the configured [`Bot`] adapter from process env.
///
/// Today we always return a [`StubBot`]. When a real provider lands the
/// match arms grow (e.g. `SABCHAT_BOT_PROVIDER=vercel-ai-gateway`); the
/// router never has to learn about provider-specific config.
pub fn make_bot_from_env() -> Arc<dyn Bot> {
    Arc::new(StubBot)
}
