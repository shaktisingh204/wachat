//! Session helpers for the public widget.
//!
//! The widget never sees a SabNode JWT; it is authenticated by an
//! opaque `visitorToken` (32 bytes of CSPRNG output, rendered as 64
//! lowercase hex characters) that we issue from
//! [`crate::handlers::start_session`] and look up on every subsequent
//! request via [`resolve_session`].
//!
//! For embedding logged-in app users the host page can additionally
//! sign the user's external id with the inbox's
//! `channel_config.settings.identity_secret` and send it as
//! `identityHmac`. [`verify_hmac`] checks it in constant time before we
//! trust the supplied `externalUserId`.

use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use rand::RngCore;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use sha2::Sha256;

/// Collection name for ephemeral widget sessions.
pub(crate) const SESSIONS_COLL: &str = "sabchat_widget_sessions";

type HmacSha256 = Hmac<Sha256>;

/// One row in `sabchat_widget_sessions`. Mirrors the shape documented
/// in the slice contract — the widget never sees this struct directly,
/// it just round-trips the `visitor_token` field.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionDoc {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub tenant_id: ObjectId,
    pub inbox_id: ObjectId,
    pub contact_id: ObjectId,
    pub conversation_id: ObjectId,
    pub visitor_token: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub expires_at: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
}

/// Look up the session keyed by `token`. Returns:
///
/// - `ApiError::Unauthorized` if the token is missing / unknown — we
///   collapse "no such token" and "expired token" into the same
///   response so the widget treats both as "your session is gone, get
///   a fresh one";
/// - `ApiError::Internal` on Mongo failure.
pub(crate) async fn resolve_session(
    mongo: &MongoHandle,
    token: &str,
) -> Result<SessionDoc> {
    if token.trim().is_empty() {
        return Err(ApiError::Unauthorized("missing visitor token".to_owned()));
    }

    let coll = mongo.collection::<SessionDoc>(SESSIONS_COLL);
    let doc = coll
        .find_one(doc! { "visitorToken": token })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_widget_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::Unauthorized("invalid or expired session".to_owned()))?;

    if doc.expires_at <= Utc::now() {
        return Err(ApiError::Unauthorized(
            "invalid or expired session".to_owned(),
        ));
    }

    Ok(doc)
}

/// Refresh `session.expires_at` to `created_at + 7 days from now`. Used
/// by `post_message` so a chat that stays active never expires
/// mid-conversation.
pub(crate) async fn touch_session(
    mongo: &MongoHandle,
    session_id: ObjectId,
    new_expires_at: DateTime<Utc>,
) -> Result<()> {
    let coll = mongo.collection::<Document>(SESSIONS_COLL);
    coll.update_one(
        doc! { "_id": session_id },
        doc! { "$set": { "expiresAt": bson::DateTime::from_chrono(new_expires_at) } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_widget_sessions.update_one"))
    })?;
    Ok(())
}

/// Generate a fresh 32-byte CSPRNG token rendered as 64 hex characters.
/// Returned directly to the widget and stored verbatim on the session
/// row — we never hash it server-side, the token itself is the secret.
pub(crate) fn new_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Verify that `hash` is `hex(hmac_sha256(secret, external_user_id))`.
/// Comparison is constant-time via the `Mac::verify_slice` contract.
/// Returns `false` on any failure (empty secret, malformed hex, length
/// mismatch, signature mismatch) — callers turn that into
/// `ApiError::Unauthorized`.
pub(crate) fn verify_hmac(secret: &str, external_user_id: &str, hash: &str) -> bool {
    if secret.is_empty() || external_user_id.is_empty() || hash.is_empty() {
        return false;
    }
    let Ok(expected) = hex::decode(hash) else {
        return false;
    };
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(external_user_id.as_bytes());
    mac.verify_slice(&expected).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_64_lowercase_hex() {
        let t = new_token();
        assert_eq!(t.len(), 64);
        assert!(t.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
    }

    #[test]
    fn tokens_are_unique() {
        let a = new_token();
        let b = new_token();
        assert_ne!(a, b);
    }

    #[test]
    fn verify_hmac_accepts_correct_signature() {
        // hex(hmac_sha256("secret", "user-123"))
        let mut mac = HmacSha256::new_from_slice(b"secret").unwrap();
        mac.update(b"user-123");
        let sig = hex::encode(mac.finalize().into_bytes());
        assert!(verify_hmac("secret", "user-123", &sig));
    }

    #[test]
    fn verify_hmac_rejects_wrong_secret() {
        let mut mac = HmacSha256::new_from_slice(b"secret").unwrap();
        mac.update(b"user-123");
        let sig = hex::encode(mac.finalize().into_bytes());
        assert!(!verify_hmac("wrong", "user-123", &sig));
    }

    #[test]
    fn verify_hmac_rejects_malformed_hex() {
        assert!(!verify_hmac("secret", "user-123", "not-hex"));
    }

    #[test]
    fn verify_hmac_rejects_empty_inputs() {
        assert!(!verify_hmac("", "user", "00"));
        assert!(!verify_hmac("secret", "", "00"));
        assert!(!verify_hmac("secret", "user", ""));
    }
}
