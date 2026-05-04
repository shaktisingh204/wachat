//! Core HMAC-SHA256 verifier for Meta `X-Hub-Signature-256` headers.
//!
//! ```text
//! header := "sha256=" hex_lower(HMAC_SHA256(app_secret, raw_body))
//! ```
//!
//! The Node receiver this crate ports lives at
//! `src/app/api/webhooks/meta/route.ts`; it reads the env var
//! `FACEBOOK_APP_SECRET` and verifies via `crypto.timingSafeEqual`. We
//! mirror that here with [`subtle::ConstantTimeEq`].

use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

use crate::error::VerifyError;

type HmacSha256 = Hmac<Sha256>;

/// Stateless verifier holding only the app secret bytes.
///
/// Cheap to clone-by-`Arc` and share across requests — there is no
/// internal state, no I/O, and no allocation per request beyond the
/// 32-byte HMAC scratch buffer.
#[derive(Clone)]
pub struct WebhookVerifier {
    app_secret: Vec<u8>,
}

impl std::fmt::Debug for WebhookVerifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Never print the secret. Length is fine — useful for "did we
        // even load the env var" diagnostics.
        f.debug_struct("WebhookVerifier")
            .field("app_secret_len", &self.app_secret.len())
            .finish()
    }
}

impl WebhookVerifier {
    /// Construct a verifier from the Meta app secret.
    ///
    /// Pass the raw secret bytes — typically `std::env::var("FACEBOOK_APP_SECRET")?.into_bytes()`.
    pub fn new(app_secret: impl Into<Vec<u8>>) -> Self {
        Self {
            app_secret: app_secret.into(),
        }
    }

    /// Verify a `X-Hub-Signature-256` header against the raw request body.
    ///
    /// `signature_header` is the *full* header value, including the
    /// `sha256=` prefix. `raw_body` MUST be the bytes Meta posted —
    /// not a re-serialized JSON value.
    ///
    /// Errors are typed; map via `From<VerifyError> for ApiError` to
    /// land on `401 Unauthorized` with a generic message.
    pub fn verify(&self, signature_header: &str, raw_body: &[u8]) -> Result<(), VerifyError> {
        // 1. Strip the prefix. Meta sends lowercase `sha256=` per spec;
        //    we also accept any ASCII case in case a proxy normalises it
        //    (the prefix is metadata, not part of the signed material).
        let hex_part = strip_sha256_prefix(signature_header).ok_or(VerifyError::BadFormat)?;

        // 2. Hex-decode the digest.
        let received = hex::decode(hex_part).map_err(|_| VerifyError::BadHex)?;

        // 3. Compute HMAC-SHA256(app_secret, raw_body).
        //    `new_from_slice` only fails if the key length is invalid for
        //    the algorithm — HMAC accepts arbitrary key lengths, so this
        //    is infallible in practice. We surface it as `BadFormat`
        //    rather than panicking to keep `verify` total.
        let mut mac =
            HmacSha256::new_from_slice(&self.app_secret).map_err(|_| VerifyError::BadFormat)?;
        mac.update(raw_body);
        let expected = mac.finalize().into_bytes();

        // 4. Constant-time compare. We MUST NOT use `==` on the byte
        //    slices: that is a textbook timing-side-channel. `subtle`
        //    returns a `Choice` (1/0) which we lift to `bool` only at
        //    the very end.
        //
        //    We also short-circuit on length mismatch — leaking *length*
        //    is fine because the algorithm's output length (32 bytes for
        //    SHA-256) is public.
        if expected.len() != received.len() {
            return Err(VerifyError::SignatureMismatch);
        }

        let eq: bool = expected.as_slice().ct_eq(received.as_slice()).into();
        if eq {
            Ok(())
        } else {
            Err(VerifyError::SignatureMismatch)
        }
    }
}

/// Accept `sha256=` in any ASCII case and return the trailing hex slice.
///
/// Returns `None` if the input does not start with the prefix or the
/// prefix is followed by an empty payload.
fn strip_sha256_prefix(s: &str) -> Option<&str> {
    // Manual case-insensitive prefix match avoids allocating a lowercase
    // copy of (potentially attacker-supplied) header bytes.
    const PREFIX: &str = "sha256=";
    if s.len() < PREFIX.len() {
        return None;
    }
    let (head, rest) = s.split_at(PREFIX.len());
    if !head.eq_ignore_ascii_case(PREFIX) {
        return None;
    }
    if rest.is_empty() {
        return None;
    }
    Some(rest)
}
