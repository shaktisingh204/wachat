//! Signed tracking-token codec.
//!
//! Open / click tracking URLs embed a base64url payload signed with
//! HMAC-SHA256. The signing key is read once at module-load from the
//! `EMAIL_TRACKING_SECRET` env var.
//!
//! ## Wire format
//!
//! ```text
//! <urlsafe_b64(payload_json)>.<hex_hmac_sha256>
//! ```
//!
//! Where `payload_json` is the JSON encoding of [`TrackingPayload`].
//!
//! ## Why HMAC instead of an opaque session id
//!
//! Open / click events are high-volume and per-recipient — we don't
//! want to do a Mongo lookup on every pixel hit just to resolve a
//! session id. HMAC verification is stateless and ~free.

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, Mac};
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Decoded tracking-token payload.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TrackingPayload {
    /// Tenant id (hex ObjectId).
    pub t: String,
    /// Campaign id (hex ObjectId). Empty when not from a campaign
    /// (e.g. transactional sends still record events but never
    /// have a campaign).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub c: String,
    /// Subscriber id (hex ObjectId). Optional — transactional sends
    /// may not have a subscriber row.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub s: String,
    /// Journey id (hex ObjectId). Set when the send originated from
    /// a journey step.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub j: String,
    /// Original click-through URL. Empty for open-pixel tokens.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub u: String,
    /// Subscriber email address; pre-baked so the click/open handler
    /// doesn't need a Mongo lookup to log the row.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub e: String,
}

/// Encode a tracking payload into a wire token.
///
/// `secret` is the shared signing key; in production it comes from
/// `EMAIL_TRACKING_SECRET` and is loaded by [`load_secret`].
pub fn encode(secret: &[u8], payload: &TrackingPayload) -> Result<String> {
    let body =
        serde_json::to_vec(payload).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let body_b64 = URL_SAFE_NO_PAD.encode(&body);
    let sig = sign(secret, body_b64.as_bytes());
    Ok(format!("{body_b64}.{sig}"))
}

/// Verify a token and return the decoded payload, or
/// [`ApiError::Unauthorized`] if the signature is wrong.
pub fn decode(secret: &[u8], token: &str) -> Result<TrackingPayload> {
    let (body_b64, sig) = token
        .split_once('.')
        .ok_or_else(|| ApiError::BadRequest("malformed tracking token".to_owned()))?;

    let expected = sign(secret, body_b64.as_bytes());
    if !constant_time_eq(expected.as_bytes(), sig.as_bytes()) {
        return Err(ApiError::Unauthorized(
            "invalid tracking signature".to_owned(),
        ));
    }

    let bytes = URL_SAFE_NO_PAD
        .decode(body_b64.as_bytes())
        .map_err(|e| ApiError::BadRequest(format!("invalid base64 in tracking token: {e}")))?;
    serde_json::from_slice(&bytes).map_err(|e| ApiError::BadRequest(format!("invalid token: {e}")))
}

fn sign(secret: &[u8], msg: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret).expect("HMAC accepts any key size");
    mac.update(msg);
    hex::encode(mac.finalize().into_bytes())
}

/// Constant-time compare to avoid leaking the signature byte-by-byte.
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

/// Read the shared signing key from `EMAIL_TRACKING_SECRET`.
///
/// Returns a 32-byte zero key when the env var is missing **only** so
/// that local-dev `cargo check` and unit tests don't require the
/// secret to be set. Production deployments must set the env var or
/// every signature verification will return `Unauthorized` (because
/// the issuer side will have a different key).
pub fn load_secret() -> Vec<u8> {
    std::env::var("EMAIL_TRACKING_SECRET")
        .map(|s| s.into_bytes())
        .unwrap_or_else(|_| vec![0u8; 32])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_open_token() {
        let secret = b"unit-test-secret";
        let payload = TrackingPayload {
            t: "tenant-1".into(),
            c: "campaign-1".into(),
            s: "sub-1".into(),
            j: String::new(),
            u: String::new(),
            e: "user@example.com".into(),
        };
        let token = encode(secret, &payload).unwrap();
        let decoded = decode(secret, &token).unwrap();
        assert_eq!(decoded, payload);
    }

    #[test]
    fn tampered_token_rejected() {
        let secret = b"unit-test-secret";
        let payload = TrackingPayload {
            t: "tenant-1".into(),
            c: "campaign-1".into(),
            s: "sub-1".into(),
            j: String::new(),
            u: String::new(),
            e: "user@example.com".into(),
        };
        let token = encode(secret, &payload).unwrap();
        // Flip the last hex char of the signature.
        let (head, tail) = token.rsplit_once('.').unwrap();
        let mut bad_sig = tail.to_owned();
        let last = bad_sig.pop().unwrap();
        bad_sig.push(if last == 'a' { 'b' } else { 'a' });
        let bad = format!("{head}.{bad_sig}");
        assert!(decode(secret, &bad).is_err());
    }
}
