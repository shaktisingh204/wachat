//! HS256 JWT verification.
//!
//! Strict validation rules:
//! - Algorithm: HS256 only.
//! - `iss` must equal `"sabnode-bff"`.
//! - `exp` is validated by `jsonwebtoken` automatically.

use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, errors::ErrorKind};

use crate::{claims::Claims, error::AuthError};

/// Expected issuer. Mirrored in `src/lib/jwt-for-rust.ts`.
pub const EXPECTED_ISSUER: &str = "sabnode-bff";

/// Verify a bearer token against the shared HS256 secret.
///
/// Returns the decoded [`Claims`] on success, or a typed [`AuthError`] that
/// the HTTP layer can translate into a 401 response.
pub fn verify(token: &str, secret: &[u8]) -> Result<Claims, AuthError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&[EXPECTED_ISSUER]);
    // `exp` is required + validated by default; we want `iat` to also exist.
    validation.set_required_spec_claims(&["exp", "iss", "sub"]);

    let key = DecodingKey::from_secret(secret);

    decode::<Claims>(token, &key, &validation)
        .map(|data| data.claims)
        .map_err(|e| match e.kind() {
            ErrorKind::ExpiredSignature => AuthError::Expired,
            ErrorKind::InvalidIssuer => AuthError::BadIssuer,
            ErrorKind::InvalidSignature => AuthError::BadSignature,
            ErrorKind::InvalidToken
            | ErrorKind::Base64(_)
            | ErrorKind::Json(_)
            | ErrorKind::Utf8(_) => AuthError::Malformed,
            _ => AuthError::Malformed,
        })
}
