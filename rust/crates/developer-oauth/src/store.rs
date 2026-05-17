//! Mongo CRUD for the OAuth tables.
//!
//! All hash columns use SHA-256 of the prefix-stripped suffix, matching
//! the Next.js `verifyApiKey` path. The plaintext is returned to the
//! caller exactly once.

use base64::{Engine, engine::general_purpose};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Duration, Utc};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::dto::OauthApp;

pub const APPS_COLL: &str = "oauth_apps";
pub const CODES_COLL: &str = "oauth_authorization_codes";
pub const ACCESS_COLL: &str = "oauth_access_tokens";
pub const REFRESH_COLL: &str = "oauth_refresh_tokens";

pub const ACCESS_TOKEN_PREFIX: &str = "sab_oat_";
pub const REFRESH_TOKEN_PREFIX: &str = "sab_ort_";
pub const ACCESS_TTL_SECONDS: i64 = 3600; // 1h
pub const REFRESH_TTL_SECONDS: i64 = 60 * 60 * 24 * 30; // 30d
pub const AUTH_CODE_TTL_SECONDS: i64 = 600; // 10m

const ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

fn random_suffix(n: usize) -> String {
    let mut out = String::with_capacity(n);
    for _ in 0..n {
        let b: u8 = rand::random();
        out.push(ALPHABET[(b as usize) % ALPHABET.len()] as char);
    }
    out
}

fn sha256_hex(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    hex::encode(h.finalize())
}

fn bson_dt_to_rfc3339(dt: bson::DateTime) -> String {
    dt.try_to_rfc3339_string()
        .unwrap_or_else(|_| dt.to_chrono().to_rfc3339())
}

