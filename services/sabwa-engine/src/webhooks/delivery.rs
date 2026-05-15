//! Single-attempt outbound webhook delivery + retry-policy helpers.
//!
//! A "delivery" is one HTTP POST of a JSON event body to a subscriber URL,
//! signed with the per-webhook shared secret. Each attempt — success or
//! failure — is captured as a [`DeliveryAttempt`] document so the dashboard
//! can render a per-webhook delivery log.
//!
//! Retry cadence (per `SABWA_PLAN.md` §12 — exponential backoff capped at 6
//! attempts total):
//!
//! | attempt # |  delay until next try |
//! | --------: | --------------------- |
//! |     1     | 30 s                  |
//! |     2     | 2 m                   |
//! |     3     | 10 m                  |
//! |     4     | 1 h                   |
//! |     5     | 6 h                   |
//! |     6     | 24 h                  |
//! |  ≥ 7      | give up (`None`)      |

use std::time::Duration;

use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::signing::build_signature_header;

/// Mongo collection name backing [`DeliveryAttempt`].
pub const COLLECTION: &str = "sabwa_webhook_deliveries";

/// Per-attempt timeout for the outbound HTTP POST. Chosen short enough not
/// to back the dispatcher up but long enough to forgive a slow receiver.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// One delivery attempt of a webhook event.
///
/// Persisted to `sabwa_webhook_deliveries` so the UI can render a per-hook
/// history. The document is append-only — retries produce *new* records
/// (each with an incremented `attempt_n`) rather than mutating the
/// previous one.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryAttempt {
    /// Unique attempt id (UUIDv4 hex). Distinct from `event_id`.
    pub id: String,
    /// `_id` of the `sabwa_webhooks` document this attempt belongs to,
    /// serialised as a string so this struct stays Mongo-agnostic.
    pub webhook_id: String,
    /// UUID of the originating event — multiple attempts of the same event
    /// share this id so the dashboard can group them.
    pub event_id: String,
    /// The URL the POST was sent to (captured for audit trails).
    pub url: String,
    /// HTTP status code returned by the receiver, or `0` on transport
    /// failure (e.g. timeout, DNS error).
    pub status_code: u16,
    /// First ~1 KiB of the response body, lossily decoded as UTF-8.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_body_excerpt: Option<String>,
    /// 1-indexed attempt counter (1 = first try, 2 = first retry, …).
    pub attempt_n: u32,
    /// Reqwest-level error message, if the request itself failed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// When this attempt was sent (server clock).
    pub sent_at: DateTime<Utc>,
}

impl DeliveryAttempt {
    /// Construct a fresh attempt record for `webhook_id` / `event_id`.
    pub fn new(webhook_id: impl Into<String>, event_id: impl Into<String>, url: impl Into<String>, attempt_n: u32) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            webhook_id: webhook_id.into(),
            event_id: event_id.into(),
            url: url.into(),
            status_code: 0,
            response_body_excerpt: None,
            attempt_n,
            error: None,
            sent_at: Utc::now(),
        }
    }

    /// Insert this attempt record into `sabwa_webhook_deliveries`.
    ///
    /// Best-effort from the dispatcher's perspective: callers should log
    /// the error rather than bubble it, because the underlying HTTP
    /// delivery has already happened and losing the audit row is strictly
    /// less bad than crashing the dispatcher.
    pub async fn persist(
        db: &mongodb::Database,
        delivery: &DeliveryAttempt,
    ) -> Result<(), anyhow::Error> {
        let col = db.collection::<DeliveryAttempt>(COLLECTION);
        col.insert_one(delivery)
            .await
            .with_context(|| format!("{COLLECTION}.insert"))?;
        Ok(())
    }
}

