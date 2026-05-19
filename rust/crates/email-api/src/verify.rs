//! Tenant API key verification — public entrypoint other email crates
//! use as middleware-equivalent when an inbound request carries a raw
//! `sn_email_*` key instead of a JWT.
//!
//! The function loads every non-revoked key for the matching prefix,
//! argon2-verifies the suffix against the stored hash, and returns the
//! `(tenant_id, scopes)` pair on success. A successful verification also
//! bumps `lastUsedAt` so the dashboard can show recency.

use argon2::password_hash::PasswordHash;
use argon2::{Argon2, PasswordVerifier};
use bson::{Document, doc};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

use crate::handlers::{KEYS_COLL, KEY_PREFIX};

/// Verify `raw_key` against the `email_api_keys` collection.
///
/// On success returns `(tenant_id, scopes)`. On failure surfaces a
/// `ApiError::Unauthorized` — keys that exist but have been revoked
/// (i.e. their row has been deleted) look identical from the outside.
pub async fn verify_api_key(
    mongo: &MongoHandle,
    raw_key: &str,
) -> Result<(String, Vec<String>)> {
    let suffix = raw_key
        .strip_prefix(KEY_PREFIX)
        .ok_or_else(|| ApiError::Unauthorized("invalid api key format".to_owned()))?;

    // 12-char prefix == `sn_email_` (9) + first 3 chars of the suffix.
    let prefix: String = raw_key.chars().take(12).collect();

    let coll = mongo.collection::<Document>(KEYS_COLL);
    let cursor = coll
        .find(doc! { "prefix": &prefix })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_api_keys.find")))?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("email_api_keys.collect"))
    })?;

    for d in docs {
        let Ok(hash_str) = d.get_str("keyHash") else {
            continue;
        };
        let Ok(parsed) = PasswordHash::new(hash_str) else {
            continue;
        };
        if Argon2::default()
            .verify_password(suffix.as_bytes(), &parsed)
            .is_ok()
        {
            let tenant_id = d.get_str("userId").unwrap_or_default().to_owned();
            let scopes: Vec<String> = d
                .get_array("scopes")
                .ok()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|b| b.as_str().map(|s| s.to_owned()))
                        .collect()
                })
                .unwrap_or_default();

            // Best-effort touch — failure to update `lastUsedAt` should
            // not break authentication.
            if let Ok(id) = d.get_object_id("_id") {
                let _ = coll
                    .update_one(
                        doc! { "_id": id },
                        doc! { "$set": { "lastUsedAt": bson::DateTime::from_chrono(Utc::now()) } },
                    )
                    .await;
            }

            return Ok((tenant_id, scopes));
        }
    }

    Err(ApiError::Unauthorized("invalid api key".to_owned()))
}