/* ── Apps ──────────────────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
struct AppRow {
    #[serde(rename = "_id")]
    id: ObjectId,
    name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(rename = "clientId")]
    client_id: String,
    #[serde(rename = "clientSecretHash")]
    client_secret_hash: String,
    #[serde(default, rename = "redirectUris")]
    redirect_uris: Vec<String>,
    #[serde(default)]
    scopes: Vec<String>,
    #[serde(rename = "ownerUserId")]
    owner_user_id: String,
    #[serde(default, rename = "createdAt")]
    created_at: Option<bson::DateTime>,
}

fn app_row_to_dto(row: AppRow) -> OauthApp {
    OauthApp {
        id: row.id.to_hex(),
        name: row.name,
        description: row.description,
        client_id: row.client_id,
        redirect_uris: row.redirect_uris,
        scopes: row.scopes,
        created_at: row
            .created_at
            .map(bson_dt_to_rfc3339)
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
    }
}

pub struct RegisteredApp {
    pub app: OauthApp,
    pub plain_client_secret: String,
}

pub async fn register_app(
    mongo: &MongoHandle,
    owner_user_id: &str,
    name: &str,
    redirect_uris: Vec<String>,
    scopes: Vec<String>,
    description: Option<String>,
) -> Result<RegisteredApp> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err(ApiError::BadRequest("name is required.".to_owned()));
    }
    if redirect_uris.is_empty() {
        return Err(ApiError::BadRequest("at least one redirect_uri is required.".to_owned()));
    }
    for u in &redirect_uris {
        if !(u.starts_with("http://") || u.starts_with("https://")) {
            return Err(ApiError::BadRequest(format!(
                "redirect_uri must be an http(s) URL: {u}"
            )));
        }
    }

    let client_id = format!("sabcid_{}", random_suffix(24));
    let plain_secret = format!("sabcsec_{}", random_suffix(40));
    let secret_hash = sha256_hex(&plain_secret);

    let id = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());
    let scopes_bson: Vec<Bson> = scopes.into_iter().map(Bson::String).collect();
    let redirects_bson: Vec<Bson> = redirect_uris.into_iter().map(Bson::String).collect();

    let doc = doc! {
        "_id": id,
        "name": trimmed_name,
        "description": description.clone().unwrap_or_default(),
        "ownerUserId": owner_user_id,
        "clientId": &client_id,
        "clientSecretHash": &secret_hash,
        "redirectUris": Bson::Array(redirects_bson.clone()),
        "scopes": Bson::Array(scopes_bson.clone()),
        "createdAt": now,
    };
    mongo
        .collection::<Document>(APPS_COLL)
        .insert_one(doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("oauth_apps.insert_one")))?;

    let app = OauthApp {
        id: id.to_hex(),
        name: trimmed_name.to_owned(),
        description,
        client_id: client_id.clone(),
        redirect_uris: redirects_bson
            .into_iter()
            .filter_map(|b| if let Bson::String(s) = b { Some(s) } else { None })
            .collect(),
        scopes: scopes_bson
            .into_iter()
            .filter_map(|b| if let Bson::String(s) = b { Some(s) } else { None })
            .collect(),
        created_at: bson_dt_to_rfc3339(now),
    };

    Ok(RegisteredApp {
        app,
        plain_client_secret: plain_secret,
    })
}

pub async fn list_apps(mongo: &MongoHandle, owner_user_id: &str) -> Result<Vec<OauthApp>> {
    let coll = mongo.collection::<AppRow>(APPS_COLL);
    let cursor = coll
        .find(doc! { "ownerUserId": owner_user_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("oauth_apps.find")))?;
    let rows: Vec<AppRow> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("oauth_apps.collect")))?;
    Ok(rows.into_iter().map(app_row_to_dto).collect())
}

pub async fn delete_app(mongo: &MongoHandle, owner_user_id: &str, app_id: &str) -> Result<bool> {
    let oid = ObjectId::parse_str(app_id)
        .map_err(|_| ApiError::BadRequest("Invalid app id.".to_owned()))?;
    let coll = mongo.collection::<Document>(APPS_COLL);
    let res = coll
        .delete_one(doc! { "_id": oid, "ownerUserId": owner_user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("oauth_apps.delete_one")))?;
    if res.deleted_count > 0 {
        // Cascade-revoke tokens this app issued.
        let _ = mongo
            .collection::<Document>(ACCESS_COLL)
            .update_many(doc! { "clientAppId": oid }, doc! { "$set": { "revoked": true } })
            .await;
        let _ = mongo
            .collection::<Document>(REFRESH_COLL)
            .update_many(doc! { "clientAppId": oid }, doc! { "$set": { "revoked": true } })
            .await;
    }
    Ok(res.deleted_count > 0)
}

/* ── Authorize / token / refresh ───────────────────────────────────────── */

#[derive(Debug, Deserialize)]
struct AppLookup {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(rename = "clientId")]
    client_id: String,
    #[serde(rename = "clientSecretHash")]
    client_secret_hash: String,
    #[serde(default, rename = "redirectUris")]
    redirect_uris: Vec<String>,
    #[serde(default)]
    scopes: Vec<String>,
}

async fn lookup_app(mongo: &MongoHandle, client_id: &str) -> Result<AppLookup> {
    mongo
        .collection::<AppLookup>(APPS_COLL)
        .find_one(doc! { "clientId": client_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("oauth_apps.find_one")))?
        .ok_or_else(|| ApiError::NotFound("oauth app".to_owned()))
}

fn intersect_scopes(allowed: &[String], requested: &str) -> Vec<String> {
    requested
        .split_whitespace()
        .filter(|s| allowed.iter().any(|a| a == s || a == "*"))
        .map(str::to_owned)
        .collect()
}

