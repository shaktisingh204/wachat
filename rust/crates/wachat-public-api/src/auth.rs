//! API-key authentication extractor.
//!
//! Mirrors `verifyApiKey` from `src/lib/api-platform/auth.ts`:
//!
//! 1. Pull a bearer token off `Authorization: Bearer <token>` (or
//!    `X-Api-Key` as a fallback — both header forms are accepted on the
//!    TS side).
//! 2. SHA-256-hex-digest the token (same as the TS
//!    `createHash('sha256').update(plain).digest('hex')`).
//! 3. Look the digest up in the `api_keys` Mongo collection. Reject
//!    `{ revoked: true }` keys.
//! 4. Bump `lastUsedAt` fire-and-forget — never blocking the request.
//!
//! The extractor returns an [`ApiAuthContext`] that handlers use to scope
//! Mongo lookups (`tenantId`) and for per-key rate-limit keying (`keyId`).

use std::sync::Arc;

use axum::{
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};
use bson::doc;
use chrono::Utc;
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;
use sha2::{Digest, Sha256};

/// Mongo collection name for API keys (matches the TS `api_keys`).
pub const API_KEYS_COLL: &str = "api_keys";

/// Minimal authenticated context produced by [`ApiKeyAuth`].
///
/// Mirrors the TS `ApiAuthContext` shape from
/// `src/lib/api-platform/auth.ts` one-to-one. `key_id` is the hex Mongo
/// `_id` of the matched key — used as the rate-limit bucket key.
#[derive(Debug, Clone)]
pub struct ApiAuthContext {
    /// Owning workspace / project owner id (hex string). Compared against
    /// `project.userId.to_hex()` to enforce tenancy at the project level.
    pub tenant_id: String,
    /// Granted scopes. The wildcard `*` satisfies any check.
    pub scopes: Vec<String>,
    /// Plan-driven rate-limit tier (`FREE` / `PRO` / `ENTERPRISE`).
    pub tier: RateLimitTier,
    /// Hex `_id` of the matched key — rate-limit bucket key.
    pub key_id: String,
}

impl ApiAuthContext {
    /// Returns true when this context grants `scope`. The wildcard `*`
    /// scope satisfies any check (matches the TS `requireScope`).
    pub fn has_scope(&self, scope: &str) -> bool {
        self.scopes.iter().any(|s| s == "*" || s == scope)
    }

    /// Per-key rate-limit bucket key. Stable across requests so each API
    /// key gets its own ceiling regardless of tenant.
    pub fn rate_limit_bucket(&self) -> String {
        format!("apikey:{}", self.key_id)
    }
}

/// Plan-driven rate-limit tier.
///
/// Numeric defaults per [`RateLimitTier::rpm`] match the TS
/// `src/lib/api-platform/rate-limit.ts` defaults at the time of porting.
/// The wire format is the literal uppercase string the TS writes onto
/// each `api_keys` row (e.g. `"FREE"`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum RateLimitTier {
    Free,
    Pro,
    Enterprise,
}

impl Default for RateLimitTier {
    fn default() -> Self {
        Self::Free
    }
}

impl RateLimitTier {
    /// Requests-per-minute ceiling for this tier. The token bucket maps
    /// this onto `capacity = rpm` and `refill_per_sec = rpm / 60`.
    pub fn rpm(self) -> u32 {
        match self {
            Self::Free => 60,
            Self::Pro => 600,
            Self::Enterprise => 6000,
        }
    }
}

/// Configured verifier backing [`ApiKeyAuth`].
///
/// Cheap to clone — the Mongo handle is `Arc`-backed.
#[derive(Debug, Clone)]
pub struct ApiKeyVerifier {
    mongo: MongoHandle,
}

impl ApiKeyVerifier {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// SHA-256 hex digest of `plain`. Mirrors the TS
    /// `createHash('sha256').update(plain).digest('hex')` in
    /// `src/lib/api-platform/auth.ts` exactly.
    pub fn hash_key(plain: &str) -> String {
        let mut h = Sha256::new();
        h.update(plain.as_bytes());
        hex::encode(h.finalize())
    }

    /// Look `plain` up in the `api_keys` collection. Returns `None` when
    /// no matching non-revoked row exists.
    async fn lookup(&self, plain: &str) -> Result<Option<ApiAuthContext>, ApiError> {
        let hashed = Self::hash_key(plain);
        let coll = self.mongo.collection::<ApiKeyDoc>(API_KEYS_COLL);
        let doc = coll
            .find_one(doc! { "key": &hashed, "revoked": { "$ne": true } })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.find_one")))?;

        let Some(doc) = doc else {
            return Ok(None);
        };

        // Best-effort lastUsedAt bump — never block the request on it.
        // Matches the TS `void col.updateOne(...).catch(() => undefined)`.
        let coll_bg = coll.clone();
        let id = doc.id;
        tokio::spawn(async move {
            let now = Utc::now().to_rfc3339();
            let _ = coll_bg
                .update_one(doc! { "_id": id }, doc! { "$set": { "lastUsedAt": now } })
                .await;
        });

        Ok(Some(ApiAuthContext {
            tenant_id: doc.tenant_id,
            scopes: doc.scopes.unwrap_or_default(),
            tier: doc.tier.unwrap_or_default(),
            key_id: doc.id.to_hex(),
        }))
    }
}

