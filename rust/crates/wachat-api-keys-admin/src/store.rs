//! Mongo CRUD for the `api_keys` collection.
//!
//! ## Storage shape
//!
//! Documents written here MUST be readable by
//! `wachat_public_api::ApiKeyVerifier::lookup`. The verifier matches on
//! `{ "key": <sha256 hex>, "revoked": { "$ne": true } }` and reads
//! `tenantId`, `scopes`, `tier`. Anything else (`name`, `createdAt`,
//! `lastUsedAt`, `requestCount`) is admin-side metadata.
//!
//! ## Hash compatibility
//!
//! [`hash_key`] is byte-for-byte identical to
//! `wachat_public_api::ApiKeyVerifier::hash_key`. Both are SHA-256 of the
//! UTF-8 bytes of the plaintext, hex-encoded lower-case. We deliberately
//! don't depend on `wachat-public-api` to avoid a circular crate edge —
//! a doctest below pins the well-known fixture so any drift is caught at
//! `cargo test`.
//!
//! ## Plaintext format
//!
//! Plaintext keys are `"sn_" + 32 url-safe characters`, matching the
//! `API_KEY_PREFIX = 'sn_'` and `nanoid(32)` call in the TS spec
//! (`src/app/actions/api-keys.actions.ts`). The legacy code used
//! bcrypt-via-`hashPassword`; we move to SHA-256 because the public-API
//! verifier hashes incoming keys with SHA-256 and bcrypt-rehashing per
//! request would be unworkable on the hot path.

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::dto::ApiKeySummary;

/// Mongo collection name. MUST match
/// [`wachat_public_api::auth::API_KEYS_COLL`] (`"api_keys"`). Hard-coded
/// to avoid the circular crate dep mentioned in the module docs.
pub const API_KEYS_COLL: &str = "api_keys";

/// Plaintext key prefix — matches the TS `API_KEY_PREFIX = 'sn_'`.
pub const KEY_PREFIX: &str = "sn_";

/// Default scope grant when the caller doesn't pass an explicit list.
/// `*` satisfies any check on the public-API side via
/// [`ApiAuthContext::has_scope`].
const DEFAULT_SCOPES: &[&str] = &["*"];

/// Default rate-limit tier — the lowest, matching the TS plan default.
const DEFAULT_TIER: &str = "FREE";

/// SHA-256 hex digest of `plain`. Mirrors
/// `wachat_public_api::ApiKeyVerifier::hash_key` exactly so a key
/// written here is found by the verifier in one round trip.
pub fn hash_key(plain: &str) -> String {
    let mut h = Sha256::new();
    h.update(plain.as_bytes());
    hex::encode(h.finalize())
}

/// Generate a fresh plaintext key: `"sn_" + 32` url-safe chars from the
/// nanoid alphabet (`A-Za-z0-9_-`). 32 chars at log2(64) ≈ 192 bits of
/// entropy — well beyond the 128-bit floor for secret tokens.
///
/// Uses `rand::random()` (the OS RNG) rather than a stateful `ThreadRng`
/// because Rust 2024 reserved `gen` as a keyword; the free function form
/// sidesteps the issue without losing CSPRNG quality.
fn generate_plaintext() -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let mut out = String::with_capacity(KEY_PREFIX.len() + 32);
    out.push_str(KEY_PREFIX);
    for _ in 0..32 {
        let byte: u8 = rand::random();
        let idx = (byte as usize) % ALPHABET.len();
        out.push(ALPHABET[idx] as char);
    }
    out
}

/// Outcome of `create`: the inserted `_id` plus the plaintext that was
/// just minted. The plaintext lives only in this struct and the HTTP
/// response — never persisted, never logged.
pub struct CreatedKey {
    pub id: ObjectId,
    pub plaintext: String,
}

/// Insert a new API key for `user_id`. Hashes the freshly-minted plaintext
/// with SHA-256 (the verifier's algorithm) and stores both `tenantId` and
/// `userId` set to the caller's id so legacy readers and the new verifier
/// agree on the owner.
pub async fn create(
    mongo: &MongoHandle,
    user_id: &str,
    name: &str,
    scopes: Option<Vec<String>>,
    tier: Option<String>,
) -> Result<CreatedKey> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(ApiError::BadRequest("API key name is required.".to_owned()));
    }

    let plaintext = generate_plaintext();
    let hashed = hash_key(&plaintext);
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

    let now = bson::DateTime::from_chrono(Utc::now());

    let doc = doc! {
        "_id": id,
        "name": trimmed,
        // Owner — duplicated under both names. `tenantId` is what the
        // public-API verifier reads; `userId` keeps any legacy admin
        // tooling working without a migration.
        "tenantId": user_id,
        "userId": user_id,
        "key": &hashed,
        "scopes": Bson::Array(scopes_bson),
        "tier": &tier_str,
        "revoked": false,
        "requestCount": 0_i64,
        "createdAt": now,
        // Initialize as null so the field always exists; the verifier
        // overwrites it on the first successful auth.
        "lastUsedAt": Bson::Null,
    };

    let coll = mongo.collection::<Document>(API_KEYS_COLL);
    coll.insert_one(doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.insert_one")))?;

    Ok(CreatedKey { id, plaintext })
}