pub async fn create_authorization_code(
    mongo: &MongoHandle,
    tenant_id: &str,
    user_id: &str,
    client_id: &str,
    redirect_uri: &str,
    scope: &str,
    code_challenge: &str,
    code_challenge_method: &str,
) -> Result<String> {
    if code_challenge_method != "S256" {
        return Err(ApiError::BadRequest(
            "code_challenge_method must be S256 (plain PKCE rejected).".to_owned(),
        ));
    }
    let app = lookup_app(mongo, client_id).await?;
    if !app.redirect_uris.iter().any(|u| u == redirect_uri) {
        return Err(ApiError::BadRequest("redirect_uri not registered.".to_owned()));
    }
    let granted = intersect_scopes(&app.scopes, scope);
    if granted.is_empty() {
        return Err(ApiError::BadRequest(
            "no requested scopes are allowed for this app.".to_owned(),
        ));
    }

    let code = format!("sabauth_{}", random_suffix(40));
    let code_hash = sha256_hex(&code);
    let expires_at = Utc::now() + Duration::seconds(AUTH_CODE_TTL_SECONDS);

    let scopes_bson: Vec<Bson> = granted.into_iter().map(Bson::String).collect();
    let doc = doc! {
        "_id": ObjectId::new(),
        "codeHash": &code_hash,
        "clientAppId": app.id,
        "clientId": app.client_id,
        "tenantId": tenant_id,
        "userId": user_id,
        "redirectUri": redirect_uri,
        "scopes": Bson::Array(scopes_bson),
        "codeChallenge": code_challenge,
        "expiresAt": bson::DateTime::from_chrono(expires_at),
        "used": false,
    };
    mongo
        .collection::<Document>(CODES_COLL)
        .insert_one(doc)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("oauth_authorization_codes.insert_one"),
            )
        })?;
    Ok(code)
}

#[derive(Debug, Deserialize)]
struct CodeRow {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(rename = "clientAppId")]
    client_app_id: ObjectId,
    #[serde(rename = "clientId")]
    client_id: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
    #[serde(rename = "userId")]
    user_id: String,
    #[serde(rename = "redirectUri")]
    redirect_uri: String,
    #[serde(default)]
    scopes: Vec<String>,
    #[serde(rename = "codeChallenge")]
    code_challenge: String,
    #[serde(rename = "expiresAt")]
    expires_at: bson::DateTime,
    #[serde(default)]
    used: Option<bool>,
}

pub struct IssuedTokens {
    pub access_plain: String,
    pub refresh_plain: String,
    pub expires_in: u64,
    pub scope: String,
}

/// Exchange an authorization code for access + refresh tokens.
///
/// Validates PKCE (`code_challenge == base64url(SHA256(code_verifier))`),
/// redirect_uri match, client_id, code TTL, and single-use.
pub async fn exchange_code(
    mongo: &MongoHandle,
    code: &str,
    client_id: &str,
    client_secret: Option<&str>,
    redirect_uri: &str,
    code_verifier: &str,
) -> Result<IssuedTokens> {
    let app = lookup_app(mongo, client_id).await?;
    // Confidential clients (those holding a secret) must present it.
    if let Some(sec) = client_secret {
        if sha256_hex(sec) != app.client_secret_hash {
            return Err(ApiError::Unauthorized("invalid client credentials".to_owned()));
        }
    }

    let code_hash = sha256_hex(code);
    let row: Option<CodeRow> = mongo
        .collection::<CodeRow>(CODES_COLL)
        .find_one(doc! { "codeHash": &code_hash, "used": { "$ne": true } })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("oauth_authorization_codes.find_one"),
            )
        })?;
    let row = row.ok_or_else(|| ApiError::BadRequest("invalid or expired code.".to_owned()))?;

    if row.expires_at.to_chrono() < Utc::now() {
        return Err(ApiError::BadRequest("invalid or expired code.".to_owned()));
    }
    if row.client_id != client_id {
        return Err(ApiError::BadRequest("client_id mismatch.".to_owned()));
    }
    if row.redirect_uri != redirect_uri {
        return Err(ApiError::BadRequest("redirect_uri mismatch.".to_owned()));
    }

    // PKCE: SHA256(verifier), base64url-no-pad.
    let mut h = Sha256::new();
    h.update(code_verifier.as_bytes());
    let challenge_computed = general_purpose::URL_SAFE_NO_PAD.encode(h.finalize());
    if challenge_computed != row.code_challenge {
        return Err(ApiError::Unauthorized("PKCE verification failed.".to_owned()));
    }

    // Burn the code so it can't be replayed.
    mongo
        .collection::<Document>(CODES_COLL)
        .update_one(
            doc! { "_id": row.id },
            doc! { "$set": { "used": true } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("oauth_authorization_codes.update_one"),
            )
        })?;

    issue_tokens(mongo, app.id, &row.client_id, &row.tenant_id, &row.user_id, row.scopes).await
}

