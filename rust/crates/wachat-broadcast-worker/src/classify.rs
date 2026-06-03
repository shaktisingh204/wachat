//! Meta Cloud API error classifier.
//!
//! Direct port of the `PERMANENT_CODES` / `RATE_LIMIT_CODES` sets and the
//! `classifyError` helper from
//! `src/workers/broadcast/send-message.js` (lines 24-53 + 205-215). The
//! classifier decides whether a per-contact send failure should:
//!
//!   * `Permanent`  — give up immediately, mark the contact `FAILED`.
//!   * `RateLimit`  — back off and retry the contact later.
//!   * `Transient`  — short retry, treated like a network blip.
//!
//! The Node send worker maps these classes onto its retry / re-enqueue
//! decisions; the Rust port mirrors the same mapping in `send.rs`.

use std::collections::HashSet;
use std::sync::OnceLock;

/// Classification outcome of a Meta API failure. Variants match the Node
/// strings exactly so logs / metrics built against either side compare
/// cleanly.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    /// Caller should never succeed — mark FAILED, do not retry.
    Permanent,
    /// We are being throttled — back off the whole batch by
    /// `retry_after_ms` and re-enqueue the affected contacts.
    RateLimit,
    /// Transient blip — retry the contact (subject to MAX_RETRIES).
    Transient,
}

impl ErrorKind {
    /// Human-readable tag, kept identical to the Node strings so cross-
    /// language metrics line up.
    pub fn as_str(self) -> &'static str {
        match self {
            ErrorKind::Permanent => "PERMANENT",
            ErrorKind::RateLimit => "RATE_LIMIT",
            ErrorKind::Transient => "TRANSIENT",
        }
    }
}

/// Meta Cloud API error codes that mean "this contact will never succeed".
/// Sourced from
/// <https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes>.
/// MUST stay in sync with `PERMANENT_CODES` in
/// `src/workers/broadcast/send-message.js`.
pub fn permanent_codes() -> &'static HashSet<i64> {
    static SET: OnceLock<HashSet<i64>> = OnceLock::new();
    SET.get_or_init(|| {
        [
            100,    // Invalid parameter
            131000, // Generic user error
            131008, // Required parameter missing
            131009, // Parameter value invalid
            131026, // Receiver not on WhatsApp / message undeliverable
            131047, // Re-engagement message (24h window expired)
            131051, // Unsupported message type
            131058, // Media too large
            132000, // Template name does not exist
            132001, // Template language does not exist
            132005, // Translated text too long
            132007, // Character policy violated
            132012, // Parameter format mismatch
            132015, // Template paused
            132016, // Template disabled
            132068, // Flow blocked
            132069, // Flow throttled (treated as permanent — fix the flow, not the broadcast)
            133000, // Re-registration needed
        ]
        .into_iter()
        .collect()
    })
}

/// Meta Cloud API error codes that indicate throughput throttling. MUST
/// stay in sync with `RATE_LIMIT_CODES` in `send-message.js`.
pub fn rate_limit_codes() -> &'static HashSet<i64> {
    static SET: OnceLock<HashSet<i64>> = OnceLock::new();
    SET.get_or_init(|| {
        [
            4,      // Application request limit reached
            17,     // User request limit reached
            368,    // Temporarily blocked for policies
            80007,  // Rate limit issues
            130429, // Throughput limit
            131048, // Spam rate limit hit
            131056, // Pair rate limit hit
        ]
        .into_iter()
        .collect()
    })
}

/// Classify a Meta API failure given the HTTP status code and the optional
/// `error.code` from the response body. Mirrors the Node `classifyError`:
///
///   * if the API code is in `PERMANENT_CODES` → `Permanent`,
///   * else if the API code is in `RATE_LIMIT_CODES` → `RateLimit`,
///   * else if status `429` → `RateLimit`,
///   * else if status >= 500 → `Transient`,
///   * else if status >= 400 → `Permanent`,
///   * otherwise → `Transient`.
pub fn classify_error(status_code: u16, api_error_code: Option<i64>) -> ErrorKind {
    if let Some(code) = api_error_code {
        if permanent_codes().contains(&code) {
            return ErrorKind::Permanent;
        }
        if rate_limit_codes().contains(&code) {
            return ErrorKind::RateLimit;
        }
    }
    if status_code == 429 {
        return ErrorKind::RateLimit;
    }
    if status_code >= 500 {
        return ErrorKind::Transient;
    }
    if status_code >= 400 {
        return ErrorKind::Permanent;
    }
    ErrorKind::Transient
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permanent_code_wins_over_status() {
        // 500 would normally be transient, but a permanent meta code
        // overrides the status.
        assert_eq!(classify_error(500, Some(131026)), ErrorKind::Permanent);
    }

    #[test]
    fn rate_limit_code_wins_over_status() {
        assert_eq!(classify_error(400, Some(80007)), ErrorKind::RateLimit);
    }

    #[test]
    fn status_429_is_rate_limit() {
        assert_eq!(classify_error(429, None), ErrorKind::RateLimit);
    }

    #[test]
    fn status_5xx_is_transient() {
        assert_eq!(classify_error(503, None), ErrorKind::Transient);
    }

    #[test]
    fn status_4xx_is_permanent() {
        assert_eq!(classify_error(400, None), ErrorKind::Permanent);
    }

    #[test]
    fn no_status_is_transient() {
        // Network errors mapped to status 0 → transient.
        assert_eq!(classify_error(0, None), ErrorKind::Transient);
    }
}
