//! Form-analytics handlers.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::{FindOneAndUpdateOptions, FindOptions, ReturnDocument};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{DeleteResponse, ListQuery, UpsertFormAnalyticsInput, UpsertResponse};
use crate::types::FormAnalytics;

const COLL: &str = "pagesense_form_analytics";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<FormAnalytics>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %q.site_id))]
pub async fn list_forms(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let site_id = oid_from_str(&q.site_id)?;
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<FormAnalytics>(COLL);
    let cursor = coll
        .find(doc! { "userId": user_id, "siteId": site_id })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_form_analytics.find"))
        })?;
    let mut rows: Vec<FormAnalytics> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_form_analytics.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %input.site_id, selector = %input.form_selector))]
pub async fn upsert_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertFormAnalyticsInput>,
) -> Result<Json<UpsertResponse>> {
    let user_id = user_oid(&user)?;
    let site_id = oid_from_str(&input.site_id)?;
    if input.form_selector.trim().is_empty() {
        return Err(ApiError::Validation("formSelector is required".into()));
    }

    let dropoff_bson = bson::to_bson(&input.per_field_dropoff).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_form_analytics.dropoff_bson"))
    })?;

    let coll = mongo.collection::<FormAnalytics>(COLL);
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();
    let row = coll
        .find_one_and_update(
            doc! { "userId": user_id, "siteId": site_id, "formSelector": &input.form_selector },
            doc! {
                "$set": {
                    "perFieldDropoff": dropoff_bson,
                    "completionRate": input.completion_rate.unwrap_or(0.0) as f64,
                    "updatedAt": BsonDateTime::from_chrono(Utc::now()),
                },
                "$setOnInsert": {
                    "userId": user_id,
                    "siteId": site_id,
                    "formSelector": &input.form_selector,
                    "createdAt": BsonDateTime::from_chrono(Utc::now()),
                },
            },
        )
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_form_analytics.upsert"))
        })?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("upsert returned no doc")))?;
    let id: ObjectId = row
        .id
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("form analytics doc missing _id")))?;
    Ok(Json(UpsertResponse { id: id.to_hex() }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, form_id = %form_id))]
pub async fn delete_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
) -> Result<Json<DeleteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<FormAnalytics>(COLL);
    let result = coll
        .delete_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_form_analytics.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("form_analytics".into()));
    }
    Ok(Json(DeleteResponse { deleted: true }))
}
