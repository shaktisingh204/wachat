//! Classifier abstraction + keyword / regex stub implementation.
//!
//! The HTTP layer never speaks directly to a model. Every handler
//! receives an `Arc<dyn Classifier>` via [`crate::state`] and calls
//! [`Classifier::classify`] on the message text. That keeps the slice
//! self-contained today (the [`StubClassifier`] ships keyword heuristics
//! good enough for the inbox demo) while leaving room for an LLM-backed
//! implementation tomorrow — drop a new struct that impls
//! [`Classifier`], wire it in [`make_classifier_from_env`], done.
//!
//! ## Shape on the wire
//!
//! [`Classification`] is the serde shape persisted under
//! `provider_metadata.classification` on each message and returned
//! verbatim from `POST /classify`. Field renames follow the project-wide
//! camelCase convention.
//!
//! ## Stub behaviour
//!
//! [`StubClassifier`] implements the contract with:
//!
//! - **Sentiment**: token-count of positive (`thanks`, `great`, `love`)
//!   vs negative (`angry`, `refund`, `broken`) keywords. Net positive ⇒
//!   `positive`, net negative ⇒ `negative`, tie ⇒ `neutral`. The score
//!   is the absolute magnitude clamped into `[0.0, 1.0]`.
//! - **Intent**: cheap keyword mapping (`refund` ⇒ `complaint`,
//!   `price` / `pricing` / `cost` ⇒ `pricing`, `help` ⇒ `support`,
//!   `?` present ⇒ `question`).
//! - **Topic**: same idea, broader buckets.
//! - **PII**: pre-compiled regex over email / phone (E.164-ish) /
//!   credit-card (13-19 digits with optional separators) / US SSN
//!   (`NNN-NN-NNNN`).

use std::sync::Arc;

use async_trait::async_trait;
use regex::Regex;
use serde::{Deserialize, Serialize};

/// Tri-valued sentiment bucket. Serialises lowercase for parity with the
/// rest of the SabChat enums.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Sentiment {
    Positive,
    Negative,
    Neutral,
}

impl Sentiment {
    /// Lowercase string form used for `customAttrs.lastSentiment` and
    /// for compact log lines.
    pub fn as_str(&self) -> &'static str {
        match self {
            Sentiment::Positive => "positive",
            Sentiment::Negative => "negative",
            Sentiment::Neutral => "neutral",
        }
    }
}

/// PII presence flags. Booleans only — exact captured spans are
/// intentionally **not** persisted (we don't want to mirror plaintext
/// secrets into the analytics doc).
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PiiFlags {
    pub has_email: bool,
    pub has_phone: bool,
    pub has_card: bool,
    pub has_ssn: bool,
}

/// Full classification record. Persisted under
/// `provider_metadata.classification` on `sabchat_messages` and returned
/// verbatim by `POST /classify`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Classification {
    /// Bucketed sentiment.
    pub sentiment: Sentiment,
    /// Confidence-ish magnitude in `[0.0, 1.0]`. For the stub this is the
    /// normalised difference between positive and negative token counts.
    pub score: f32,
    /// Best-guess intent label (`question`, `complaint`, `pricing`, …).
    /// `None` when no rule fired.
    #[serde(default)]
    pub intent: Option<String>,
    /// Best-guess topic label (`billing`, `support`, `product`, …).
    /// `None` when no rule fired.
    #[serde(default)]
    pub topic: Option<String>,
    /// PII presence flags.
    pub pii: PiiFlags,
}

/// Classifier abstraction. Implementations must be `Send + Sync` so they
/// can live behind an `Arc` in the router state.
#[async_trait]
pub trait Classifier: Send + Sync {
    /// Classify a single chunk of text. Implementations may run
    /// synchronously, hit an embedded model, or call out over the
    /// network — the signature is `async` so any of those compose.
    async fn classify(&self, text: &str) -> anyhow::Result<Classification>;
}

// ---------------------------------------------------------------------------
// Stub classifier
// ---------------------------------------------------------------------------

/// Keyword + regex classifier. Used by default so the slice runs without
/// any external dependency. Cheap to clone and safe to share across
/// requests.
pub struct StubClassifier {
    email_re: Regex,
    phone_re: Regex,
    card_re: Regex,
    ssn_re: Regex,
}

