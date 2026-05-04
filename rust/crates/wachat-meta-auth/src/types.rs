//! Domain types for Meta access tokens.
//!
//! The on-disk shape (BSON) intentionally mirrors the field names used by the
//! legacy Next.js code on the `projects` collection (`wabaId`, `accessToken`,
//! ...), so the Rust service can read and write the same documents during the
//! migration. See [`crate::store`] for the read/write logic.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Classification of an access token. Drives expiry handling and refresh
/// strategy: system-user tokens are effectively non-expiring, long-lived user
/// tokens last ~60 days, and short-lived user tokens last ~1 hour.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenType {
    /// Business-system-user token — recommended for production server-to-server
    /// calls. Effectively non-expiring.
    SystemUser,
    /// Short-lived user access token (~1 hour). Should be exchanged for a
    /// long-lived token before storing.
    UserAccess,
    /// Long-lived user access token (~60 days). Refreshed via
    /// `fb_exchange_token`.
    LongLivedUser,
}

/// A persisted Meta access token plus the WhatsApp Business Account it
/// authorizes and the phone numbers attached to that WABA.
///
/// Field names map to the legacy `projects` document:
/// - `waba_id` → `wabaId`
/// - `phone_number_ids` → derived from `phoneNumbers[].id`
/// - `access_token` → `accessToken`
/// - `expires_at` → `tokenExpiresAt` (new field, may be absent on old docs)
/// - `created_at` / `updated_at` → `createdAt` / `tokenRefreshedAt` /
///   `updatedAt`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenRecord {
    /// WhatsApp Business Account ID (Meta's `waba_id`).
    pub waba_id: String,

    /// Phone-number IDs attached to this WABA. Mirrors the `id` field of each
    /// item in the legacy `phoneNumbers` array.
    pub phone_number_ids: Vec<String>,

    /// The raw access token. **Never log this in plaintext** —
    /// see [`mask`] for the masking helper used by this crate.
    pub access_token: String,

    /// Token classification — drives refresh strategy.
    pub token_type: TokenType,

    /// Optional expiry. `None` means "non-expiring" (typical for system-user
    /// tokens) or "unknown — never introspected".
    pub expires_at: Option<DateTime<Utc>>,

    /// First write timestamp.
    pub created_at: DateTime<Utc>,

    /// Last write timestamp. Always set to `Utc::now()` on upsert.
    pub updated_at: DateTime<Utc>,
}

/// Mask a token for logging — keeps only the last 4 characters visible. Tokens
/// shorter than 8 characters are fully masked to avoid leaking entire short
/// values.
pub fn mask(token: &str) -> String {
    let len = token.chars().count();
    if len <= 8 {
        return "*".repeat(len);
    }
    let tail: String = token.chars().skip(len.saturating_sub(4)).collect();
    format!("{}{tail}", "*".repeat(len - 4))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mask_keeps_last_four_for_long_tokens() {
        let masked = mask("EAAGm0PX4ZCpsBO1234abcd");
        assert!(masked.ends_with("abcd"));
        assert!(!masked.contains("EAAG"));
        assert_eq!(
            masked.chars().count(),
            "EAAGm0PX4ZCpsBO1234abcd".chars().count()
        );
    }

    #[test]
    fn mask_fully_redacts_short_tokens() {
        assert_eq!(mask("short"), "*****");
        assert_eq!(mask("12345678"), "********");
    }
}