async fn issue_tokens(
    mongo: &MongoHandle,
    client_app_id: ObjectId,
    client_id: &str,
    tenant_id: &str,
    user_id: &str,
    scopes: Vec<String>,
) -> Result<IssuedTokens> {
    let access_plain = format!("{ACCESS_TOKEN_PREFIX}{}", random_suffix(40));
    let refresh_plain = format!("{REFRESH_TOKEN_PREFIX}{}", random_suffix(40));
    let access_hash = sha256_hex(access_plain.strip_prefix(ACCESS_TOKEN_PREFIX).unwrap_or(&access_plain));
    let refresh_hash = sha256_hex(refresh_plain.strip_prefix(REFRESH_TOKEN_PREFIX).unwrap_or(&refresh_plain));

    let now = Utc::now();
    let access_exp = now + Duration::seconds(ACCESS_TTL_SECONDS);
    let refresh_exp = now + Duration::seconds(REFRESH_TTL_SECONDS);
    let scopes_bson: Vec<Bson> = scopes.iter().cloned().map(Bson::String).collect();
    let scope_str = scopes.join(" ");

    mongo
        .collection::<Document>(ACCESS_COLL)
        .insert_one(doc! {
            "_id": ObjectId::new(),
            "key": &access_hash,
            "clientAppId": client_app_id,
            "clientId": client_id,
            "tenantId": tenant_id,
            "userId": user_id,
            "scopes": Bson::Array(scopes_bson.clone()),
            "tier": "FREE",
            "expiresAt": bson::DateTime::from_chrono(access_exp),
            "createdAt": bson::DateTime::from_chrono(now),
            "revoked": false,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("oauth_access_tokens.insert_one"))
        })?;

    mongo
        .collection::<Document>(REFRESH_COLL)
        .insert_one(doc! {
            "_id": ObjectId::new(),
            "key": &refresh_hash,
            "clientAppId": client_app_id,
            "clientId": client_id,
            "tenantId": tenant_id,
            "userId": user_id,
            "scopes": Bson::Array(scopes_bson),
            "expiresAt": bson::DateTime::from_chrono(refresh_exp),
            "createdAt": bson::DateTime::from_chrono(now),
            "revoked": false,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("oauth_refresh_tokens.insert_one"))
        })?;

    Ok(IssuedTokens {
        access_plain,
        refresh_plain,
        expires_in: ACCESS_TTL_SECONDS as u64,
        scope: scope_str,
    })
}