/// Positive-sentiment seed tokens (lower-case match).
const POSITIVE_KEYWORDS: &[&str] = &[
    "thanks", "thank", "great", "love", "awesome", "perfect", "excellent", "happy",
];
/// Negative-sentiment seed tokens (lower-case match).
const NEGATIVE_KEYWORDS: &[&str] = &[
    "angry", "refund", "broken", "terrible", "awful", "hate", "bad", "worst", "cancel",
];

impl StubClassifier {
    /// Build a new stub. The regex patterns are pre-compiled so each
    /// `classify` call is allocation-free on the PII side.
    pub fn new() -> Self {
        // `expect` here is fine: these literals are validated at crate
        // build time, and failing fast at startup beats per-request
        // unwrapping.
        let email_re = Regex::new(r"(?i)[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}")
            .expect("email regex compiles");
        // E.164-ish: optional `+`, 7-15 digits, with optional spaces /
        // dashes between groups of 2-4.
        let phone_re = Regex::new(r"(?:\+?\d[\d\-\s().]{6,}\d)")
            .expect("phone regex compiles");
        // 13-19 digit card numbers with optional separators (we don't
        // Luhn-check — the goal is "did the user paste a card?", not
        // validation).
        let card_re = Regex::new(r"\b(?:\d[ \-]?){12,18}\d\b")
            .expect("card regex compiles");
        // US SSN: NNN-NN-NNNN, optional spaces.
        let ssn_re = Regex::new(r"\b\d{3}[\-\s]?\d{2}[\-\s]?\d{4}\b")
            .expect("ssn regex compiles");

        Self {
            email_re,
            phone_re,
            card_re,
            ssn_re,
        }
    }

    /// Detect PII via the pre-compiled regex set. Pure CPU; never errs.
    fn detect_pii(&self, text: &str) -> PiiFlags {
        PiiFlags {
            has_email: self.email_re.is_match(text),
            has_phone: self.phone_re.is_match(text),
            has_card: self.card_re.is_match(text),
            has_ssn: self.ssn_re.is_match(text),
        }
    }

    /// Token-frequency sentiment scoring. Returns `(bucket, score)`.
    fn score_sentiment(text_lower: &str) -> (Sentiment, f32) {
        // Count occurrences via `matches` rather than `contains` so a
        // long rant with multiple negative words moves the needle.
        let pos: usize = POSITIVE_KEYWORDS
            .iter()
            .map(|kw| count_word(text_lower, kw))
            .sum();
        let neg: usize = NEGATIVE_KEYWORDS
            .iter()
            .map(|kw| count_word(text_lower, kw))
            .sum();

        if pos == 0 && neg == 0 {
            return (Sentiment::Neutral, 0.0);
        }

        let diff = pos as i32 - neg as i32;
        let denom = (pos + neg).max(1) as f32;
        // Magnitude scaled into `[0, 1]`. We multiply by ~0.5 so a single
        // strong keyword doesn't pin the score at 1.0; multiple matches
        // saturate naturally.
        let raw = (diff as f32 / denom).abs();
        let score = (raw.clamp(0.0, 1.0) * (denom / (denom + 1.0))).min(1.0);

        if diff > 0 {
            (Sentiment::Positive, score)
        } else if diff < 0 {
            (Sentiment::Negative, score)
        } else {
            (Sentiment::Neutral, 0.0)
        }
    }

    /// Cheap keyword → intent mapping.
    fn detect_intent(text_lower: &str) -> Option<String> {
        if text_lower.contains("refund") || text_lower.contains("cancel") {
            return Some("complaint".to_owned());
        }
        if text_lower.contains("price")
            || text_lower.contains("pricing")
            || text_lower.contains("cost")
            || text_lower.contains("plan")
        {
            return Some("pricing".to_owned());
        }
        if text_lower.contains("help") || text_lower.contains("support") {
            return Some("support".to_owned());
        }
        if text_lower.contains('?') {
            return Some("question".to_owned());
        }
        None
    }

