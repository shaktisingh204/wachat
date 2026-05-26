//! Clusterer abstraction + keyword-bucket stub implementation.
//!
//! The HTTP layer never speaks to a model directly. Every handler
//! receives an `Arc<dyn Clusterer>` via [`crate::state`] and calls
//! [`Clusterer::cluster`] on a batch of visitor message texts. That
//! keeps the slice self-contained today (the [`StubClusterer`] ships
//! keyword bucketing good enough for the inbox demo) while leaving room
//! for an embedding / k-means / LLM implementation tomorrow — drop a
//! new struct that impls [`Clusterer`], wire it in
//! [`make_clusterer_from_env`], done.
//!
//! ## Shape on the wire
//!
//! [`Cluster`] is the in-memory return type the handlers consume. Each
//! cluster carries its display label, a small sample of representative
//! example texts (used as `examples` on the persisted topic doc), the
//! list of input indices that landed in this bucket (used by the
//! handler to compute `messageCount` and `lastSeenAt`), and a sentiment
//! skew in `[-1.0, 1.0]` (positive = happier, negative = angrier).
//!
//! ## Stub behaviour
//!
//! [`StubClusterer`] runs a naive keyword scan against a small
//! dictionary:
//!
//! | Bucket          | Trigger tokens (case-insensitive)                  |
//! |-----------------|----------------------------------------------------|
//! | `refund`        | refund, money back, chargeback                     |
//! | `billing`       | invoice, billing, charge, payment, subscription    |
//! | `shipping`      | shipping, delivery, tracking, courier, parcel      |
//! | `bug`           | bug, error, broken, crash, glitch, doesn't work    |
//! | `feature`       | feature, request, suggestion, wish, would be nice  |
//! | `pricing`       | price, pricing, cost, plan, quote                  |
//! | `other`         | anything that didn't match the above               |
//!
//! Each message lands in **at most one** bucket (first match wins, in
//! the order above). The `other` bucket lumps unmatched messages.
//! `sentiment_skew` defaults to `0.0` — downstream slices can refine it
//! once real classification is wired through.

use std::sync::Arc;

use async_trait::async_trait;

/// One emitted cluster. Returned by [`Clusterer::cluster`] and consumed
/// by the run handler to populate `sabchat_voc_topics`.
#[derive(Debug, Clone)]
pub struct Cluster {
    /// Display label — used as `label` on the persisted topic doc.
    pub label: String,
    /// Up to a handful of representative example strings, used by the
    /// inbox UI for "show me what this cluster is about". The handler
    /// trims these to a bounded length before persistence.
    pub examples: Vec<String>,
    /// Indices into the input `texts` slice that landed in this
    /// cluster. Used by the handler to compute `messageCount` and to
    /// align cluster output with the source messages without
    /// re-allocating.
    pub indices: Vec<usize>,
    /// Sentiment skew in `[-1.0, 1.0]`. Positive = happier, negative =
    /// angrier. The stub returns 0.0; embedding-backed implementations
    /// can fold a sentiment classifier in here.
    pub sentiment_skew: f32,
}

/// Clusterer abstraction. Implementations must be `Send + Sync` so they
/// can live behind an `Arc` in the router state.
#[async_trait]
pub trait Clusterer: Send + Sync {
    /// Cluster a batch of texts into topics. Implementations may run
    /// synchronously, hit an embedded model, or call out over the
    /// network — the signature is `async` so any of those compose.
    async fn cluster(&self, texts: &[String]) -> anyhow::Result<Vec<Cluster>>;
}

// ---------------------------------------------------------------------------
// Stub clusterer — keyword bucketing
// ---------------------------------------------------------------------------

/// Naive keyword-bucket clusterer. Used by default so the slice runs
/// without any external dependency. Cheap to clone and safe to share
/// across requests.
pub struct StubClusterer;

/// Ordered list of (bucket label, trigger keywords). Order matters —
/// the first matching bucket wins so we put the most specific buckets
/// (refund > billing) before the broader ones.
const BUCKETS: &[(&str, &[&str])] = &[
    ("refund", &["refund", "money back", "chargeback"]),
    (
        "billing",
        &["invoice", "billing", "charge", "payment", "subscription"],
    ),
    (
        "shipping",
        &["shipping", "delivery", "tracking", "courier", "parcel"],
    ),
    (
        "bug",
        &[
            "bug",
            "error",
            "broken",
            "crash",
            "glitch",
            "doesn't work",
            "not working",
        ],
    ),
    (
        "feature",
        &["feature", "request", "suggestion", "wish", "would be nice"],
    ),
    ("pricing", &["price", "pricing", "cost", "plan", "quote"]),
];

/// The "other" bucket gets every message that didn't match any of the
/// named buckets above. Kept as a named constant so the handler and the
/// stub agree on the spelling.
const OTHER_LABEL: &str = "other";

/// Max number of example strings retained per cluster. Each example is
/// also truncated to [`EXAMPLE_MAX_CHARS`] characters so the persisted
/// topic doc stays small.
const EXAMPLES_PER_CLUSTER: usize = 5;

/// Max characters per example string. The inbox UI shows these as
/// chips — long quotes hurt readability and bloat the topic doc.
const EXAMPLE_MAX_CHARS: usize = 200;

