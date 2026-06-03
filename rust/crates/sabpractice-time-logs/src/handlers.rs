//! HTTP handlers for the SabPractice Time-Log entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
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
    CreateTimeLogInput, CreateTimeLogResponse, DeleteTimeLogResponse, ListQuery, UpdateTimeLogInput,
};
use crate::types::SabPracticeTimeLog;

const COLL: &str = "sabpractice_time_logs";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(input: CreateTimeLogInput, user_id: ObjectId) -> Result<SabPracticeTimeLog> {
    if input.hours <= 0.0 {
        return Err(ApiError::Validation(
            "hours must be greater than 0".to_owned(),
        ));
    }
    let engagement_oid = match input.engagement_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let client_oid = match input.client_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(SabPracticeTimeLog {
        id: None,
        user_id,
        task_id: oid_from_str(&input.task_id)?,
        engagement_id: engagement_oid,
        client_id: client_oid,
        logger_user_id: input.logger_user_id,
        date: BsonDateTime::from_chrono(input.date),
        hours: input.hours,
        notes: input.notes,
        billable: input.billable,
        billed_invoice_id: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTimeLogInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.date {
        set.insert("date", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.hours {
        set.insert("hours", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.billable {
        set.insert("billable", v);
    }
    if let Some(v) = patch.billed_invoice_id {
        if v.is_empty() {
            set.insert("billedInvoiceId", bson::Bson::Null);
        } else {
            set.insert("billedInvoiceId", v);
        }
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabPracticeTimeLog>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
    pub total_hours: f64,
    pub billable_hours: f64,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_time_logs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.task_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("taskId", oid_from_str(s)?);
    }
    if let Some(s) = q.engagement_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("engagementId", oid_from_str(s)?);
    }
    if let Some(s) = q.client_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("clientId", oid_from_str(s)?);
    }
    if let Some(uid) = q.logger_user_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("loggerUserId", uid);
    }
    match (q.from, q.to) {
        (Some(f), Some(t)) => {
            filter.insert(
                "date",
                doc! {
                    "$gte": BsonDateTime::from_chrono(f),
                    "$lte": BsonDateTime::from_chrono(t),
                },
            );
        }
        (Some(f), None) => {
            filter.insert("date", doc! { "$gte": BsonDateTime::from_chrono(f) });
        }
        (None, Some(t)) => {
            filter.insert("date", doc! { "$lte": BsonDateTime::from_chrono(t) });
        }
        _ => {}
    }
    if let Some(b) = q.billable {
        filter.insert("billable", b);
    }
    if q.unbilled_only.unwrap_or(false) {
        filter.insert("billedInvoiceId", doc! { "$in": [bson::Bson::Null] });
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "date": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabPracticeTimeLog>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_time_logs.find"))
    })?;
    let mut rows: Vec<SabPracticeTimeLog> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_time_logs.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    let total_hours: f64 = rows.iter().map(|r| r.hours).sum();
    let billable_hours: f64 = rows.iter().filter(|r| r.billable).map(|r| r.hours).sum();
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
        total_hours,
        billable_hours,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_time_log(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabPracticeTimeLog>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeTimeLog>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_time_logs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("time_log".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_time_log(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTimeLogInput>,
) -> Result<Json<CreateTimeLogResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabPracticeTimeLog>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpractice_time_logs.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateTimeLogResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_time_log(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateTimeLogInput>,
) -> Result<Json<SabPracticeTimeLog>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeTimeLog>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_time_logs.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("time_log".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_time_logs.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("time_log".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_time_log(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteTimeLogResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeTimeLog>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpractice_time_logs.delete"))
        })?;
    Ok(Json(DeleteTimeLogResponse {
        deleted: result.deleted_count > 0,
    }))
}
