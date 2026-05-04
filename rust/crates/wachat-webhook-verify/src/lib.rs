//! # wachat-webhook-verify
//!
//! HMAC-SHA256 verification of Meta WhatsApp webhook signatures.
//!
//! Meta signs every webhook delivery with the app secret and ships the
//! resulting digest in the `X-Hub-Signature-256` header, formatted as:
//!
//! ```text
//! X-Hub-Signature-256: sha256=<hex_lower>
//! ```
//!
//! The receiver MUST compute `HMAC_SHA256(app_secret, raw_body)` and
//! compare the result to the header value in **constant time**. The raw
//! body must be captured *before* JSON deserialization — re-serializing
//! a parsed payload changes whitespace / key order and invalidates the
//! signature.
//!
//! This crate is intentionally tiny and pure:
//!
//! * [`verifier::WebhookVerifier`] — stateless HMAC verifier.
//! * [`error::VerifyError`] — typed failure modes, mapping cleanly to
//!   `sabnode_common::ApiError::Unauthorized`.
//! * [`extractor::VerifiedBody`] — axum extractor that pulls the header,
//!   reads the raw body, runs `verify`, and yields the bytes for the
//!   handler to deserialize.
//! * [`replay::ReplayGuard`] — optional timestamp window check. Meta
//!   does **not** ship a timestamp header for WhatsApp webhooks today,
//!   but receivers occasionally derive one from `entry[].time`; this
//!   helper is here for that case.
//!
//! See `tests/verify.rs` for the table-driven test matrix.

pub mod error;
pub mod extractor;
pub mod replay;
pub mod verifier;

pub use error::VerifyError;
pub use extractor::VerifiedBody;
pub use replay::ReplayGuard;
pub use verifier::WebhookVerifier;
