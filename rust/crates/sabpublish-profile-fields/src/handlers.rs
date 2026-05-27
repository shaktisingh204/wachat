//! HTTP handlers for SabPublish profile fields.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::UpdateOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    BulkUpsertInput, BulkUpsertResponse, ListQuery, UpsertFieldInput, UpsertFieldResponse,
};
use crate::types::SabpublishProfileField;

const COLL: &str = "sabpublish_profile_fields";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabpublishProfileField>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_fields(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let loc = oid_from_str(&q.location_id)?;
    let coll = mongo.collection::<SabpublishProfileField>(COLL);
    let cursor = coll
        .find(doc! { "userId": user_id, "locationId": loc })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("profile_fields.find")))?;
    let items: Vec<SabpublishProfileField> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("profile_fields.collect"))
    })?;
    Ok(Json(ListResponse { items }))
}

async fn upsert_one(
    mongo: &MongoHandle,
    user_id: ObjectId,
    location_id: ObjectId,
    field_key: &str,
    value: &str,
) -> Result<SabpublishProfileField> {
    let coll = mongo.collection::<SabpublishProfileField>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let filter = doc! { "userId": user_id, "locationId": location_id, "fieldKey": field_key };
    let update = doc! {
        "$set": {
            "value": value,
            "lastEditedAt": now,
            "updatedAt": now,
        },
        "$setOnInsert": {
            "userId": user_id,
            "locationId": location_id,
            "fieldKey": field_key,
            "createdAt": now,
        },
    };
    coll.update_one(filter.clone(), update)
        .with_options(UpdateOptions::builder().upsert(true).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("profile_fields.upsert")))?;
    coll.find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("profile_fields.refetch")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("upsert refetch returned nothing")))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_field(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertFieldInput>,
) -> Result<Json<UpsertFieldResponse>> {
    let user_id = user_oid(&user)?;
    let loc = oid_from_str(&input.location_id)?;
    if input.field_key.trim().is_empty() {
        return Err(ApiError::Validation("fieldKey is required".to_owned()));
    }
    let entity = upsert_one(&mongo, user_id, loc, &input.field_key, &input.value).await?;
    let id = entity.id.map(|o| o.to_hex()).unwrap_or_default();
    Ok(Json(UpsertFieldResponse { id, entity }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn bulk_upsert(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<BulkUpsertInput>,
) -> Result<Json<BulkUpsertResponse>> {
    let user_id = user_oid(&user)?;
    let loc = oid_from_str(&input.location_id)?;
    let mut count: u32 = 0;
    for kv in input.fields {
        if kv.field_key.trim().is_empty() {
            continue;
        }
        upsert_one(&mongo, user_id, loc, &kv.field_key, &kv.value).await?;
        count += 1;
    }
    Ok(Json(BulkUpsertResponse { upserted: count }))
}