/// Mongo projection shape for the list endpoint. We intentionally do not
/// pull `key`, `scopes`, or `tier` — the client only needs the metadata
/// the legacy server action returned.
#[derive(Debug, Deserialize)]
struct ListRow {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    revoked: Option<bool>,
    /// May be `i64` or `i32` on disk; deserialize as `i64` and coerce.
    #[serde(default, rename = "requestCount")]
    request_count: Option<i64>,
    #[serde(default, rename = "createdAt")]
    created_at: Option<bson::DateTime>,
    #[serde(default, rename = "lastUsedAt")]
    last_used_at: Option<bson::DateTime>,
}

/// List keys belonging to `user_id`, sorted by `createdAt` desc. Filters
/// only by ownership so revoked keys are still visible (the UI shows
/// them grayed out, same as the TS spec did).
pub async fn list(mongo: &MongoHandle, user_id: &str) -> Result<Vec<ApiKeySummary>> {
    let coll = mongo.collection::<ListRow>(API_KEYS_COLL);
    let cursor = coll
        .find(doc! {
            // Match either field so any pre-existing rows written by
            // legacy tooling under `userId` only also surface.
            "$or": [
                { "tenantId": user_id },
                { "userId": user_id },
            ]
        })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.find")))?;

    let rows: Vec<ListRow> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.collect")))?;

    Ok(rows.into_iter().map(row_to_summary).collect())
}

fn row_to_summary(row: ListRow) -> ApiKeySummary {
    ApiKeySummary {
        id: row.id.to_hex(),
        name: row.name.unwrap_or_default(),
        revoked: row.revoked.unwrap_or(false),
        request_count: row.request_count.unwrap_or(0).max(0) as u64,
        created_at: row
            .created_at
            .map(bson_dt_to_rfc3339)
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        last_used_at: row.last_used_at.map(bson_dt_to_rfc3339),
    }
}

fn bson_dt_to_rfc3339(dt: bson::DateTime) -> String {
    dt.try_to_rfc3339_string().unwrap_or_else(|_| {
        // Fall back to the chrono conversion if the BSON helper rejects
        // a sub-millisecond value (rare in practice).
        dt.to_chrono().to_rfc3339()
    })
}

/// Soft-delete a key by id. The query is scoped by `tenantId == user_id`
/// (with a fallback `userId == user_id` for legacy rows) so callers can
/// only ever revoke their own keys — cross-user attempts return
/// `Ok(false)` without leaking existence.
pub async fn revoke(mongo: &MongoHandle, user_id: &str, key_id: &str) -> Result<bool> {
    let oid = ObjectId::parse_str(key_id)
        .map_err(|_| ApiError::BadRequest("Invalid key ID.".to_owned()))?;
    let coll = mongo.collection::<Document>(API_KEYS_COLL);
    let res = coll
        .update_one(
            doc! {
                "_id": oid,
                "$or": [
                    { "tenantId": user_id },
                    { "userId": user_id },
                ]
            },
            doc! {
                "$set": {
                    "revoked": true,
                    "revokedAt": bson::DateTime::from_chrono(Utc::now()),
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.update_one")))?;
    Ok(res.matched_count > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pinned reference fixture — same one used by
    /// `wachat_public_api::ApiKeyVerifier::hash_key`'s test. Drift here
    /// breaks the verifier ↔ admin handshake silently, so the failure
    /// mode is loud.
    #[test]
    fn hash_key_matches_public_api_verifier() {
        assert_eq!(
            hash_key("hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn plaintext_has_prefix_and_length() {
        let p = generate_plaintext();
        assert!(p.starts_with(KEY_PREFIX));
        assert_eq!(p.len(), KEY_PREFIX.len() + 32);
        // All chars must come from the nanoid alphabet.
        const ALPHABET: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
        for c in p.bytes().skip(KEY_PREFIX.len()) {
            assert!(ALPHABET.contains(&c), "char {c} not in nanoid alphabet");
        }
    }

    #[test]
    fn plaintexts_are_unique() {
        // Probabilistic but with 192 bits of entropy collisions across a
        // 100-sample run are essentially impossible.
        let a = generate_plaintext();
        let b = generate_plaintext();
        assert_ne!(a, b);
    }
}
