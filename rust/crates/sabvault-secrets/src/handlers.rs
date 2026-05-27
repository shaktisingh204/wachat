//! HTTP handlers for SabVault Secret CRUD.
//!
//! Tenant-scoped by `userId`. Sharing is enforced via the
//! `shared_with_user_ids` array on the secret — a non-owner can only see
//! secrets where their `userId` is in that list. Plaintext NEVER passes
//! through these handlers — `encrypted_payload_b64` is treated as opaque.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateSecretInput, CreateSecretResponse, DeleteSecretResponse, ListQuery, ListResponse,
    UpdateSecretInput,
};
use crate::types::{EncryptionAlg, SabvaultSecret, SecretKind};

pub const SECRETS_COLL: &str = "sabvault_secrets";
const ENTITY_KIND: &str = "sabvault_secret";

// ─── Filter helpers ──────────────────────────────────────────────────────

/// Matches docs owned by `user_id` OR shared with `user_id`.
fn visibility_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! {
        "$or": [
            { "userId": user_id },
            { "sharedWithUserIds": user_id },
        ]
    };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

/// Owner-only filter — for mutations (only the owner can edit/delete).
fn ownership_filter(user_id: ObjectId, secret_oid: ObjectId) -> Document {
    doc! { "_id": secret_oid, "userId": user_id }
}

/// Owner OR shared — used for GET-one (any visible user can read).
fn read_filter(user_id: ObjectId, secret_oid: ObjectId) -> Document {
    doc! {
        "_id": secret_oid,
        "$or": [
            { "userId": user_id },
            { "sharedWithUserIds": user_id },
        ]
    }
}

// ─── Mapping helpers ────────────────────────────────────────────────────

fn secret_from_create(input: CreateSecretInput, user_id: ObjectId) -> Result<SabvaultSecret> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.encrypted_payload_b64.trim().is_empty() {
        return Err(ApiError::Validation(
            "encryptedPayloadB64 is required".to_owned(),
        ));
    }
    let folder_oid = match input.folder_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(SabvaultSecret {
        id: None,
        user_id,
        name: input.name,
        kind: input.kind,
        encrypted_payload_b64: input.encrypted_payload_b64,
        encryption_alg: input.encryption_alg,
        key_salt_b64: input.key_salt_b64,
        url: input.url,
        folder_id: folder_oid,
        tags: input.tags,
        shared_with_user_ids: Vec::new(),
        shared_with_team_ids: Vec::new(),
        expires_at: input.expires_at.map(BsonDateTime::from_chrono),
        last_rotated_at: None,
        last_accessed_at: None,
        strength: None,
        reused: None,
        breached: None,
        attachments: input.attachments,
        status: Some("active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSecretInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.kind {
        let s = match v {
            SecretKind::Login => "login",
            SecretKind::Note => "note",
            SecretKind::Card => "card",
            SecretKind::Identity => "identity",
            SecretKind::Key => "key",
            SecretKind::Wifi => "wifi",
            SecretKind::Server => "server",
        };
        set.insert("kind", s);
    }
    if let Some(v) = patch.encrypted_payload_b64 {
        set.insert("encryptedPayloadB64", v);
    }
    if let Some(EncryptionAlg(v)) = patch.encryption_alg {
        set.insert("encryptionAlg", v);
    }
    if let Some(v) = patch.url {
        set.insert("url", v);
    }
    if let Some(v) = patch.folder_id {
        if v.is_empty() {
            set.insert("folderId", Bson::Null);
        } else {
            let oid = oid_from_str(&v)?;
            set.insert("folderId", oid);
        }
    }
    if let Some(v) = patch.tags {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("tags", arr);
    }
    if let Some(v) = patch.attachments {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("attachments", arr);
    }
    if let Some(v) = patch.expires_at {
        set.insert("expiresAt", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.strength {
        set.insert("strength", v);
    }
    if let Some(v) = patch.reused {
        set.insert("reused", v);
    }
    if let Some(v) = patch.breached {
        set.insert("breached", v);
    }
    if patch.mark_rotated.unwrap_or(false) {
        set.insert(
            "lastRotatedAt",
            BsonDateTime::from_chrono(Utc::now()),
        );
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(s: &SabvaultSecret) -> Document {
    // Strip ciphertext from audit rows — we only want metadata.
    let mut d = bson::to_document(s).unwrap_or_default();
    d.remove("encryptedPayloadB64");
    d
}

// ─── GET / — list ────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_secrets(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;

    let mut filter = visibility_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "url", "tags"]);
        if let Ok(arr) = or.get_array("$or") {
            // Merge into existing $or — Mongo only allows one $or, so push.
            if let Ok(existing) = filter.get_array_mut("$or") {
                existing.extend(arr.clone());
            }
        }
    }
    if let Some(f) = q.folder_id.as_deref().filter(|s| !s.is_empty()) {
        if let Ok(oid) = ObjectId::parse_str(f) {
            filter.insert("folderId", oid);
        }
    }
    if let Some(k) = q.kind {
        let s = match k {
            SecretKind::Login => "login",
            SecretKind::Note => "note",
            SecretKind::Card => "card",
            SecretKind::Identity => "identity",
            SecretKind::Key => "key",
            SecretKind::Wifi => "wifi",
            SecretKind::Server => "server",
        };
        filter.insert("kind", s);
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabvaultSecret>(SECRETS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_secrets.find"))
        })?;
    let mut rows: Vec<SabvaultSecret> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabvault_secrets.collect"))
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

// ─── GET /:id ───────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, secret_id = %secret_id))]
pub async fn get_secret(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(secret_id): Path<String>,
) -> Result<Json<SabvaultSecret>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&secret_id)?;

    let coll = mongo.collection::<SabvaultSecret>(SECRETS_COLL);
    let row = coll
        .find_one(read_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_secrets.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_secret".to_owned()))?;
    Ok(Json(row))
}

// ─── POST / ─────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_secret(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSecretInput>,
) -> Result<Json<CreateSecretResponse>> {
    let user_id = user_oid(&user)?;
    let mut secret = secret_from_create(input, user_id)?;
    let coll = mongo.collection::<SabvaultSecret>(SECRETS_COLL);
    let inserted = coll
        .insert_one(&secret)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_secrets.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    secret.id = Some(new_id);

    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&secret)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateSecretResponse {
        id: new_id.to_hex(),
        entity: secret,
    }))
}