/* ── Refresh ───────────────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
struct RefreshRow {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(rename = "clientAppId")]
    client_app_id: ObjectId,
    #[serde(rename = "clientId")]
    client_id: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
    #[serde(rename = "userId")]
    user_id: String,
    #[serde(default)]
    scopes: Vec<String>,
    #[serde(rename = "expiresAt")]
    expires_at: bson::DateTime,
    #[serde(default)]
    revoked: Option<bool>,
}

pub async fn refresh_tokens(
    mongo: &MongoHandle,
    refresh_token: &str,
    client_id: &str,
    client_secret: Option<&str>,
) -> Result<IssuedTokens> {
    let app = lookup_app(mongo, client_id).await?;
    if let Some(sec) = client_secret {
        if sha256_hex(sec) != app.client_secret_hash {
            return Err(ApiError::Unauthorized("invalid client credentials".to_owned()));
        }
    }

    let suffix = refresh_token
        .strip_prefix(REFRESH_TOKEN_PREFIX)
        .unwrap_or(refresh_token);
    let hash = sha256_hex(suffix);
    let row: Option<RefreshRow> = mongo
        .collection::<RefreshRow>(REFRESH_COLL)
        .find_one(doc! { "key": &hash, "revoked": { "$ne": true } })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("oauth_refresh_tokens.find_one"))
        })?;
    let row = row.ok_or_else(|| ApiError::BadRequest("invalid refresh token.".to_owned()))?;

    if row.expires_at.to_chrono() < Utc::now() {
        return Err(ApiError::BadRequest("refresh token expired.".to_owned()));
    }
    if row.client_id != client_id {
        return Err(ApiError::BadRequest("client_id mismatch.".to_owned()));
    }

    // Rotate the refresh token — revoke the old one before issuing.
    mongo
        .collection::<Document>(REFRESH_COLL)
        .update_one(doc! { "_id": row.id }, doc! { "$set": { "revoked": true } })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("oauth_refresh_tokens.update_one"))
        })?;

    issue_tokens(
        mongo,
        row.client_app_id,
        &row.client_id,
        &row.tenant_id,
        &row.user_id,
        row.scopes,
    )
    .await
}

/* ── Revoke / introspect ───────────────────────────────────────────────── */

/// Best-effort revoke — tries the access table first, then the refresh
/// table. Returns true if either matched.
pub async fn revoke_token(mongo: &MongoHandle, token: &str) -> Result<bool> {
    let suffix_access = token.strip_prefix(ACCESS_TOKEN_PREFIX);
    let suffix_refresh = token.strip_prefix(REFRESH_TOKEN_PREFIX);
    let hash = sha256_hex(suffix_access.or(suffix_refresh).unwrap_or(token));

    let access_res = mongo
        .collection::<Document>(ACCESS_COLL)
        .update_many(doc! { "key": &hash }, doc! { "$set": { "revoked": true } })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("oauth_access_tokens.update_many"))
        })?;
    let refresh_res = mongo
        .collection::<Document>(REFRESH_COLL)
        .update_many(doc! { "key": &hash }, doc! { "$set": { "revoked": true } })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("oauth_refresh_tokens.update_many"))
        })?;
    Ok(access_res.modified_count + refresh_res.modified_count > 0)
}

#[derive(Debug, Deserialize)]
struct AccessRow {
    #[serde(rename = "clientId")]
    client_id: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
    #[serde(rename = "userId")]
    user_id: String,
    #[serde(default)]
    scopes: Vec<String>,
    #[serde(rename = "expiresAt")]
    expires_at: bson::DateTime,
    #[serde(default)]
    revoked: Option<bool>,
}

pub struct IntrospectionInfo {
    pub active: bool,
    pub scope: String,
    pub client_id: Option<String>,
    pub tenant_id: Option<String>,
    pub user_id: Option<String>,
    pub exp: Option<DateTime<Utc>>,
}

pub async fn introspect(mongo: &MongoHandle, token: &str) -> Result<IntrospectionInfo> {
    let suffix_access = token.strip_prefix(ACCESS_TOKEN_PREFIX);
    let suffix_refresh = token.strip_prefix(REFRESH_TOKEN_PREFIX);
    let hash = sha256_hex(suffix_access.or(suffix_refresh).unwrap_or(token));

    let row: Option<AccessRow> = mongo
        .collection::<AccessRow>(ACCESS_COLL)
        .find_one(doc! { "key": &hash })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("oauth_access_tokens.find_one"))
        })?;
    let Some(row) = row else {
        return Ok(IntrospectionInfo {
            active: false,
            scope: String::new(),
            client_id: None,
            tenant_id: None,
            user_id: None,
            exp: None,
        });
    };

    let exp = row.expires_at.to_chrono();
    let active = !row.revoked.unwrap_or(false) && exp > Utc::now();
    Ok(IntrospectionInfo {
        active,
        scope: row.scopes.join(" "),
        client_id: Some(row.client_id),
        tenant_id: Some(row.tenant_id),
        user_id: Some(row.user_id),
        exp: Some(exp),
    })
}