/// POST `body` to `url`, signed under `secret`, with the standard SabWa
/// headers and a 10s timeout. Returns the HTTP status code on success.
///
/// **Success** is "a response was received" — the caller is responsible for
/// inspecting `code` to decide whether to retry (anything outside `2xx`
/// counts as a failure for retry purposes).
///
/// Headers set:
/// - `Content-Type: application/json`
/// - `X-Sabwa-Event-Id: <event_id>`
/// - `X-Sabwa-Signature: t=<ts>,v1=<hex>` (see [`signing`](super::signing))
pub async fn deliver(
    client: &reqwest::Client,
    url: &str,
    secret: &str,
    event_id: &str,
    body: &serde_json::Value,
) -> Result<u16, anyhow::Error> {
    // Serialise once: the body we hash MUST be byte-identical to the body
    // we POST, otherwise the receiver's HMAC check will fail.
    let body_bytes = serde_json::to_vec(body).context("serialising webhook payload")?;
    let (signature, _ts) = build_signature_header(secret, &body_bytes);

    let resp = client
        .post(url)
        .timeout(REQUEST_TIMEOUT)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header("X-Sabwa-Event-Id", event_id)
        .header("X-Sabwa-Signature", signature)
        .body(body_bytes)
        .send()
        .await
        .with_context(|| format!("POST {url}"))?;

    let status = resp.status().as_u16();
    tracing::debug!(
        target: "sabwa::webhooks::delivery",
        %url,
        event_id,
        status,
        "delivered webhook"
    );
    Ok(status)
}

/// Retry-schedule lookup table.
///
/// Returns the delay until the *next* attempt after a failed attempt #`n`,
/// or `None` once we've exhausted the policy (≥ 7 attempts).
#[must_use]
pub fn next_retry_delay(attempt: u32) -> Option<Duration> {
    match attempt {
        1 => Some(Duration::from_secs(30)),
        2 => Some(Duration::from_secs(2 * 60)),
        3 => Some(Duration::from_secs(10 * 60)),
        4 => Some(Duration::from_secs(60 * 60)),
        5 => Some(Duration::from_secs(6 * 60 * 60)),
        6 => Some(Duration::from_secs(24 * 60 * 60)),
        _ => None,
    }
}

/// Truncate a string at a UTF-8-safe byte boundary, appending an ellipsis
/// marker if anything was dropped. Used to bound `response_body_excerpt`.
pub(super) fn excerpt(body: &str, max_bytes: usize) -> String {
    if body.len() <= max_bytes {
        return body.to_owned();
    }
    let mut end = max_bytes;
    while end > 0 && !body.is_char_boundary(end) {
        end -= 1;
    }
    let mut out = String::with_capacity(end + 1);
    out.push_str(&body[..end]);
    out.push('…');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_schedule_caps_at_six_attempts() {
        assert_eq!(next_retry_delay(1), Some(Duration::from_secs(30)));
        assert_eq!(next_retry_delay(2), Some(Duration::from_secs(120)));
        assert_eq!(next_retry_delay(3), Some(Duration::from_secs(600)));
        assert_eq!(next_retry_delay(4), Some(Duration::from_secs(3_600)));
        assert_eq!(next_retry_delay(5), Some(Duration::from_secs(21_600)));
        assert_eq!(next_retry_delay(6), Some(Duration::from_secs(86_400)));
        assert_eq!(next_retry_delay(7), None);
        assert_eq!(next_retry_delay(100), None);
    }

    #[test]
    fn excerpt_truncates_long_bodies() {
        let big = "x".repeat(5_000);
        let cut = excerpt(&big, 1_024);
        // 1024 bytes + 3 bytes for the '…' ellipsis (UTF-8).
        assert_eq!(cut.len(), 1_024 + 3);
        assert!(cut.ends_with('…'));
    }

    #[test]
    fn excerpt_passes_short_bodies_through() {
        assert_eq!(excerpt("hi", 1_024), "hi");
    }

    #[test]
    fn excerpt_respects_utf8_boundaries() {
        // "café" — 'é' is two bytes; cutting at 3 would split it.
        let s = "café";
        let cut = excerpt(s, 3);
        assert!(cut.ends_with('…'));
        // The pre-ellipsis prefix must still be valid UTF-8.
        let prefix = cut.trim_end_matches('…');
        assert!(prefix.chars().all(|c| c == 'c' || c == 'a' || c == 'f'));
    }

    #[test]
    fn attempt_new_assigns_fresh_uuid() {
        let a = DeliveryAttempt::new("wh1", "ev1", "https://x", 1);
        let b = DeliveryAttempt::new("wh1", "ev1", "https://x", 1);
        assert_ne!(a.id, b.id);
        assert_eq!(a.attempt_n, 1);
        assert_eq!(a.status_code, 0);
    }
}
