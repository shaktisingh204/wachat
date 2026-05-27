//! HTTP handlers for SabWorkerly timesheets.

use axum::{Json, extract::{Path, Query, State}};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use crm_common::{pagination::{clamp_limit, skip_for}, tenant::user_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::*;
use crate::types::SabworkerlyTimesheet;

const COLL: &str = "sabworkerly_timesheets";

fn own(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabworkerlyTimesheet>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all)]
pub async fn list_timesheets(
    user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("all") {
        "all" => {}
        s @ ("draft" | "submitted" | "approved" | "invoiced" | "rejected") => {
            filter.insert("status", s);
        }
        _ => {}
    }
    if let Some(s) = q.placement_id.as_deref() {
        if !s.is_empty() { filter.insert("placementId", oid_from_str(s)?); }
    }
    if let Some(s) = q.worker_id.as_deref() {
        if !s.is_empty() { filter.insert("workerId", oid_from_str(s)?); }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "weekStart": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabworkerlyTimesheet>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let mut rows: Vec<SabworkerlyTimesheet> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn get_timesheet(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<SabworkerlyTimesheet>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyTimesheet>(COLL);
    let row = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("timesheet".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all)]
pub async fn create_timesheet(
    user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<CreateTimesheetInput>,
) -> Result<Json<CreateTimesheetResponse>> {
    let user_id = user_oid(&user)?;
    let placement_oid = oid_from_str(&input.placement_id)?;
    let worker_oid = oid_from_str(&input.worker_id)?;
    let mut t = SabworkerlyTimesheet {
        id: None,
        user_id,
        placement_id: placement_oid,
        worker_id: worker_oid,
        week_start: BsonDateTime::from_chrono(input.week_start),
        daily_hours_json: input.daily_hours_json,
        total_hours: input.total_hours,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        submitted_at: None,
        approved_by: None,
        approved_at: None,
        rejection_reason: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabworkerlyTimesheet>(COLL);
    let inserted = coll.insert_one(&t).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let new_id = inserted.inserted_id.as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    t.id = Some(new_id);
    Ok(Json(CreateTimesheetResponse { id: new_id.to_hex(), entity: t }))
}

#[instrument(skip_all)]
pub async fn update_timesheet(
    user: AuthUser, State(mongo): State<MongoHandle>,
    Path(id): Path<String>, Json(patch): Json<UpdateTimesheetInput>,
) -> Result<Json<SabworkerlyTimesheet>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.daily_hours_json {
        let b = to_bson(&v).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
        set.insert("dailyHoursJson", b);
    }
    if let Some(v) = patch.total_hours { set.insert("totalHours", v); }
    if let Some(v) = patch.status { set.insert("status", v); }
    let coll = mongo.collection::<SabworkerlyTimesheet>(COLL);
    let result = coll.update_one(own(user_id, oid), doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 { return Err(ApiError::NotFound("timesheet".to_owned())); }
    let after = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("timesheet".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all)]
pub async fn delete_timesheet(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<DeleteTimesheetResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyTimesheet>(COLL);
    let result = coll.delete_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(DeleteTimesheetResponse { deleted: result.deleted_count > 0 }))
}

// ─── Workflow transitions ───────────────────────────────────────────────

#[instrument(skip_all)]
pub async fn submit_timesheet(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<SabworkerlyTimesheet>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SabworkerlyTimesheet>(COLL);
    let result = coll.update_one(
        doc! { "_id": oid, "userId": user_id, "status": { "$in": ["draft", "rejected"] } },
        doc! { "$set": { "status": "submitted", "submittedAt": now, "updatedAt": now } },
    ).await.map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 {
        return Err(ApiError::Validation("timesheet not in draft/rejected".to_owned()));
    }
    let after = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("timesheet".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all)]
pub async fn approve_timesheet(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<SabworkerlyTimesheet>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let approver = user.user_id.to_string();
    let coll = mongo.collection::<SabworkerlyTimesheet>(COLL);
    let result = coll.update_one(
        doc! { "_id": oid, "userId": user_id, "status": "submitted" },
        doc! { "$set": {
            "status": "approved",
            "approvedBy": approver,
            "approvedAt": now,
            "updatedAt": now,
        }},
    ).await.map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 {
        return Err(ApiError::Validation("timesheet not in submitted state".to_owned()));
    }
    let after = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("timesheet".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all)]
pub async fn reject_timesheet(
    user: AuthUser, State(mongo): State<MongoHandle>,
    Path(id): Path<String>, Json(body): Json<RejectInput>,
) -> Result<Json<SabworkerlyTimesheet>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! {
        "status": "rejected",
        "rejectionReason": body.reason.unwrap_or_default(),
        "updatedAt": now,
    };
    set.insert("approvedAt", bson::Bson::Null);
    set.insert("approvedBy", bson::Bson::Null);
    let coll = mongo.collection::<SabworkerlyTimesheet>(COLL);
    let result = coll.update_one(
        doc! { "_id": oid, "userId": user_id, "status": "submitted" },
        doc! { "$set": set },
    ).await.map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 {
        return Err(ApiError::Validation("timesheet not in submitted state".to_owned()));
    }
    let after = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("timesheet".to_owned()))?;
    Ok(Json(after))
}
