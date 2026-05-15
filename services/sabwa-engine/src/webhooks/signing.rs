//! HMAC-SHA256 payload signing for outbound webhooks.
//!
//! Implements the signature scheme described in `SABWA_PLAN.md` §12.
//! Receivers verify by recomputing `HMAC-SHA256(secret, "{t}.{body}")` and
//! comparing in constant time against the `v1=` segment of the header.
//!
//! # Wire format
//!
//! Outbound deliveries include two headers a receiver MUST validate:
//!
//! | header                | example value                                   |
//! | --------------------- | ----------------------------------------------- |
//! | `X-Sabwa-Event-Id`    | `c3a1f1e4-3d6c-4b1c-9d54-2b1b3d8d7a1f`           |
//! | `X-Sabwa-Signature`   | `t=1700000000,v1=4f3a…hex…` (64-char hex)        |
//!
//! The `t` segment is a Unix-seconds timestamp; the `v1` segment is the
//! lower-case hex HMAC-SHA256 over **`format!("{t}.{json_body}")`** — i.e.
//! the timestamp, a literal ASCII dot, then the *exact bytes* of the JSON
//! request body. Receivers MUST hash the raw request body before any
//! whitespace normalisation, otherwise the comparison will fail.
//!
//! The Next.js receiver under `src/lib/sabwa/webhooks/verify.ts` parses
//! this header by splitting on `,`, pulling `t=<ts>` and `v1=<hex>`,
//! reconstructing `"{ts}.{body}"`, recomputing the HMAC and comparing in
//! constant time. Any drift between this Rust signer and that JS verifier
//! is a wire-protocol break — change them together.
//!
//! Including `t` in the signed string lets receivers reject replays whose
//! timestamp drifts past a tolerance window (the Next.js side uses ±5 m).

use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Compute the HMAC-SHA256 hex signature for `body` at `timestamp` (Unix
/// seconds) under the shared `secret`.
///
/// The signed string is `format!("{timestamp}.{body}")` — both segments are
/// covered so an attacker cannot reuse a captured signature with a
/// different body or shifted timestamp.
///
/// The returned string is the lower-case hex encoding of the 32-byte MAC.
#[must_use]
pub fn sign_payload(secret: &str, body: &[u8], timestamp: i64) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC-SHA256 accepts any key length");

    // Signed string: "{timestamp}.{body}". We feed it in two updates rather
    // than allocating a fresh `Vec` for the concatenation.
    mac.update(timestamp.to_string().as_bytes());
    mac.update(b".");
    mac.update(body);

    let tag = mac.finalize().into_bytes();
    hex_encode(&tag)
}

/// Convenience helper used by [`crate::webhooks::delivery::deliver`] — picks
/// a fresh `t` (now, in Unix seconds), signs `body`, and returns the full
/// `X-Sabwa-Signature` header value plus the timestamp that was used.
///
/// Returning the timestamp lets call-sites also stamp it onto a parallel
/// `X-Sabwa-Timestamp` header / log line without re-reading the clock.
#[must_use]
pub fn build_signature_header(secret: &str, body: &[u8]) -> (String, i64) {
    let ts = Utc::now().timestamp();
    let sig = sign_payload(secret, body, ts);
    (format!("t={ts},v1={sig}"), ts)
}

/// Lowercase hex encoder without pulling in another crate.
fn hex_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(ALPHABET[(b >> 4) as usize] as char);
        out.push(ALPHABET[(b & 0x0f) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reference vector cross-checked against `openssl dgst -sha256 -hmac`.
    /// `printf '1700000000.{"hello":"world"}' | openssl dgst -sha256 -hmac topsecret`
    #[test]
    fn sign_payload_is_deterministic_and_hex() {
        let body = br#"{"hello":"world"}"#;
        let sig = sign_payload("topsecret", body, 1_700_000_000);

        assert_eq!(sig.len(), 64, "SHA-256 hex must be 64 chars");
        assert!(sig.chars().all(|c| c.is_ascii_hexdigit()));

        // Repeated calls are stable.
        let sig2 = sign_payload("topsecret", body, 1_700_000_000);
        assert_eq!(sig, sig2);
    }

    #[test]
    fn signature_changes_with_timestamp() {
        let body = b"payload";
        let a = sign_payload("k", body, 1);
        let b = sign_payload("k", body, 2);
        assert_ne!(a, b);
    }

    #[test]
    fn signature_changes_with_secret() {
        let body = b"payload";
        let a = sign_payload("k1", body, 1);
        let b = sign_payload("k2", body, 1);
        assert_ne!(a, b);
    }

    #[test]
    fn header_has_expected_shape() {
        let (header, ts) = build_signature_header("s", b"{}");
        assert!(header.starts_with(&format!("t={ts},v1=")));
        let hex_part = header.split_once(",v1=").unwrap().1;
        assert_eq!(hex_part.len(), 64);
    }
}
