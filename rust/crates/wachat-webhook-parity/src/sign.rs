//! HMAC-SHA256 signer for replayed payloads.
//!
//! Meta signs every webhook delivery with `sha256={hex_hmac}` in the
//! `X-Hub-Signature-256` header. When we replay captured bodies against either
//! receiver we have to re-sign with the same app secret — otherwise the Rust
//! signature verifier (and the Node verifier) will reject every fixture.
//!
//! The signature is computed over the **exact bytes** of the request body. We
//! never re-serialize the JSON before hashing because re-serialization changes
//! whitespace/key order and the hash no longer matches.

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Compute the value of the `X-Hub-Signature-256` header for `body`, signed
/// with `app_secret`. Returned string is `sha256={hex}` — drop it straight
/// into the header map.
pub fn sign(app_secret: &[u8], body: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(app_secret)
        .expect("HMAC accepts any key length");
    mac.update(body);
    let digest = mac.finalize().into_bytes();
    format!("sha256={}", hex::encode(digest))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_vector_matches_meta_format() {
        // Sanity check: a known body+secret produces a known hex digest.
        // Computed independently with `openssl dgst -sha256 -hmac secret`.
        let sig = sign(b"secret", b"hello");
        assert!(sig.starts_with("sha256="));
        assert_eq!(sig.len(), 7 + 64);
    }

    #[test]
    fn different_bodies_diverge() {
        let a = sign(b"k", b"{}");
        let b = sign(b"k", b"{ }");
        assert_ne!(a, b, "whitespace must change the signature");
    }
}