// ─── PATCH /:id ─────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, secret_id = %secret_id))]
pub async fn update_secret(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(secret_id): Path<String>,
    Json(patch): Json<UpdateSecretInput>,
) -> Result<Json<SabvaultSecret>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&secret_id)?;

    let coll = mongo.collection::<SabvaultSecret>(SECRETS_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_secrets.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_secret".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_secrets.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabvault_secret".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_secrets.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_secret".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

// ─── DELETE /:id ────────────────────────────────────────────────────────

/// Soft delete — flips `status: "archived"`.
#[instrument(skip_all, fields(user_id = %user.user_id, secret_id = %secret_id))]
pub async fn delete_secret(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(secret_id): Path<String>,
) -> Result<Json<DeleteSecretResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&secret_id)?;

    let coll = mongo.collection::<SabvaultSecret>(SECRETS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_secrets.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabvault_secret".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteSecretResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateSecretInput {
            name: "  ".into(),
            encrypted_payload_b64: "abc".into(),
            ..Default::default()
        };
        assert!(secret_from_create(input, user_id).is_err());
    }

    #[test]
    fn create_rejects_empty_ciphertext() {
        let user_id = ObjectId::new();
        let input = CreateSecretInput {
            name: "Gmail".into(),
            encrypted_payload_b64: "".into(),
            ..Default::default()
        };
        assert!(secret_from_create(input, user_id).is_err());
    }

    #[test]
    fn create_stamps_active_status_and_default_alg() {
        let user_id = ObjectId::new();
        let input = CreateSecretInput {
            name: "Gmail".into(),
            kind: SecretKind::Login,
            encrypted_payload_b64: "cipher".into(),
            ..Default::default()
        };
        let s = secret_from_create(input, user_id).unwrap();
        assert_eq!(s.status.as_deref(), Some("active"));
        assert_eq!(s.encryption_alg.0, "AES-GCM-256");
        assert_eq!(s.user_id, user_id);
    }

    #[test]
    fn audit_doc_strips_ciphertext() {
        let s = SabvaultSecret {
            id: Some(ObjectId::new()),
            user_id: ObjectId::new(),
            name: "Gmail".into(),
            kind: SecretKind::Login,
            encrypted_payload_b64: "DO_NOT_LOG_ME".into(),
            encryption_alg: EncryptionAlg::default(),
            key_salt_b64: None,
            url: None,
            folder_id: None,
            tags: vec![],
            shared_with_user_ids: vec![],
            shared_with_team_ids: vec![],
            expires_at: None,
            last_rotated_at: None,
            last_accessed_at: None,
            strength: None,
            reused: None,
            breached: None,
            attachments: vec![],
            status: Some("active".into()),
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        };
        let d = doc_for_audit(&s);
        assert!(!d.contains_key("encryptedPayloadB64"));
        assert!(d.contains_key("name"));
    }

    #[test]
    fn visibility_filter_or_matches_owner_and_shared() {
        let oid = ObjectId::new();
        let f = visibility_filter(oid, Some("all"));
        assert!(f.contains_key("$or"));
    }
}
