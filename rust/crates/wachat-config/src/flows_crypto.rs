//! Isolated RSA keygen for WhatsApp Flows data-exchange encryption.
//!
//! This module is the ONLY place in the crate that touches the `rsa`/`rand`
//! crates. The WhatsApp Flows endpoint (`/api/wachat/flows/endpoint/:pnid` on
//! the Next.js side) decrypts Meta's request envelope with **RSA-OAEP
//! (SHA-256)** using a private key stored on the project document, then signs
//! the AES session. Meta is given the matching **public key** via the
//! `whatsapp_business_encryption` Graph edge.
//!
//! Key formats (must match `src/lib/crypto/flows-cipher.ts`):
//! * Private key → **PKCS#8 PEM** (`-----BEGIN PRIVATE KEY-----`). Node's
//!   `crypto.privateDecrypt({ key, padding: RSA_PKCS1_OAEP_PADDING,
//!   oaepHash: 'sha256' }, …)` accepts PKCS#8 directly.
//! * Public key → **SPKI PEM** (`-----BEGIN PUBLIC KEY-----`). This is exactly
//!   what Meta's `business_public_key` field expects.
//!
//! Keygen NEVER panics: every fallible step maps into `ApiError` so an
//! unconfigured / low-entropy host degrades into a typed error instead of a
//! crash.

use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey, LineEnding};
use rsa::{RsaPrivateKey, RsaPublicKey};
use sabnode_common::{ApiError, Result};
use tracing::instrument;

/// Modulus size Meta requires for Flows encryption.
const RSA_BITS: usize = 2048;

/// A freshly-generated RSA-2048 keypair, both halves as PEM strings.
pub struct FlowsKeyPair {
    /// PKCS#8 PEM — stored (privately) on the project doc.
    pub private_key_pem: String,
    /// SPKI PEM — returned to the caller and uploaded to Meta.
    pub public_key_pem: String,
}

/// Generate a fresh RSA-2048 keypair and PEM-encode both halves.
///
/// All failures (entropy exhaustion on `RsaPrivateKey::new`, PEM encoding)
/// are surfaced as `ApiError::Internal` — there is no `unwrap`/`expect` on
/// any keygen result.
#[instrument(skip_all)]
pub fn generate_keypair() -> Result<FlowsKeyPair> {
    let mut rng = rand::rngs::OsRng;

    let private_key = RsaPrivateKey::new(&mut rng, RSA_BITS)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("rsa.keygen")))?;
    let public_key = RsaPublicKey::from(&private_key);

    let private_key_pem = private_key
        .to_pkcs8_pem(LineEnding::LF)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("rsa.private_pem")))?
        .to_string();

    let public_key_pem = public_key
        .to_public_key_pem(LineEnding::LF)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("rsa.public_pem")))?;

    Ok(FlowsKeyPair {
        private_key_pem,
        public_key_pem,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_valid_pem_pair() {
        let kp = generate_keypair().expect("keygen should succeed on a normal host");
        assert!(kp.private_key_pem.contains("BEGIN PRIVATE KEY"));
        assert!(kp.public_key_pem.contains("BEGIN PUBLIC KEY"));
        // Round-trip parse the public PEM to prove it's well-formed SPKI.
        use rsa::pkcs8::DecodePublicKey;
        RsaPublicKey::from_public_key_pem(&kp.public_key_pem)
            .expect("emitted public PEM must parse back as SPKI");
    }
}
