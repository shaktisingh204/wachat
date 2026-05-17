//! Mongo CRUD for the `personal_access_tokens` collection.
//!
//! ## Storage shape
//!
//! Documents written here MUST be readable by the Next.js
//! `verifyApiKey` path in `src/lib/api-platform/auth.ts` when the inbound
//! token carries the `sab_pat_` prefix. The verifier strips the prefix,
//! SHA-256-hashes the suffix, and queries by `{ key: <hash>, revoked: { $ne: true } }`.
//!
//! ## Hash compatibility
//!
//! [`hash_suffix`] is byte-for-byte identical to the hashing the Next.js
//! `parseToken().suffix → hashKey()` path performs. SHA-256 of the UTF-8
//! bytes of the suffix, hex-encoded lower-case.
//!
//! ## Plaintext format
//!
//! Plaintext PATs are `"sab_pat_" + 32 url-safe chars`. The full string
//! (including prefix) is returned to the caller on `generate`; only the
//! hash of the suffix is persisted.

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::dto::PatSummary;

pub const PATS_COLL: &str = "personal_access_tokens";
pub const PAT_PREFIX: &str = "sab_pat_";

const DEFAULT_SCOPES: &[&str] = &["*"];
const DEFAULT_TIER: &str = "FREE";

/// SHA-256 hex of the prefix-stripped suffix. Must match the Next.js
/// `auth.ts::hashKey` function applied to `parseToken(plain).suffix`.
pub fn hash_suffix(suffix: &str) -> String {
    let mut h = Sha256::new();
    h.update(suffix.as_bytes());
    hex::encode(h.finalize())
}

/// Generate a fresh plaintext PAT: `"sab_pat_" + 32` chars from the
/// nanoid alphabet. ~192 bits of entropy.
fn generate_plaintext() -> (String, String) {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let mut suffix = String::with_capacity(32);
    for _ in 0..32 {
        let byte: u8 = rand::random();
        let idx = (byte as usize) % ALPHABET.len();
        suffix.push(ALPHABET[idx] as char);
    }
    let plain = format!("{PAT_PREFIX}{suffix}");
    (plain, suffix)
}

pub struct CreatedPat {
    pub id: ObjectId,
    /// The full `sab_pat_*` plaintext returned to the caller once.
    pub plaintext: String,
}

/// Insert a new PAT for `user_id` under `tenant_id`.
pub async fn create(
    mongo: &MongoHandle,
    tenant_id: &str,
    user_id: &str,
    name: &str,
    scopes: Option<Vec<String>>,
    tier: Option<String>,
    expires_at: Option<String>,
) -> Result<CreatedPat> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(ApiError::BadRequest("PAT name is required.".to_owned()));
    }

    let (plaintext, suffix) = generate_plaintext();
    let hashed = hash_suffix(&suffix);
    let id = ObjectId::new();

    let scopes_bson: Vec<Bson> = scopes
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| DEFAULT_SCOPES.iter().map(|s| (*s).to_owned()).collect())
        .into_iter()
        .map(Bson::String)
        .collect();

    let tier_str = tier
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_uppercase())
        .unwrap_or_else(|| DEFAULT_TIER.to_owned());

    let expires_bson: Bson = match expires_at.as_deref() {
        Some(s) if !s.trim().is_empty() => match s.parse::<DateTime<Utc>>() {
            Ok(dt) => Bson::DateTime(bson::DateTime::from_chrono(dt)),
            Err(_) => {
                return Err(ApiError::BadRequest(
                    "expiresAt must be a valid ISO-8601 timestamp.".to_owned(),
                ));
            }
        },
        _ => Bson::Null,
    };

    let now = bson::DateTime::from_chrono(Utc::now());

    let doc = doc! {
        "_id": id,
        "name": trimmed,
        "tenantId": tenant_id,
        "userId": user_id,
        "key": &hashed,
        "scopes": Bson::Array(scopes_bson),
        "tier": &tier_str,
        "expiresAt": expires_bson,
        "revoked": false,
        "requestCount": 0_i64,
        "createdAt": now,
        "lastUsedAt": Bson::Null,
    };

    let coll = mongo.collection::<Document>(PATS_COLL);
    coll.insert_one(doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("personal_access_tokens.insert_one"))
    })?;

    Ok(CreatedPat { id, plaintext })
}

