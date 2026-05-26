//! Pluggable LLM client.
//!
//! The copilot does not call OpenAI / Anthropic / Gemini directly — every
//! prompt round-trips through the [`LlmClient`] trait so we can:
//!
//! * Swap providers without touching handler code.
//! * Ship a deterministic [`StubClient`] today (no upstream credentials
//!   wired yet) so the rest of the stack can be exercised end-to-end.
//! * Inject test doubles from integration tests.
//!
//! Provider selection happens in [`make_client_from_env`]; the
//! orchestrating `api` binary calls
//! [`crate::state::SabChatAiCopilotState::new`] which in turn calls this
//! function. The binary itself does **not** need to know about LLM
//! internals.

use std::sync::Arc;

use async_trait::async_trait;

/// One LLM call response. `tokens_in` / `tokens_out` are the model's
/// reported token usage — the stub fakes a plausible count so downstream
/// metering code can exercise the same path it will exercise in prod.
#[derive(Debug, Clone)]
pub struct LlmResp {
    pub text: String,
    pub model: String,
    pub tokens_in: u32,
    pub tokens_out: u32,
}

/// Object-safe LLM trait. One method: `complete(system, user)` returns
/// the model's generated text plus accounting metadata.
///
/// Implementations must be cheap to clone via `Arc` (we hand the client
/// out to every request) and safe to call concurrently — every real
/// provider supports a single shared HTTP client behind the scenes.
#[async_trait]
pub trait LlmClient: Send + Sync {
    /// Single-turn completion. `system` is the system prompt, `user` is
    /// the user turn. Multi-turn history is rendered into `user` by the
    /// caller (see [`crate::prompts`]).
    async fn complete(&self, system: &str, user: &str) -> anyhow::Result<LlmResp>;
}

// ===========================================================================
// StubClient — deterministic placeholder
// ===========================================================================

/// Deterministic stub. Generates a plausible-looking placeholder reply
/// so the agent UI can render a real shape (text, model name, token
/// counts) before we have a provider configured. Replace at the
/// [`make_client_from_env`] seam.
#[derive(Debug, Default, Clone)]
pub struct StubClient {
    /// Model identifier surfaced in the response. Defaults to
    /// `"stub-v0"`; tests can override.
    model: String,
}

impl StubClient {
    /// Build a stub client tagged as `"stub-v0"`.
    pub fn new() -> Self {
        Self {
            model: "stub-v0".to_owned(),
        }
    }

    /// Build a stub client with a custom model identifier (useful when
    /// integration tests want to assert on a specific tag).
    pub fn with_model(model: impl Into<String>) -> Self {
        Self {
            model: model.into(),
        }
    }

    /// Crude approximation of an LLM tokenizer — counts whitespace
    /// separated tokens. Good enough for the stub to return a plausible
    /// number; real provider implementations will report the upstream's
    /// own count.
    fn approx_tokens(s: &str) -> u32 {
        s.split_whitespace().count() as u32
    }
}

#[async_trait]
impl LlmClient for StubClient {
    async fn complete(&self, system: &str, user: &str) -> anyhow::Result<LlmResp> {
        // Deterministic placeholder text. We echo a short preview of the
        // user turn so consumers can sanity-check that the prompt
        // reached the client untouched without needing an upstream
        // dependency.
        let preview: String = user.chars().take(80).collect();
        let text = format!(
            "[stub] suggested response based on the last messages — {preview}",
        );

        let tokens_in = Self::approx_tokens(system) + Self::approx_tokens(user);
        let tokens_out = Self::approx_tokens(&text);

        Ok(LlmResp {
            text,
            model: self.model.clone(),
            tokens_in,
            tokens_out,
        })
    }
}

// ===========================================================================
// Provider selection
// ===========================================================================

/// Build the LLM client the copilot will use at runtime.
///
/// Today this unconditionally returns a [`StubClient`]. When we wire
/// OpenAI / Anthropic / Gemini in a follow-up, the dispatch will read
/// `SABCHAT_LLM_PROVIDER` (and the matching `*_API_KEY`) here and pick
/// an implementation accordingly — the call site in
/// [`crate::state::SabChatAiCopilotState::new`] does not need to change.
pub fn make_client_from_env() -> Arc<dyn LlmClient> {
    Arc::new(StubClient::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn stub_client_returns_deterministic_shape() {
        let client = StubClient::new();
        let resp = client
            .complete("system prompt", "user turn with several words")
            .await
            .expect("stub never errors");
        assert_eq!(resp.model, "stub-v0");
        assert!(resp.text.starts_with("[stub]"));
        assert!(resp.tokens_in > 0);
        assert!(resp.tokens_out > 0);
    }
}
