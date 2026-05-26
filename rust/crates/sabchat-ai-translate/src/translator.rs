//! Translator backend abstraction.
//!
//! The router does not bind to a specific provider — handlers depend on
//! an `Arc<dyn Translator>` resolved at startup. The shipped default is
//! [`StubTranslator`], which echoes the input text back unchanged with
//! `detected_source_lang = "en"` and `model = "stub"`. Production
//! deployments swap in a real provider (OpenAI / DeepL / Google) via
//! [`make_translator_from_env`] without touching this crate.

use std::sync::Arc;

use async_trait::async_trait;
use serde::Serialize;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Wire shapes returned by the translator backend
// ---------------------------------------------------------------------------

/// Result of a single text translation. Mirrors the response body of
/// `POST /text`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TranslateResp {
    /// Translated text in the requested `target` language.
    pub translated: String,
    /// Language the source text was identified as (BCP-47 / ISO 639-1).
    /// Echoes the caller-supplied `source` when present.
    pub detected_source_lang: String,
    /// Stable identifier of the backend that produced the translation
    /// (e.g. `"stub"`, `"openai:gpt-4o"`, `"deepl"`). Persisted on the
    /// message so future reads can tell which engine wrote each entry.
    pub model: String,
}

/// Result of a language-detection call. Mirrors the response body of
/// `POST /detect`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DetectResp {
    /// Detected language code (BCP-47 / ISO 639-1).
    pub lang: String,
    /// Provider confidence in `[0.0, 1.0]`.
    pub confidence: f32,
}

// ---------------------------------------------------------------------------
// Translator trait
// ---------------------------------------------------------------------------

/// Backend-agnostic translation interface. Implementations must be
/// `Send + Sync` so the router can share a single instance across
/// concurrent requests via `Arc<dyn Translator>`.
#[async_trait]
pub trait Translator: Send + Sync {
    /// Translate `text` to the BCP-47 language `target`. `source` is an
    /// optional override; when `None` the backend should detect the
    /// source language and report it back via
    /// [`TranslateResp::detected_source_lang`].
    async fn translate(
        &self,
        text: &str,
        target: &str,
        source: Option<&str>,
    ) -> anyhow::Result<TranslateResp>;

    /// Detect the BCP-47 language of `text` along with a confidence in
    /// `[0.0, 1.0]`.
    async fn detect(&self, text: &str) -> anyhow::Result<DetectResp>;
}

// ---------------------------------------------------------------------------
// Stub backend
// ---------------------------------------------------------------------------

/// Default no-op translator. Returns the input text unchanged with
/// `detected_source_lang = "en"` and `model = "stub"` — useful for
/// local dev, tests, and as a safe default when no provider is wired up
/// in the environment.
#[derive(Debug, Clone, Default)]
pub struct StubTranslator;

impl StubTranslator {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Translator for StubTranslator {
    async fn translate(
        &self,
        text: &str,
        _target: &str,
        source: Option<&str>,
    ) -> anyhow::Result<TranslateResp> {
        Ok(TranslateResp {
            translated: text.to_owned(),
            detected_source_lang: source.unwrap_or("en").to_owned(),
            model: "stub".to_owned(),
        })
    }

    async fn detect(&self, _text: &str) -> anyhow::Result<DetectResp> {
        Ok(DetectResp {
            lang: "en".to_owned(),
            confidence: 1.0,
        })
    }
}

// ---------------------------------------------------------------------------
// Backend factory
// ---------------------------------------------------------------------------

/// Resolve the translator backend from environment variables.
///
/// Today the only shipped backend is [`StubTranslator`] — production
/// providers (OpenAI / DeepL / Google) plug in here behind an
/// `SABCHAT_TRANSLATE_PROVIDER` switch without changing any caller code.
pub fn make_translator_from_env() -> Arc<dyn Translator> {
    Arc::new(StubTranslator::new())
}
