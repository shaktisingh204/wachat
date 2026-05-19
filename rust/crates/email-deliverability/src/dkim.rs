//! DKIM keypair generation.
//!
//! Generates an RSA keypair and returns:
//!
//!   1. The private key as a PEM-encoded PKCS#8 string (what a signer
//!      like rspamd / OpenDKIM / a managed provider expects).
//!   2. The TXT record value to publish at
//!      `{selector}._domainkey.{domain}` — `v=DKIM1; k=rsa; p=<base64>`
//!      with the SubjectPublicKeyInfo DER, base64-encoded the way DKIM
//!      requires (single line, standard alphabet, no whitespace).
//!
//! Key sizes are normalised to 1024 or 2048 — Mailchimp / Gmail accept
//! both, and the larger size is the default.

use base64::Engine;
use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey, LineEnding};
use rsa::{RsaPrivateKey, RsaPublicKey};

/// Default RSA bit size for new DKIM keys. 2048 is the modern standard;
/// 1024 is still accepted for backwards compatibility with very old
/// resolvers but is no longer recommended.
pub const DEFAULT_DKIM_BITS: usize = 2048;

/// Generate an RSA keypair sized to `bits` and return
/// `(private_pkcs8_pem, dns_txt_record_value, normalised_bits)`.
///
/// `bits` is clamped to `{1024, 2048}` — any other value is rounded up
/// to 2048 because the lower sizes have been deprecated by major
/// receivers.
pub fn generate_dkim_keypair(bits: usize) -> anyhow::Result<(String, String, u32)> {
    let normalised = match bits {
        1024 => 1024usize,
        _ => 2048usize,
    };

    let mut rng = rand::thread_rng();
    let private = RsaPrivateKey::new(&mut rng, normalised)?;
    let public = RsaPublicKey::from(&private);

    let private_pem = private.to_pkcs8_pem(LineEnding::LF)?.to_string();

    // DKIM expects the SubjectPublicKeyInfo (SPKI) DER bytes, base64-
    // encoded as a single line with the standard alphabet. PEM's
    // `to_public_key_der()` gives us exactly the SPKI DER.
    let spki_der = public.to_public_key_der()?;
    let p = base64::engine::general_purpose::STANDARD.encode(spki_der.as_bytes());

    let dns_record = format!("v=DKIM1; k=rsa; p={p}");
    Ok((private_pem, dns_record, normalised as u32))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_2048_by_default() {
        let (pem, dns, bits) = generate_dkim_keypair(0).expect("keypair");
        assert!(pem.starts_with("-----BEGIN PRIVATE KEY-----"));
        assert!(dns.starts_with("v=DKIM1"));
        assert!(dns.contains("p="));
        assert_eq!(bits, 2048);
    }

    #[test]
    fn honours_1024() {
        let (_, _, bits) = generate_dkim_keypair(1024).expect("keypair");
        assert_eq!(bits, 1024);
    }
}
