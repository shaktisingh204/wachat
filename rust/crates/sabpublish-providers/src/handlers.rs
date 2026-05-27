//! HTTP handlers for SabPublish provider connections.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    DeleteProviderResponse, ListQuery, UpdateProviderInput, UpsertProviderInput,
    UpsertProviderResponse,
};
use crate::types::SabpublishProvider;

const COLL: &str = "sabpublish_providers";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabpublishProvider>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_providers(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(loc) = q.location_id.as_deref() {
        let oid = oid_from_str(loc)?;
        filter.insert("locationId", oid);
    }
    if let Some(pid) = q.provider_id.as_deref() {
        filter.insert("providerId", pid);
    }
    let coll = mongo.collection::<SabpublishProvider>(COLL);
    let cursor = coll.find(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.find"))
    })?;
    let items: Vec<SabpublishProvider> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.collect"))
    })?;
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_provider(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabpublishProvider>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabpublishProvider>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("provider".to_owned()))?;
    Ok(Json(row))
}

/// Upsert by (locationId, providerId) — the natural key.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_provider(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertProviderInput>,
) -> Result<Json<UpsertProviderResponse>> {
    let user_id = user_oid(&user)?;
    let loc = oid_from_str(&input.location_id)?;
    if input.provider_id.trim().is_empty() {
        return Err(ApiError::Validation("providerId is required".to_owned()));
    }
    let coll = mongo.collection::<SabpublishProvider>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());

    let existing = coll
        .find_one(doc! {
            "userId": user_id,
            "locationId": loc,
            "providerId": &input.provider_id,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.find_natural"))
        })?;

    if let Some(mut row) = existing {
        let id = row.id.expect("existing row missing _id");
        let mut set = doc! { "updatedAt": now };
        if let Some(v) = input.connection_status.as_deref() {
            set.insert("connectionStatus", v);
        }
        if let Some(v) = input.external_listing_id.as_deref() {
            set.insert("externalListingId", v);
        }
        if let Some(v) = input.credentials_ref.as_deref() {
            set.insert("credentialsRef", v);
        }
        if let Some(v) = input.error_message.as_deref() {
            set.insert("errorMessage", v);
        }
        coll.update_one(ownership_filter(user_id, id), doc! { "$set": set })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.update"))
            })?;
        let after = coll
            .find_one(ownership_filter(user_id, id))
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.refetch"))
            })?
            .ok_or_else(|| ApiError::NotFound("provider".to_owned()))?;
        row = after;
        return Ok(Json(UpsertProviderResponse {
            id: id.to_hex(),
            entity: row,
        }));
    }

    let mut entity = SabpublishProvider {
        id: None,
        user_id,
        location_id: loc,
        provider_id: input.provider_id,
        connection_status: input
            .connection_status
            .unwrap_or_else(|| "not_connected".to_owned()),
        external_listing_id: input.external_listing_id,
        last_sync_at: None,
        credentials_ref: input.credentials_ref,
        error_message: input.error_message,
        created_at: now,
        updated_at: None,
    };
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(UpsertProviderResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_provider(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateProviderInput>,
) -> Result<Json<SabpublishProvider>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabpublishProvider>(COLL);
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.connection_status {
        set.insert("connectionStatus", v);
    }
    if let Some(v) = patch.external_listing_id {
        set.insert("externalListingId", v);
    }
    if let Some(v) = patch.credentials_ref {
        set.insert("credentialsRef", v);
    }
    if let Some(v) = patch.error_message {
        set.insert("errorMessage", v);
    }
    if let Some(ms) = patch.last_sync_at_ms {
        if let Some(dt) = Utc.timestamp_millis_opt(ms).single() {
            set.insert("lastSyncAt", BsonDateTime::from_chrono(dt));
        }
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("provider".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("provider".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_provider(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteProviderResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabpublishProvider>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpublish_providers.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("provider".to_owned()));
    }
    Ok(Json(DeleteProviderResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ownership_filter_includes_user() {
        let u = ObjectId::new();
        let o = ObjectId::new();
        let f = ownership_filter(u, o);
        assert!(f.contains_key("userId"));
        assert!(f.contains_key("_id"));
    }
}
