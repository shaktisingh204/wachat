//! HTTP handlers for the Time Log entity.
//!
//! Collection: `crm_time_logs`. All queries are scoped by
//! `userId == AuthUser.user_id` (tenant root). Soft-delete is performed
//! by setting `status = "archived"`; the list endpoint hides archived
//! rows by default.
//!
//! Validation rule on insert/update:
//!   `duration_minutes > 0` OR (`ended_at is None` AND `status == "running"`).
//!
//! Status transitions:
//!   * `stopped` → `approved` stamps `approvedAt = now()` (and
//!     `approvedBy` if the patch supplies it).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    CreateTimeLogInput, CreateTimeLogResponse, DeleteTimeLogResponse, ListQuery, UpdateTimeLogInput,
};
use crate::types::CrmTimeLog;

const COLL: &str = "crm_time_logs";
const ENTITY_KIND: &str = "time_log";

// =========================================================================
// Helpers
// =========================================================================

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    project_id: Option<ObjectId>,
    task_id: Option<ObjectId>,
    entity_kind: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "running" | "stopped" | "approved" | "rejected" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(p) = project_id {
        filter.insert("projectId", p);
    }
    if let Some(t) = task_id {
        filter.insert("taskId", t);
    }
    if let Some(k) = entity_kind.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("entityKind", k);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn parse_oid_opt(s: Option<&str>) -> Option<ObjectId> {
    s.and_then(|v| ObjectId::parse_str(v).ok())
}

fn is_valid_entity_kind(k: &str) -> bool {
    matches!(k, "task" | "project_task" | "issue" | "ticket")
}

fn is_valid_status(s: &str) -> bool {
    matches!(
        s,
        "running" | "stopped" | "approved" | "rejected" | "archived"
    )
}

/// Enforce the duration-vs-running invariant. Returns an
/// `ApiError::Validation` when the combination is illegal.
fn validate_duration(
    duration_minutes: f64,
    ended_at: Option<BsonDateTime>,
    status: &str,
) -> Result<()> {
    let is_running_open = ended_at.is_none() && status == "running";
    if !(duration_minutes > 0.0 || is_running_open) {
        return Err(ApiError::Validation(
            "durationMinutes must be > 0, or status must be \"running\" with no endedAt".to_owned(),
        ));
    }
    Ok(())
}

fn log_from_create(input: CreateTimeLogInput, user_id: ObjectId) -> Result<CrmTimeLog> {
    let now = BsonDateTime::from_chrono(Utc::now());
    let started_at = input
        .started_at
        .as_deref()
        .and_then(parse_date)
        .unwrap_or(now);
    let ended_at = input.ended_at.as_deref().and_then(parse_date);
    let status = input.status.unwrap_or_else(|| "stopped".to_owned());
    if !is_valid_status(&status) {
        return Err(ApiError::Validation(format!("invalid status \"{status}\"")));
    }
    if let Some(k) = input.entity_kind.as_deref() {
        if !is_valid_entity_kind(k) {
            return Err(ApiError::Validation(format!("invalid entityKind \"{k}\"")));
        }
    }
    let duration_minutes = input.duration_minutes.unwrap_or(0.0);
    validate_duration(duration_minutes, ended_at, &status)?;

    let approved_at = if status == "approved" {
        Some(now)
    } else {
        None
    };

    Ok(CrmTimeLog {
        id: None,
        user_id,
        user_log_id: parse_oid_opt(input.user_log_id.as_deref()),
        project_id: parse_oid_opt(input.project_id.as_deref()),
        task_id: parse_oid_opt(input.task_id.as_deref()),
        issue_id: parse_oid_opt(input.issue_id.as_deref()),
        entity_kind: input.entity_kind,
        entity_id: parse_oid_opt(input.entity_id.as_deref()),
        started_at,
        ended_at,
        duration_minutes,
        description: input.description,
        is_billable: input.is_billable.unwrap_or(false),
        hourly_rate: input.hourly_rate,
        status,
        approved_by: None,
        approved_at,
        created_at: now,
        updated_at: None,
    })
}

