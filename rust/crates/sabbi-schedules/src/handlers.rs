//! HTTP handlers for the SabBI Schedule entity.

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
    CreateScheduleInput, CreateScheduleResponse, DeleteScheduleResponse, ListQuery,
    UpdateScheduleInput,
};
use crate::types::BiSchedule;

pub(crate) const COLL: &str = "sabbi_schedules";

fn validate_format(value: &str) -> Result<()> {
    match value {
        "pdf" | "csv" | "inline" => Ok(()),
        other => Err(ApiError::Validation(format!(
            "unsupported format '{other}' (expected pdf | csv | inline)"
        ))),
    }
}

fn list_filter(user_id: ObjectId, status: Option<&str>, workbook_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        "paused" => {
            filter.insert("status", "paused");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(s) = workbook_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("workbookId", s);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn schedule_from_create(input: CreateScheduleInput, user_id: ObjectId) -> Result<BiSchedule> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.cron.trim().is_empty() {
        return Err(ApiError::Validation("cron is required".to_owned()));
    }
    validate_format(&input.format)?;
    let workbook_id = ObjectId::parse_str(&input.workbook_id)
        .map_err(|_| ApiError::Validation("workbookId is not a valid ObjectId".to_owned()))?;
    Ok(BiSchedule {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        workbook_id,
        cron: input.cron.trim().to_owned(),
        recipients: input
            .recipients
            .into_iter()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .collect(),
        format: input.format,
        last_run_at: None,
        next_run_at: None,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateScheduleInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch
        .cron
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("cron", v);
    }
    if let Some(v) = patch.recipients {
        let cleaned: Vec<String> = v
            .into_iter()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .collect();
        set.insert("recipients", cleaned);
    }
    if let Some(v) = patch.format {
        validate_format(&v)?;
        set.insert("format", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BiSchedule>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_schedules(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let filter = list_filter(user_id, q.status.as_deref(), q.workbook_id.as_deref());
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<BiSchedule>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbi_schedules.find"))
        })?;
    let mut rows: Vec<BiSchedule> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbi_schedules.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %schedule_id))]
pub async fn get_schedule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(schedule_id): Path<String>,
) -> Result<Json<BiSchedule>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&schedule_id)?;
    let coll = mongo.collection::<BiSchedule>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_schedules.find_one")))?
        .ok_or_else(|| ApiError::NotFound("schedule".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_schedule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateScheduleInput>,
) -> Result<Json<CreateScheduleResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = schedule_from_create(input, user_id)?;
    let coll = mongo.collection::<BiSchedule>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_schedules.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateScheduleResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %schedule_id))]
pub async fn update_schedule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(schedule_id): Path<String>,
    Json(patch): Json<UpdateScheduleInput>,
) -> Result<Json<BiSchedule>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&schedule_id)?;
    let coll = mongo.collection::<BiSchedule>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_schedules.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("schedule".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_schedules.refetch")))?
        .ok_or_else(|| ApiError::NotFound("schedule".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %schedule_id))]
pub async fn delete_schedule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(schedule_id): Path<String>,
) -> Result<Json<DeleteScheduleResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&schedule_id)?;
    let coll = mongo.collection::<BiSchedule>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabbi_schedules.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("schedule".to_owned()));
    }
    Ok(Json(DeleteScheduleResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_format() {
        assert!(validate_format("xls").is_err());
        for f in ["pdf", "csv", "inline"] {
            assert!(validate_format(f).is_ok());
        }
    }
}
