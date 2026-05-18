//! Shared Slack request-signature verification used by all three Slack
//! trigger variants (`slackTrigger`, `slackSlashCommandTrigger`,
//! `slackEventsApiTrigger`).
//!
//! Slack signs every request with HMAC-SHA256 over the string
//! `v0:{X-Slack-Request-Timestamp}:{raw_body}` using the app's
//! `signingSecret`. The result, hex-encoded and prefixed with `v0=`, is sent
//! as the `X-Slack-Signature` header.
//!
//! The HTTP receiver (outside this crate) is responsible for performing this
//! verification on the wire. When it forwards the request to the engine it
//! attaches a `__sabflow_meta` blob to `trigger_data` with the three
//! verification inputs so the trigger node can re-verify defensively:
//!
//! ```json
//! {
//!   "__sabflow_meta": {
//!     "slack_signature": "v0=abc123...",
//!     "slack_timestamp": "1716489600",
//!     "raw_body": "token=...&command=..."
//!   }
//! }
//! ```
//!
//! If the meta blob is absent we treat the request as pre-verified by the
//! receiver and skip the second check.

use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::Sha256;

use crate::error::{NodeError, NodeResult};

/// Maximum allowed clock skew between Slack and the receiver. Slack itself
/// recommends rejecting requests older than 5 minutes.
const MAX_SKEW_SECS: i64 = 5 * 60;

/// Inputs needed to verify a single Slack request.
#[derive(Debug, Clone)]
pub struct SignatureMeta {
    pub signature: String,
    pub timestamp: String,
    pub raw_body: String,
}

impl SignatureMeta {
    /// Pull the meta blob the HTTP receiver attached to `trigger_data`. Returns
    /// `None` if any of the three required fields is missing.
    pub fn from_trigger(trigger: &Value) -> Option<Self> {
        let meta = trigger.get("__sabflow_meta")?;
        let signature = meta.get("slack_signature").and_then(|v| v.as_str())?;
        let timestamp = meta.get("slack_timestamp").and_then(|v| v.as_str())?;
        let raw_body = meta.get("raw_body").and_then(|v| v.as_str())?;
        Some(Self {
            signature: signature.to_string(),
            timestamp: timestamp.to_string(),
            raw_body: raw_body.to_string(),
        })
    }
}

/// HMAC-SHA256 verify a Slack request against the given signing secret.
///
/// Returns `Ok(())` on success, `Err(NodeError::AuthError)` on mismatch, stale
/// timestamp, or malformed inputs.
pub fn verify_slack_signature(signing_secret: &str, meta: &SignatureMeta) -> NodeResult<()> {
    // Reject obvious replays.
    let ts: i64 = meta.timestamp.parse().map_err(|_| {
        NodeError::AuthError("invalid X-Slack-Request-Timestamp".into())
    })?;
    let now = chrono::Utc::now().timestamp();
    if (now - ts).abs() > MAX_SKEW_SECS {
        return Err(NodeError::AuthError(
            "Slack request timestamp outside allowed skew (5 minutes)".into(),
        ));
    }

    // Compute v0=hex(HMAC-SHA256(secret, "v0:{ts}:{body}")).
    let basestring = format!("v0:{}:{}", meta.timestamp, meta.raw_body);
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(signing_secret.as_bytes())
        .map_err(|e| NodeError::AuthError(format!("invalid signing secret: {e}")))?;
    mac.update(basestring.as_bytes());
    let digest = mac.finalize().into_bytes();
    let expected = format!("v0={}", hex_encode(&digest));

    // Constant-time-ish compare. The `hmac` crate's `Mac::verify_slice`
    // requires raw bytes; we already have the wire-format `v0=...` strings,
    // so do a length-equal byte compare manually.
    if !constant_time_eq(expected.as_bytes(), meta.signature.as_bytes()) {
        return Err(NodeError::AuthError(
            "Slack signature does not match (HMAC mismatch)".into(),
        ));
    }
    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sign(secret: &str, ts: &str, body: &str) -> String {
        let basestring = format!("v0:{ts}:{body}");
        let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(basestring.as_bytes());
        format!("v0={}", hex_encode(&mac.finalize().into_bytes()))
    }

    #[test]
    fn signature_round_trip() {
        let secret = "shh-its-a-secret";
        let ts = chrono::Utc::now().timestamp().to_string();
        let body = "token=xoxb&command=/deploy&text=prod";
        let sig = sign(secret, &ts, body);
        let meta = SignatureMeta {
            signature: sig,
            timestamp: ts,
            raw_body: body.to_string(),
        };
        assert!(verify_slack_signature(secret, &meta).is_ok());
    }

    #[test]
    fn rejects_tampered_body() {
        let secret = "shh-its-a-secret";
        let ts = chrono::Utc::now().timestamp().to_string();
        let body = "token=xoxb&command=/deploy&text=prod";
        let sig = sign(secret, &ts, body);
        let meta = SignatureMeta {
            signature: sig,
            timestamp: ts,
            raw_body: "token=xoxb&command=/deploy&text=staging".to_string(),
        };
        assert!(verify_slack_signature(secret, &meta).is_err());
    }

    #[test]
    fn rejects_old_timestamp() {
        let secret = "shh";
        let ts = (chrono::Utc::now().timestamp() - 10 * 60).to_string();
        let body = "x=1";
        let sig = sign(secret, &ts, body);
        let meta = SignatureMeta {
            signature: sig,
            timestamp: ts,
            raw_body: body.to_string(),
        };
        assert!(verify_slack_signature(secret, &meta).is_err());
    }
}
