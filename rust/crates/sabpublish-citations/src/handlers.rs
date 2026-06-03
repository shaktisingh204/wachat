//! HTTP handlers for SabPublish citations.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::{FindOptions, UpdateOptions};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{IngestCitationInput, IngestCitationResponse, ListQuery, UpdateCitationInput};
use crate::types::{FoundFields, SabpublishCitation};

const COLL: &str = "sabpublish_citations";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabpublishCitation>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_citations(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let loc = oid_from_str(&q.location_id)?;
    let mut filter = doc! { "userId": user_id, "locationId": loc };
    if let Some(s) = q.status.as_deref() {
        filter.insert("status", s);
    }
    let limit = q.limit.unwrap_or(100).clamp(1, 500) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "matchScore": -1, "lastCheckedAt": -1 })
        .limit(limit)
        .build();
    let coll = mongo.collection::<SabpublishCitation>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("citations.find")))?;
    let items = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("citations.collect")))?;
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn ingest_citation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<IngestCitationInput>,
) -> Result<Json<IngestCitationResponse>> {
    let user_id = user_oid(&user)?;
    let loc = oid_from_str(&input.location_id)?;
    if input.source_url.trim().is_empty() {
        return Err(ApiError::Validation("sourceUrl is required".to_owned()));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let found = FoundFields {
        name: input.found_name,
        address: input.found_address,
        phone: input.found_phone,
    };
    let coll = mongo.collection::<SabpublishCitation>(COLL);
    let filter = doc! {
        "userId": user_id,
        "locationId": loc,
        "sourceUrl": &input.source_url,
    };
    let found_doc = bson::to_document(&found).unwrap_or_default();
    let update = doc! {
        "$set": {
            "foundFields": found_doc,
            "matchScore": input.match_score as i32,
            "lastCheckedAt": now,
            "updatedAt": now,
        },
        "$setOnInsert": {
            "userId": user_id,
            "locationId": loc,
            "sourceUrl": &input.source_url,
            "status": "discovered",
            "createdAt": now,
        },
    };
    coll.update_one(filter.clone(), update)
        .with_options(UpdateOptions::builder().upsert(true).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("citations.upsert")))?;
    let entity = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("citations.refetch")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("citation upsert refetch empty")))?;
    let id = entity.id.map(|o| o.to_hex()).unwrap_or_default();
    Ok(Json(IngestCitationResponse { id, entity }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, citation_id = %id))]
pub async fn update_citation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateCitationInput>,
) -> Result<Json<SabpublishCitation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SabpublishCitation>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": { "status": &patch.status, "updatedAt": now } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("citations.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("citation".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("citations.refetch")))?
        .ok_or_else(|| ApiError::NotFound("citation".to_owned()))?;
    Ok(Json(after))
}