#[derive(Debug, Deserialize)]
struct ListRow {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(default)]
    name: Option<String>,
    #[serde(rename = "userId", default)]
    user_id: Option<String>,
    #[serde(default)]
    scopes: Option<Vec<String>>,
    #[serde(default)]
    tier: Option<String>,
    #[serde(default)]
    revoked: Option<bool>,
    #[serde(default, rename = "requestCount")]
    request_count: Option<i64>,
    #[serde(default, rename = "createdAt")]
    created_at: Option<bson::DateTime>,
    #[serde(default, rename = "lastUsedAt")]
    last_used_at: Option<bson::DateTime>,
    #[serde(default, rename = "expiresAt")]
    expires_at: Option<bson::DateTime>,
}

/// List PATs belonging to `user_id` inside `tenant_id`. Revoked tokens
/// stay in the list so the UI can render them greyed out — matches the
/// API-key list behaviour for parity.
pub async fn list(
    mongo: &MongoHandle,
    tenant_id: &str,
    user_id: &str,
) -> Result<Vec<PatSummary>> {
    let coll = mongo.collection::<ListRow>(PATS_COLL);
    let cursor = coll
        .find(doc! {
            "tenantId": tenant_id,
            "userId": user_id,
        })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("personal_access_tokens.find"))
        })?;

    let rows: Vec<ListRow> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("personal_access_tokens.collect"))
    })?;

    Ok(rows.into_iter().map(row_to_summary).collect())
}

fn row_to_summary(row: ListRow) -> PatSummary {
    PatSummary {
        id: row.id.to_hex(),
        name: row.name.unwrap_or_default(),
        user_id: row.user_id.unwrap_or_default(),
        scopes: row.scopes.unwrap_or_default(),
        tier: row.tier.unwrap_or_else(|| DEFAULT_TIER.to_owned()),
        revoked: row.revoked.unwrap_or(false),
        request_count: row.request_count.unwrap_or(0).max(0) as u64,
        created_at: row
            .created_at
            .map(bson_dt_to_rfc3339)
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        last_used_at: row.last_used_at.map(bson_dt_to_rfc3339),
        expires_at: row.expires_at.map(bson_dt_to_rfc3339),
    }
}

fn bson_dt_to_rfc3339(dt: bson::DateTime) -> String {
    dt.try_to_rfc3339_string()
        .unwrap_or_else(|_| dt.to_chrono().to_rfc3339())
}

/// Soft-delete a PAT by id, scoped by `(tenantId, userId)`. Cross-user
/// attempts return `Ok(false)` without leaking existence.
pub async fn revoke(
    mongo: &MongoHandle,
    tenant_id: &str,
    user_id: &str,
    token_id: &str,
) -> Result<bool> {
    let oid = ObjectId::parse_str(token_id)
        .map_err(|_| ApiError::BadRequest("Invalid token ID.".to_owned()))?;
    let coll = mongo.collection::<Document>(PATS_COLL);
    let res = coll
        .update_one(
            doc! {
                "_id": oid,
                "tenantId": tenant_id,
                "userId": user_id,
            },
            doc! {
                "$set": {
                    "revoked": true,
                    "revokedAt": bson::DateTime::from_chrono(Utc::now()),
                }
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("personal_access_tokens.update_one"),
            )
        })?;
    Ok(res.matched_count > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// SHA-256("hello") fixture — same one pinned by `wachat-api-keys-admin`.
    /// Drift between the two crates' hashers breaks the unified Next.js
    /// verifier silently, so the failure mode is loud.
    #[test]
    fn hash_suffix_matches_reference() {
        assert_eq!(
            hash_suffix("hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn plaintext_has_prefix_and_length() {
        let (plain, suffix) = generate_plaintext();
        assert!(plain.starts_with(PAT_PREFIX));
        assert_eq!(plain.len(), PAT_PREFIX.len() + 32);
        assert_eq!(suffix.len(), 32);
    }

    #[test]
    fn plaintexts_are_unique() {
        let (a, _) = generate_plaintext();
        let (b, _) = generate_plaintext();
        assert_ne!(a, b);
    }
}
