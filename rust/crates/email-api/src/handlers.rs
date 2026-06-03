//! Axum handlers for `/v1/email/api-keys`.
//!
//! All handlers run with [`AuthUser`] and scope Mongo queries by
//! `user_id = AuthUser.tenant_id`. Raw key plaintext is shown only on
//! `POST /` — every subsequent read returns the safe `ApiKey` projection.

use argon2::Argon2;
use argon2::password_hash::{PasswordHasher, SaltString, rand_core::OsRng};
use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use tracing::instrument;

use crate::dto::{
    ApiKey, CreateKeyBody, CreateKeyResponse, ListResponse, MessageResponse, UpdateKeyBody,
};
use crate::state::EmailApiState;

pub const KEYS_COLL: &str = "email_api_keys";
pub const KEY_PREFIX: &str = "sn_email_";

fn now_bson() -> bson::DateTime {
    bson::DateTime::from_chrono(Utc::now())
}

fn dt_to_rfc3339(dt: bson::DateTime) -> String {
    dt.try_to_rfc3339_string()
        .unwrap_or_else(|_| dt.to_chrono().to_rfc3339())
}

/// Generate `(plaintext, suffix)` where plaintext = `sn_email_<32 hex>`.
fn generate_plaintext() -> (String, String) {
    let mut suffix = String::with_capacity(32);
    for _ in 0..16 {
        let b: u8 = rand::random();
        suffix.push_str(&format!("{b:02x}"));
    }
    let plain = format!("{KEY_PREFIX}{suffix}");
    (plain, suffix)
}

/// Argon2id hash of the suffix bytes. Uses a per-row salt; the encoded
/// hash carries the salt so verification doesn't need separate storage.
fn hash_suffix(suffix: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon = Argon2::default();
    let hash = argon
        .hash_password(suffix.as_bytes(), &salt)
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("argon2 hash failed: {e}")))?;
    Ok(hash.to_string())
}

// ===========================================================================
// Handlers
// ===========================================================================

/// `GET /` — list keys for the tenant.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_keys(
    user: AuthUser,
    State(state): State<EmailApiState>,
) -> Result<Json<ListResponse>> {
    let coll = state.mongo.collection::<Document>(KEYS_COLL);
    let cursor = coll
        .find(doc! { "userId": &user.tenant_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_api_keys.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_api_keys.collect")))?;
    let keys = docs.into_iter().map(doc_to_api_key).collect();
    Ok(Json(ListResponse { keys }))
}

/// `POST /` — mint a new key.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn create_key(
    user: AuthUser,
    State(state): State<EmailApiState>,
    Json(body): Json<CreateKeyBody>,
) -> Result<Json<CreateKeyResponse>> {
    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name is required".to_owned()));
    }

    let (plaintext, suffix) = generate_plaintext();
    let key_hash = hash_suffix(&suffix)?;
    // 12-char prefix == `sn_email_` (9) + first 3 hex chars.
    let prefix: String = plaintext.chars().take(12).collect();

    let id = ObjectId::new();
    let now = now_bson();
    let scopes_bson: Vec<Bson> = body.scopes.iter().cloned().map(Bson::String).collect();
    let doc = doc! {
        "_id": id,
        "userId": &user.tenant_id,
        "name": name,
        "keyHash": &key_hash,
        "prefix": &prefix,
        "scopes": Bson::Array(scopes_bson),
        "createdAt": now,
    };

    let coll = state.mongo.collection::<Document>(KEYS_COLL);
    coll.insert_one(doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("email_api_keys.insert_one"))
    })?;

    Ok(Json(CreateKeyResponse {
        key: ApiKey {
            id: id.to_hex(),
            name: name.to_owned(),
            prefix,
            scopes: body.scopes,
            last_used_at: None,
            created_at: Utc::now().to_rfc3339(),
            revoked_at: None,
        },
        raw_key: plaintext,
    }))
}

/// `PATCH /{id}` — rename / re-scope.
#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn update_key(
    user: AuthUser,
    State(state): State<EmailApiState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateKeyBody>,
) -> Result<Json<MessageResponse>> {
    let oid =
        ObjectId::parse_str(&id).map_err(|_| ApiError::BadRequest("invalid key id".to_owned()))?;

    let mut set = Document::new();
    if let Some(name) = body.name.as_deref() {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(ApiError::BadRequest("name cannot be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(scopes) = &body.scopes {
        let scopes_bson: Vec<Bson> = scopes.iter().cloned().map(Bson::String).collect();
        set.insert("scopes", Bson::Array(scopes_bson));
    }
    if set.is_empty() {
        return Err(ApiError::BadRequest(
            "at least one of name / scopes is required".to_owned(),
        ));
    }
    set.insert("updatedAt", now_bson());

    let coll = state.mongo.collection::<Document>(KEYS_COLL);
    let res = coll
        .update_one(
            doc! { "_id": oid, "userId": &user.tenant_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("email_api_keys.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound(format!("api key {id}")));
    }
    Ok(Json(MessageResponse {
        message: "api key updated".to_owned(),
    }))
}

/// `DELETE /{id}` — revoke. We hard-delete here (no soft-delete) because
/// revoked keys can't be reactivated; the dashboard doesn't need them.
#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn revoke_key(
    user: AuthUser,
    State(state): State<EmailApiState>,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    let oid =
        ObjectId::parse_str(&id).map_err(|_| ApiError::BadRequest("invalid key id".to_owned()))?;
    let coll = state.mongo.collection::<Document>(KEYS_COLL);
    let res = coll
        .delete_one(doc! { "_id": oid, "userId": &user.tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("email_api_keys.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound(format!("api key {id}")));
    }
    Ok(Json(MessageResponse {
        message: "api key revoked".to_owned(),
    }))
}

// ===========================================================================
// Helpers
// ===========================================================================

fn doc_to_api_key(d: Document) -> ApiKey {
    ApiKey {
        id: d
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .unwrap_or_default(),
        name: d.get_str("name").unwrap_or_default().to_owned(),
        prefix: d.get_str("prefix").unwrap_or_default().to_owned(),
        scopes: d
            .get_array("scopes")
            .ok()
            .map(|arr| {
                arr.iter()
                    .filter_map(|b| b.as_str().map(|s| s.to_owned()))
                    .collect()
            })
            .unwrap_or_default(),
        last_used_at: d
            .get_datetime("lastUsedAt")
            .ok()
            .map(|dt| dt_to_rfc3339(*dt)),
        created_at: d
            .get_datetime("createdAt")
            .ok()
            .map(|dt| dt_to_rfc3339(*dt))
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        revoked_at: d
            .get_datetime("revokedAt")
            .ok()
            .map(|dt| dt_to_rfc3339(*dt)),
    }
}
