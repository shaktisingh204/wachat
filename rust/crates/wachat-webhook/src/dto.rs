//! Query-string DTO for the Meta verification handshake.
//!
//! Meta's GET handshake (https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
//! uses three dotted query parameters that are awkward to spell as Rust
//! identifiers; we rename them via serde and treat the struct as the
//! single source of truth for the verification challenge contract.

use serde::Deserialize;

/// Query parameters Meta sends on `GET /v1/wachat/webhook/meta` during
/// webhook subscription verification.
///
/// Wire shape:
/// ```text
/// ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<nonce>
/// ```
#[derive(Debug, Clone, Deserialize)]
pub struct VerifyQuery {
    /// Always `"subscribe"` for a real Meta verification request. We compare
    /// against the literal string and return `403` for anything else.
    #[serde(rename = "hub.mode")]
    pub hub_mode: String,

    /// Shared secret token configured in the Meta app dashboard. Compared
    /// against `WHATSAPP_VERIFY_TOKEN` (with `META_VERIFY_TOKEN` as a
    /// fallback to match the legacy Node receiver).
    #[serde(rename = "hub.verify_token")]
    pub hub_verify_token: String,

    /// Random nonce Meta wants echoed back as plain text on a successful
    /// match. Treat as opaque — never log it or persist it.
    #[serde(rename = "hub.challenge")]
    pub hub_challenge: String,
}