/// Build the `$set` update doc from the patch. Returns the doc alongside
/// the (possibly updated) `status` so the caller can audit the new shape.
fn build_update_doc(patch: UpdateTimeLogInput, before: &CrmTimeLog) -> Result<Document> {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };

    // Validate entityKind / status up-front so we don't half-mutate.
    if let Some(k) = patch.entity_kind.as_deref() {
        if !is_valid_entity_kind(k) {
            return Err(ApiError::Validation(format!("invalid entityKind \"{k}\"")));
        }
    }
    if let Some(s) = patch.status.as_deref() {
        if !is_valid_status(s) {
            return Err(ApiError::Validation(format!("invalid status \"{s}\"")));
        }
    }

    // Compute the post-patch values used by the duration validation.
    let next_duration = patch.duration_minutes.unwrap_or(before.duration_minutes);
    let next_ended_at = match patch.ended_at.as_deref() {
        Some(s) => parse_date(s),
        None => before.ended_at,
    };
    let next_status = patch
        .status
        .clone()
        .unwrap_or_else(|| before.status.clone());
    validate_duration(next_duration, next_ended_at, &next_status)?;

    if let Some(v) = parse_oid_opt(patch.user_log_id.as_deref()) {
        set.insert("userLogId", v);
    }
    if let Some(v) = parse_oid_opt(patch.project_id.as_deref()) {
        set.insert("projectId", v);
    }
    if let Some(v) = parse_oid_opt(patch.task_id.as_deref()) {
        set.insert("taskId", v);
    }
    if let Some(v) = parse_oid_opt(patch.issue_id.as_deref()) {
        set.insert("issueId", v);
    }
    if let Some(v) = patch.entity_kind {
        set.insert("entityKind", v);
    }
    if let Some(v) = parse_oid_opt(patch.entity_id.as_deref()) {
        set.insert("entityId", v);
    }
    if let Some(v) = patch.started_at.as_deref().and_then(parse_date) {
        set.insert("startedAt", v);
    }
    if let Some(v) = patch.ended_at.as_deref().and_then(parse_date) {
        set.insert("endedAt", v);
    }
    if let Some(v) = patch.duration_minutes {
        set.insert("durationMinutes", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.is_billable {
        set.insert("isBillable", v);
    }
    if let Some(v) = patch.hourly_rate {
        set.insert("hourlyRate", v);
    }
    if let Some(v) = patch.status.as_deref() {
        set.insert("status", v);
        // Stamp approvedAt on transition into "approved" unless the patch
        // explicitly supplies one.
        if v == "approved" && before.status != "approved" {
            let stamped = patch
                .approved_at
                .as_deref()
                .and_then(parse_date)
                .unwrap_or(now);
            set.insert("approvedAt", stamped);
        }
    }
    if let Some(v) = parse_oid_opt(patch.approved_by.as_deref()) {
        set.insert("approvedBy", v);
    }
    if let Some(v) = patch.approved_at.as_deref().and_then(parse_date) {
        // Honour an explicit approvedAt regardless of status transition.
        set.insert("approvedAt", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmTimeLog) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTimeLog>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

// =========================================================================
// GET / — list_time_logs
// =========================================================================

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_time_logs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let project_oid = match q.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let task_oid = match q.task_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        project_oid,
        task_oid,
        q.entity_kind.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "startedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmTimeLog>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_time_logs.find")))?;
    let mut rows: Vec<CrmTimeLog> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_time_logs.collect")))?;
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

// =========================================================================
// GET /:id — get_time_log
// =========================================================================

#[instrument(skip_all, fields(user_id = %user.user_id, id = %log_id))]
pub async fn get_time_log(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(log_id): Path<String>,
) -> Result<Json<CrmTimeLog>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&log_id)?;
    let coll = mongo.collection::<CrmTimeLog>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_time_logs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("time_log".to_owned()))?;
    Ok(Json(row))
}

// =========================================================================
// POST / — create_time_log
// =========================================================================

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_time_log(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTimeLogInput>,
) -> Result<Json<CreateTimeLogResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = log_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmTimeLog>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_time_logs.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateTimeLogResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

// =========================================================================
// PATCH /:id — update_time_log
// =========================================================================

#[instrument(skip_all, fields(user_id = %user.user_id, id = %log_id))]
pub async fn update_time_log(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(log_id): Path<String>,
    Json(patch): Json<UpdateTimeLogInput>,
) -> Result<Json<CrmTimeLog>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&log_id)?;
    let coll = mongo.collection::<CrmTimeLog>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_time_logs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("time_log".to_owned()))?;
    let update = build_update_doc(patch, &before)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_time_logs.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("time_log".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_time_logs.refetch")))?
        .ok_or_else(|| ApiError::NotFound("time_log".to_owned()))?;
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

// =========================================================================
// DELETE /:id — delete_time_log (soft)
// =========================================================================

#[instrument(skip_all, fields(user_id = %user.user_id, id = %log_id))]
pub async fn delete_time_log(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(log_id): Path<String>,
) -> Result<Json<DeleteTimeLogResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&log_id)?;
    let coll = mongo.collection::<CrmTimeLog>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_time_logs.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("time_log".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteTimeLogResponse { deleted: true }))
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None);
        assert!(f.contains_key("status"));
        let s = f.get_document("status").unwrap();
        assert_eq!(s.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn validate_duration_allows_running_with_no_end() {
        // Open running timer: duration may be 0.
        assert!(validate_duration(0.0, None, "running").is_ok());
    }

    #[test]
    fn validate_duration_rejects_zero_when_stopped() {
        // Stopped row with zero duration is illegal.
        let err = validate_duration(0.0, None, "stopped").unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn log_from_create_stamps_approved_at_when_status_approved() {
        let user_id = ObjectId::new();
        let input = CreateTimeLogInput {
            duration_minutes: Some(30.0),
            status: Some("approved".into()),
            ..Default::default()
        };
        let log = log_from_create(input, user_id).unwrap();
        assert_eq!(log.status, "approved");
        assert!(log.approved_at.is_some());
    }
}