/// Mongo document shape for `api_keys`. Mirrors the TS shape used in
/// `verifyApiKey`. Unknown fields are intentionally dropped — handlers
/// only need the four fields below.
#[derive(Debug, Deserialize)]
struct ApiKeyDoc {
    #[serde(rename = "_id")]
    id: bson::oid::ObjectId,
    #[serde(rename = "tenantId")]
    tenant_id: String,
    /// SHA-256 hex digest. Already canonicalized by the TS writer.
    #[allow(dead_code)]
    key: String,
    #[serde(default)]
    scopes: Option<Vec<String>>,
    #[serde(default)]
    tier: Option<RateLimitTier>,
}

/// Pull a bearer token off the request. Accepts both
/// `Authorization: Bearer <token>` (case-insensitive scheme) and
/// `X-Api-Key: <token>` (matches the TS `extractKey`).
fn extract_token(parts: &Parts) -> Option<String> {
    if let Some(authz) = parts.headers.get(axum::http::header::AUTHORIZATION) {
        if let Ok(raw) = authz.to_str() {
            let trimmed = raw.trim();
            if let Some(rest) = trimmed
                .strip_prefix("Bearer ")
                .or_else(|| trimmed.strip_prefix("bearer "))
                .or_else(|| trimmed.strip_prefix("BEARER "))
            {
                let tok = rest.trim();
                if !tok.is_empty() {
                    return Some(tok.to_owned());
                }
            }
        }
    }
    if let Some(direct) = parts
        .headers
        .get("x-api-key")
        .or_else(|| parts.headers.get("X-Api-Key"))
    {
        if let Ok(raw) = direct.to_str() {
            let tok = raw.trim();
            if !tok.is_empty() {
                return Some(tok.to_owned());
            }
        }
    }
    None
}

/// Axum extractor that authenticates an API key and yields an
/// [`ApiAuthContext`].
///
/// 401 on missing / invalid / revoked keys.
#[derive(Debug, Clone)]
pub struct ApiKeyAuth(pub ApiAuthContext);

impl<S> FromRequestParts<S> for ApiKeyAuth
where
    S: Send + Sync,
    Arc<ApiKeyVerifier>: FromRef<S>,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let verifier: Arc<ApiKeyVerifier> = Arc::<ApiKeyVerifier>::from_ref(state);
        let token = extract_token(parts).ok_or_else(|| {
            ApiError::Unauthorized("missing API key (Authorization: Bearer <key>)".to_owned())
        })?;
        let ctx = verifier
            .lookup(&token)
            .await?
            .ok_or_else(|| ApiError::Unauthorized("invalid or revoked API key".to_owned()))?;
        Ok(ApiKeyAuth(ctx))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_key_matches_ts_sha256_hex() {
        // Reference fixture: `node -e "console.log(crypto.createHash('sha256').update('hello').digest('hex'))"`
        // `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824`
        assert_eq!(
            ApiKeyVerifier::hash_key("hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn has_scope_wildcard() {
        let ctx = ApiAuthContext {
            tenant_id: "t".into(),
            scopes: vec!["*".into()],
            tier: RateLimitTier::Free,
            key_id: "k".into(),
        };
        assert!(ctx.has_scope("messages:write"));
        assert!(ctx.has_scope("anything:read"));
    }

    #[test]
    fn has_scope_exact() {
        let ctx = ApiAuthContext {
            tenant_id: "t".into(),
            scopes: vec!["messages:write".into(), "contacts:read".into()],
            tier: RateLimitTier::Pro,
            key_id: "k".into(),
        };
        assert!(ctx.has_scope("messages:write"));
        assert!(!ctx.has_scope("messages:read"));
    }

    #[test]
    fn rpm_defaults_match_ts() {
        // Source of truth: src/lib/api-platform/rate-limit.ts at port time.
        assert_eq!(RateLimitTier::Free.rpm(), 60);
        assert_eq!(RateLimitTier::Pro.rpm(), 600);
        assert_eq!(RateLimitTier::Enterprise.rpm(), 6000);
    }

    #[test]
    fn rate_limit_bucket_format() {
        let ctx = ApiAuthContext {
            tenant_id: "t".into(),
            scopes: vec![],
            tier: RateLimitTier::Free,
            key_id: "abc123".into(),
        };
        assert_eq!(ctx.rate_limit_bucket(), "apikey:abc123");
    }
}