    /// Cheap keyword → topic mapping. Disjoint from intent so the inbox
    /// can render both at once.
    fn detect_topic(text_lower: &str) -> Option<String> {
        if text_lower.contains("invoice")
            || text_lower.contains("billing")
            || text_lower.contains("payment")
            || text_lower.contains("charge")
        {
            return Some("billing".to_owned());
        }
        if text_lower.contains("bug")
            || text_lower.contains("error")
            || text_lower.contains("broken")
            || text_lower.contains("crash")
        {
            return Some("bug".to_owned());
        }
        if text_lower.contains("feature") || text_lower.contains("request") {
            return Some("feature_request".to_owned());
        }
        if text_lower.contains("login")
            || text_lower.contains("password")
            || text_lower.contains("account")
        {
            return Some("account".to_owned());
        }
        None
    }
}

impl Default for StubClassifier {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Classifier for StubClassifier {
    async fn classify(&self, text: &str) -> anyhow::Result<Classification> {
        let lower = text.to_lowercase();
        let (sentiment, score) = Self::score_sentiment(&lower);
        let intent = Self::detect_intent(&lower);
        let topic = Self::detect_topic(&lower);
        let pii = self.detect_pii(text);

        Ok(Classification {
            sentiment,
            score,
            intent,
            topic,
            pii,
        })
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/// Build the classifier the router should use, reading optional
/// environment hints.
///
/// Today the slice only ships the keyword stub, so this is a one-liner.
/// The factory exists so an upstream LLM-backed implementation can be
/// selected via `SABCHAT_AI_CLASSIFIER=openai` (or similar) without
/// touching the router wiring. Until that lands, the function is total
/// and returns the stub unconditionally.
pub fn make_classifier_from_env() -> Arc<dyn Classifier> {
    Arc::new(StubClassifier::new())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Count whole-word occurrences of `needle` inside `haystack`. Both
/// arguments are expected to be lowercase. Used by sentiment scoring so
/// `"thanks"` matches `"thanks!"` but not `"thanksgiving"`.
fn count_word(haystack: &str, needle: &str) -> usize {
    if needle.is_empty() {
        return 0;
    }
    let mut count = 0;
    let bytes = haystack.as_bytes();
    let nlen = needle.len();
    let mut i = 0;
    while let Some(pos) = haystack[i..].find(needle) {
        let start = i + pos;
        let end = start + nlen;
        let prev_ok = start == 0
            || !bytes[start - 1].is_ascii_alphanumeric();
        let next_ok = end == bytes.len()
            || !bytes[end].is_ascii_alphanumeric();
        if prev_ok && next_ok {
            count += 1;
        }
        i = end;
        if i >= haystack.len() {
            break;
        }
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn stub_positive_path() {
        let c = StubClassifier::new();
        let out = c.classify("Thanks, this is great!").await.unwrap();
        assert_eq!(out.sentiment, Sentiment::Positive);
        assert!(out.score > 0.0);
    }

    #[tokio::test]
    async fn stub_negative_path() {
        let c = StubClassifier::new();
        let out = c.classify("I want a refund, this is broken").await.unwrap();
        assert_eq!(out.sentiment, Sentiment::Negative);
        assert_eq!(out.intent.as_deref(), Some("complaint"));
    }

    #[tokio::test]
    async fn stub_pii_email_and_phone() {
        let c = StubClassifier::new();
        let out = c
            .classify("Reach me at foo@example.com or +1 415-555-0199")
            .await
            .unwrap();
        assert!(out.pii.has_email);
        assert!(out.pii.has_phone);
    }

    #[tokio::test]
    async fn stub_pii_card_and_ssn() {
        let c = StubClassifier::new();
        let out = c
            .classify("card 4111 1111 1111 1111 ssn 123-45-6789")
            .await
            .unwrap();
        assert!(out.pii.has_card);
        assert!(out.pii.has_ssn);
    }

    #[test]
    fn count_word_respects_boundaries() {
        assert_eq!(count_word("thanks!", "thanks"), 1);
        assert_eq!(count_word("thanksgiving", "thanks"), 0);
        assert_eq!(count_word("thanks thanks", "thanks"), 2);
    }
}
