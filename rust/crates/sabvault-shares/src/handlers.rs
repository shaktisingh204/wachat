//! SabVault share-grant CRUD.
//!
//! Only the **owner** of a secret can grant or revoke shares. When a grant
//! is created/revoked, the parent secret's `sharedWithUserIds` /
//! `sharedWithTeamIds` array is kept in sync so the visibility filter in
//! `sabvault-secrets` Just Works.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateShareInput, CreateShareResponse, ListQuery, ListResponse, RevokeShareResponse,
    UpdateShareInput,
};
use crate::types::{GranteeType, SabvaultShare, SharePermission};

pub const SHARES_COLL: &str = "sabvault_shares";
const SECRETS_COLL: &str = "sabvault_secrets";
const ENTITY_KIND: &str = "sabvault_share";

fn permission_str(p: &SharePermission) -> &'static str {
    match p {
        SharePermission::Read => "read",
        SharePermission::Use => "use",
        SharePermission::Edit => "edit",
    }
}

fn grantee_field(t: &GranteeType) -> &'static str {
    match t {
        GranteeType::User => "sharedWithUserIds",
        GranteeType::Team => "sharedWithTeamIds",
    }
}

/// Verifies the caller owns the secret referenced in a share request.
async fn assert_secret_owner(
    mongo: &MongoHandle,
    user_id: ObjectId,
    secret_oid: ObjectId,
) -> Result<()> {
    let coll = mongo.collection::<Document>(SECRETS_COLL);
    let found = coll
        .find_one(doc! { "_id": secret_oid, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("secret.owner_check")))?;
    if found.is_none() {
        return Err(ApiError::Forbidden(
            "only the secret owner may grant or revoke shares".to_owned(),
        ));
    }
    Ok(())
}

/// Push grantee into the secret's denormalized array so visibility filters
/// in `sabvault-secrets` can keep using a single Mongo query.
async fn sync_secret_grantees_add(
    mongo: &MongoHandle,
    secret_oid: ObjectId,
    grantee_type: &GranteeType,
    grantee_oid: ObjectId,
) -> Result<()> {
    let coll = mongo.collection::<Document>(SECRETS_COLL);
    let field = grantee_field(grantee_type);
    coll.update_one(
        doc! { "_id": secret_oid },
        doc! { "$addToSet": { field: grantee_oid } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("secret.sync_grantees_add"))
    })?;
    Ok(())
}

async fn sync_secret_grantees_remove(
    mongo: &MongoHandle,
    secret_oid: ObjectId,
    grantee_type: &GranteeType,
    grantee_oid: ObjectId,
) -> Result<()> {
    let coll = mongo.collection::<Document>(SECRETS_COLL);
    let field = grantee_field(grantee_type);
    coll.update_one(
        doc! { "_id": secret_oid },
        doc! { "$pull": { field: grantee_oid } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("secret.sync_grantees_remove"))
    })?;
    Ok(())
}

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "revoked" => {
            filter.insert("revokedAt", doc! { "$exists": true });
        }
        _ => {
            filter.insert("revokedAt", doc! { "$exists": false });
        }
    }
    filter
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_shares(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(s) = q.secret_id.as_deref().filter(|s| !s.is_empty()) {
        if let Ok(oid) = ObjectId::parse_str(s) {
            filter.insert("secretId", oid);
        }
    }
    if let Some(g) = q.grantee_id.as_deref().filter(|s| !s.is_empty()) {
        if let Ok(oid) = ObjectId::parse_str(g) {
            filter.insert("granteeId", oid);
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "grantedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabvaultShare>(SHARES_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvault_shares.find")))?;
    let mut rows: Vec<SabvaultShare> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabvault_shares.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_share(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateShareInput>,
) -> Result<Json<CreateShareResponse>> {
    let user_id = user_oid(&user)?;
    let secret_oid = oid_from_str(&input.secret_id)?;
    let grantee_oid = oid_from_str(&input.grantee_id)?;

    assert_secret_owner(&mongo, user_id, secret_oid).await?;

    let mut share = SabvaultShare {
        id: None,
        user_id,
        secret_id: secret_oid,
        grantee_type: input.grantee_type.clone(),
        grantee_id: grantee_oid,
        permission: input.permission,
        granted_by: user_id,
        granted_at: BsonDateTime::from_chrono(Utc::now()),
        expires_at: input.expires_at.map(BsonDateTime::from_chrono),
        revoked_at: None,
        revoked_by: None,
        rewrapped_payload_b64: input.rewrapped_payload_b64,
    };

    let coll = mongo.collection::<SabvaultShare>(SHARES_COLL);
    let inserted = coll.insert_one(&share).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabvault_shares.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    share.id = Some(new_id);

    sync_secret_grantees_add(&mongo, secret_oid, &input.grantee_type, grantee_oid).await?;

    if let Some(event) = audit_for_create(
        &user,
        ENTITY_KIND,
        new_id,
        Some(bson::to_document(&share).unwrap_or_default()),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateShareResponse {
        id: new_id.to_hex(),
        entity: share,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, share_id = %share_id))]
pub async fn update_share(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(share_id): Path<String>,
    Json(patch): Json<UpdateShareInput>,
) -> Result<Json<SabvaultShare>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&share_id)?;
    let coll = mongo.collection::<SabvaultShare>(SHARES_COLL);

    let before = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_shares.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_share".to_owned()))?;

    let mut set = doc! {};
    if let Some(p) = patch.permission {
        set.insert("permission", permission_str(&p));
    }
    if let Some(v) = patch.expires_at {
        set.insert("expiresAt", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.rewrapped_payload_b64 {
        set.insert("rewrappedPayloadB64", v);
    }
    if !set.is_empty() {
        coll.update_one(
            doc! { "_id": oid, "userId": user_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_shares.update"))
        })?;
    }

    let after = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_shares.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_share".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(bson::to_document(&before).unwrap_or_default()),
        Some(bson::to_document(&after).unwrap_or_default()),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

/// Revoke (soft delete) — stamps `revokedAt`, pulls grantee from the
/// secret's denormalized array.
#[instrument(skip_all, fields(user_id = %user.user_id, share_id = %share_id))]
pub async fn revoke_share(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(share_id): Path<String>,
) -> Result<Json<RevokeShareResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&share_id)?;
    let coll = mongo.collection::<SabvaultShare>(SHARES_COLL);

    let row = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_shares.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_share".to_owned()))?;

    coll.update_one(
        doc! { "_id": oid, "userId": user_id },
        doc! { "$set": {
            "revokedAt": BsonDateTime::from_chrono(Utc::now()),
            "revokedBy": user_id,
        }},
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvault_shares.revoke")))?;

    sync_secret_grantees_remove(&mongo, row.secret_id, &row.grantee_type, row.grantee_id).await?;

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(RevokeShareResponse { revoked: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_strs() {
        assert_eq!(permission_str(&SharePermission::Read), "read");
        assert_eq!(permission_str(&SharePermission::Use), "use");
        assert_eq!(permission_str(&SharePermission::Edit), "edit");
    }

    #[test]
    fn grantee_field_routes_to_right_array() {
        assert_eq!(grantee_field(&GranteeType::User), "sharedWithUserIds");
        assert_eq!(grantee_field(&GranteeType::Team), "sharedWithTeamIds");
    }

    #[test]
    fn list_filter_defaults_to_active() {
        let f = list_filter(ObjectId::new(), None);
        assert!(f.contains_key("revokedAt"));
    }
}