impl StubClusterer {
    /// Build a new stub. Stateless — included for symmetry with the
    /// sibling sentiment crate's `StubClassifier::new`.
    pub fn new() -> Self {
        Self
    }

    /// Decide which bucket label a single text belongs in. Returns the
    /// `other` label if nothing matched.
    fn bucket_for(text_lower: &str) -> &'static str {
        for (label, keywords) in BUCKETS {
            for kw in *keywords {
                if text_lower.contains(kw) {
                    return label;
                }
            }
        }
        OTHER_LABEL
    }
}

impl Default for StubClusterer {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Clusterer for StubClusterer {
    async fn cluster(&self, texts: &[String]) -> anyhow::Result<Vec<Cluster>> {
        // Lay out a stable result ordering by walking BUCKETS in order
        // and emitting "other" last. We index into `slots` by bucket
        // label so a single pass over `texts` populates everything.
        //
        // Capacity = named buckets + 1 for the "other" bucket.
        let total = BUCKETS.len() + 1;
        let mut indices_by_label: Vec<(&'static str, Vec<usize>)> = Vec::with_capacity(total);
        for (label, _) in BUCKETS {
            indices_by_label.push((*label, Vec::new()));
        }
        indices_by_label.push((OTHER_LABEL, Vec::new()));

        for (i, text) in texts.iter().enumerate() {
            if text.trim().is_empty() {
                continue;
            }
            let lower = text.to_lowercase();
            let label = Self::bucket_for(&lower);
            // Linear find — buckets is small (7 entries today) so a
            // hash map would be slower in practice.
            if let Some(slot) = indices_by_label.iter_mut().find(|(l, _)| *l == label) {
                slot.1.push(i);
            }
        }

        // Convert filled slots into `Cluster`s. Empty buckets are
        // dropped so the caller never persists a zero-count topic.
        let mut clusters = Vec::with_capacity(indices_by_label.len());
        for (label, indices) in indices_by_label {
            if indices.is_empty() {
                continue;
            }
            let examples = indices
                .iter()
                .take(EXAMPLES_PER_CLUSTER)
                .map(|&i| truncate_chars(&texts[i], EXAMPLE_MAX_CHARS))
                .collect();
            clusters.push(Cluster {
                label: label.to_owned(),
                examples,
                indices,
                sentiment_skew: 0.0,
            });
        }

        Ok(clusters)
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/// Build the clusterer the router should use, reading optional
/// environment hints.
///
/// Today the slice only ships the keyword stub, so this is a one-liner.
/// The factory exists so an upstream embedding-backed implementation
/// can be selected via `SABCHAT_AI_CLUSTERER=openai` (or similar)
/// without touching the router wiring. Until that lands, the function
/// is total and returns the stub unconditionally.
pub fn make_clusterer_from_env() -> Arc<dyn Clusterer> {
    Arc::new(StubClusterer::new())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Truncate `s` to at most `max_chars` characters, appending `…` when
/// the original was longer. Operates on `char` indices (not bytes) so
/// multi-byte UTF-8 input doesn't get sliced mid-codepoint.
fn truncate_chars(s: &str, max_chars: usize) -> String {
    let mut out = String::with_capacity(s.len().min(max_chars * 4));
    let mut count = 0;
    for c in s.chars() {
        if count >= max_chars {
            out.push('…');
            return out;
        }
        out.push(c);
        count += 1;
    }
    out
}

/// Expose the named bucket labels (excluding `other`) so the messages-
/// sampling handler can derive a regex from a topic label. Kept in this
/// module so the dictionary stays a single source of truth.
pub(crate) fn keywords_for_label(label: &str) -> Option<&'static [&'static str]> {
    BUCKETS
        .iter()
        .find(|(l, _)| *l == label)
        .map(|(_, kws)| *kws)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn stub_assigns_known_buckets() {
        let c = StubClusterer::new();
        let texts = vec![
            "Please give me a refund".to_owned(),
            "Found a bug, the page crashed".to_owned(),
            "Could you add a feature for export?".to_owned(),
            "Random hello, no keywords here".to_owned(),
        ];
        let out = c.cluster(&texts).await.unwrap();
        let labels: Vec<&str> = out.iter().map(|c| c.label.as_str()).collect();
        assert!(labels.contains(&"refund"));
        assert!(labels.contains(&"bug"));
        assert!(labels.contains(&"feature"));
        assert!(labels.contains(&"other"));
    }

    #[tokio::test]
    async fn stub_skips_empty_inputs() {
        let c = StubClusterer::new();
        let texts = vec!["".to_owned(), "   ".to_owned()];
        let out = c.cluster(&texts).await.unwrap();
        assert!(out.is_empty(), "empty inputs must not produce clusters");
    }

    #[test]
    fn truncate_respects_char_boundaries() {
        assert_eq!(truncate_chars("hello", 10), "hello");
        assert_eq!(truncate_chars("hello world", 5), "hello…");
        // Multi-byte codepoint must not split.
        assert_eq!(truncate_chars("héllo", 4), "héll…");
    }

    #[test]
    fn keywords_lookup_known_label() {
        assert!(keywords_for_label("refund").is_some());
        assert!(keywords_for_label("nonexistent").is_none());
        assert!(keywords_for_label(OTHER_LABEL).is_none());
    }
}
