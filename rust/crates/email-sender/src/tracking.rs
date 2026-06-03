//! Click + open tracking helpers.
//!
//! Open tracking embeds a 1x1 transparent GIF whose URL carries a signed
//! token; click tracking rewrites every `href` to a `/v1/email/events/click`
//! URL that records the open and 302-redirects to the original target.
//!
//! Tokens are JSON payloads (`{ c: campaignId, s: subscriberId, t: ts }`)
//! HMAC-SHA256 signed with the worker's `tracking_secret`. We avoid JWT
//! to skip the library dep — this is a one-purpose internal envelope.

use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Token payload baked into the pixel + click URLs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackingClaims {
    /// Hex `ObjectId` of the campaign.
    pub c: String,
    /// Hex `ObjectId` of the subscriber (None for test sends — receivers
    /// of test mail are not subscribers).
    pub s: Option<String>,
    /// Unix-seconds at issue time. Lets us reject pixel requests that
    /// arrive after a (generous) staleness window.
    pub t: i64,
}

/// Sign a claims payload into a `<base64-claims>.<base64-mac>` token.
pub fn sign(secret: &[u8], claims: &TrackingClaims) -> String {
    let payload = serde_json::to_vec(claims).expect("claims serialize");
    let b64 = URL_SAFE_NO_PAD.encode(&payload);
    let mut mac = HmacSha256::new_from_slice(secret).expect("any-length hmac key");
    mac.update(b64.as_bytes());
    let sig = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    format!("{b64}.{sig}")
}

/// Verify and parse a signed token. Returns `None` on signature mismatch
/// or malformed input.
pub fn verify(secret: &[u8], token: &str) -> Option<TrackingClaims> {
    let (b64, sig) = token.split_once('.')?;
    let mut mac = HmacSha256::new_from_slice(secret).ok()?;
    mac.update(b64.as_bytes());
    let want = URL_SAFE_NO_PAD.decode(sig).ok()?;
    mac.verify_slice(&want).ok()?;
    let payload = URL_SAFE_NO_PAD.decode(b64).ok()?;
    serde_json::from_slice(&payload).ok()
}

/// Build the 1x1 open-pixel URL.
pub fn open_pixel_url(
    base_url: &str,
    secret: &[u8],
    campaign_id: &str,
    subscriber_id: Option<&str>,
    now_unix_s: i64,
) -> String {
    let claims = TrackingClaims {
        c: campaign_id.to_owned(),
        s: subscriber_id.map(|s| s.to_owned()),
        t: now_unix_s,
    };
    let token = sign(secret, &claims);
    format!(
        "{}/v1/email/events/open?token={token}",
        base_url.trim_end_matches('/')
    )
}

/// Build a click-tracking wrapper URL for `target`.
pub fn click_wrap_url(
    base_url: &str,
    secret: &[u8],
    campaign_id: &str,
    subscriber_id: Option<&str>,
    now_unix_s: i64,
    target: &str,
) -> String {
    let claims = TrackingClaims {
        c: campaign_id.to_owned(),
        s: subscriber_id.map(|s| s.to_owned()),
        t: now_unix_s,
    };
    let token = sign(secret, &claims);
    let u = urlencoding::encode(target);
    format!(
        "{}/v1/email/events/click?token={token}&u={u}",
        base_url.trim_end_matches('/')
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_verify_roundtrip() {
        let secret = b"super-secret";
        let claims = TrackingClaims {
            c: "abc".to_owned(),
            s: Some("def".to_owned()),
            t: 1_700_000_000,
        };
        let token = sign(secret, &claims);
        let back = verify(secret, &token).expect("verifies");
        assert_eq!(back.c, "abc");
        assert_eq!(back.s.as_deref(), Some("def"));
        assert_eq!(back.t, 1_700_000_000);
    }

    #[test]
    fn verify_rejects_mismatched_secret() {
        let token = sign(
            b"k1",
            &TrackingClaims {
                c: "a".into(),
                s: None,
                t: 0,
            },
        );
        assert!(verify(b"k2", &token).is_none());
    }

    #[test]
    fn open_pixel_url_contains_token() {
        let url = open_pixel_url("https://x.test", b"k", "c1", Some("s1"), 0);
        assert!(url.starts_with("https://x.test/v1/email/events/open?token="));
    }

    #[test]
    fn click_wrap_url_encodes_target() {
        let url = click_wrap_url("https://x.test/", b"k", "c1", None, 0, "https://t/?x=1&y=2");
        assert!(url.contains("&u=https%3A%2F%2Ft%2F%3Fx%3D1%26y%3D2"));
    }
}
