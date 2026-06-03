//! HTTP handlers for the LeaveRequest entity (`crm_leave_requests`).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, NaiveDate, Utc};
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
    CreateLeaveRequestInput, CreateLeaveRequestResponse, DeleteLeaveRequestResponse, ListQuery,
    UpdateLeaveRequestInput,
};
use crate::types::CrmLeaveRequest;

const COLL: &str = "crm_leave_requests";
const ENTITY_KIND: &str = "leave_request";

/// Parse an RFC3339 datetime *or* a bare `YYYY-MM-DD` date (treated as
/// midnight UTC). The Next.js side submits both shapes.
fn parse_date(s: &str) -> Option<BsonDateTime> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(BsonDateTime::from_chrono(dt.with_timezone(&Utc)));
    }
    if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
        let dt = d.and_hms_opt(0, 0, 0)?.and_utc();
        return Some(BsonDateTime::from_chrono(dt));
    }
    None
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    employee_id: Option<&str>,
    leave_type: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "Pending" | "Approved" | "Rejected" | "Cancelled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(eid) = employee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("employeeId", eid);
    }
    if let Some(t) = leave_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("leaveType", t);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn request_from_create(
    input: CreateLeaveRequestInput,
    user_id: ObjectId,
) -> Result<CrmLeaveRequest> {
    let employee_id = ObjectId::parse_str(input.employee_id.trim())
        .map_err(|_| ApiError::Validation("employeeId must be a valid ObjectId".to_owned()))?;
    if !input.days.is_finite() || input.days <= 0.0 {
        return Err(ApiError::Validation(
            "days must be a positive number".to_owned(),
        ));
    }
    let start_date = parse_date(&input.start_date).ok_or_else(|| {
        ApiError::Validation("startDate is required (RFC3339 or YYYY-MM-DD)".to_owned())
    })?;
    let end_date = parse_date(&input.end_date).ok_or_else(|| {
        ApiError::Validation("endDate is required (RFC3339 or YYYY-MM-DD)".to_owned())
    })?;
    if end_date < start_date {
        return Err(ApiError::Validation(
            "endDate cannot be before startDate".to_owned(),
        ));
    }
    let leave_type_id = input
        .leave_type_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ObjectId::parse_str)
        .transpose()
        .map_err(|_| ApiError::Validation("leaveTypeId must be a valid ObjectId".to_owned()))?;
    let status = input.status.unwrap_or_else(|| "Pending".to_owned());

    Ok(CrmLeaveRequest {
        id: None,
        user_id,
        employee_id,
        employee_name: input
            .employee_name
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        leave_type: input
            .leave_type
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        leave_type_id,
        start_date,
        end_date,
        days: input.days,
        reason: input
            .reason
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        status,
        approver_id: None,
        approved_at: None,
        comments: input
            .comments
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateLeaveRequestInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };

    if let Some(v) = patch
        .employee_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let oid = ObjectId::parse_str(v)
            .map_err(|_| ApiError::Validation("employeeId must be a valid ObjectId".to_owned()))?;
        set.insert("employeeId", oid);
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v);
    }
    if let Some(v) = patch.leave_type {
        set.insert("leaveType", v);
    }
    if let Some(v) = patch
        .leave_type_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let oid = ObjectId::parse_str(v)
            .map_err(|_| ApiError::Validation("leaveTypeId must be a valid ObjectId".to_owned()))?;
        set.insert("leaveTypeId", oid);
    }
    if let Some(v) = patch.start_date.as_deref().and_then(parse_date) {
        set.insert("startDate", v);
    }
    if let Some(v) = patch.end_date.as_deref().and_then(parse_date) {
        set.insert("endDate", v);
    }
    if let Some(v) = patch.days {
        if !v.is_finite() || v <= 0.0 {
            return Err(ApiError::Validation(
                "days must be a positive number".to_owned(),
            ));
        }
        set.insert("days", v);
    }
    if let Some(v) = patch.reason {
        set.insert("reason", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch
        .approver_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let oid = ObjectId::parse_str(v)
            .map_err(|_| ApiError::Validation("approverId must be a valid ObjectId".to_owned()))?;
        set.insert("approverId", oid);
    }
    if let Some(v) = patch.approved_at.as_deref().and_then(parse_date) {
        set.insert("approvedAt", v);
    }
    if let Some(v) = patch.comments {
        set.insert("comments", v);
    }

    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmLeaveRequest) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmLeaveRequest>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_requests(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.employee_id.as_deref(),
        q.leave_type.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["employeeName", "reason", "leaveType", "comments"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "startDate": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmLeaveRequest>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_requests.find"))
    })?;
    let mut rows: Vec<CrmLeaveRequest> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_requests.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %request_id))]
pub async fn get_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
) -> Result<Json<CrmLeaveRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;
    let coll = mongo.collection::<CrmLeaveRequest>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_requests.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("leave_request".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateLeaveRequestInput>,
) -> Result<Json<CreateLeaveRequestResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = request_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmLeaveRequest>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_requests.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateLeaveRequestResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %request_id))]
pub async fn update_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
    Json(patch): Json<UpdateLeaveRequestInput>,
) -> Result<Json<CrmLeaveRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;
    let coll = mongo.collection::<CrmLeaveRequest>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_requests.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("leave_request".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_requests.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("leave_request".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_requests.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("leave_request".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %request_id))]
pub async fn delete_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
) -> Result<Json<DeleteLeaveRequestResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;
    let coll = mongo.collection::<CrmLeaveRequest>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_requests.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("leave_request".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteLeaveRequestResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        let status = f.get("status").expect("status present");
        let inner = status.as_document().expect("status is a doc");
        assert_eq!(inner.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn request_from_create_defaults_status_pending() {
        let user_id = ObjectId::new();
        let input = CreateLeaveRequestInput {
            employee_id: ObjectId::new().to_hex(),
            employee_name: Some("Jane".into()),
            leave_type: Some("Casual".into()),
            leave_type_id: None,
            start_date: "2026-05-10".into(),
            end_date: "2026-05-12".into(),
            days: 3.0,
            reason: Some("vacation".into()),
            status: None,
            comments: None,
        };
        let r = request_from_create(input, user_id).expect("ok");
        assert_eq!(r.status, "Pending");
        assert_eq!(r.days, 3.0);
        assert!(r.approver_id.is_none());
    }

    #[test]
    fn request_from_create_rejects_invalid_employee_id_and_zero_days() {
        let user_id = ObjectId::new();
        // Invalid employee id
        let bad_eid = CreateLeaveRequestInput {
            employee_id: "not-an-oid".into(),
            start_date: "2026-05-10".into(),
            end_date: "2026-05-12".into(),
            days: 1.0,
            ..Default::default()
        };
        assert!(request_from_create(bad_eid, user_id).is_err());
        // Zero days
        let zero_days = CreateLeaveRequestInput {
            employee_id: ObjectId::new().to_hex(),
            start_date: "2026-05-10".into(),
            end_date: "2026-05-12".into(),
            days: 0.0,
            ..Default::default()
        };
        assert!(request_from_create(zero_days, user_id).is_err());
        // End before start
        let bad_range = CreateLeaveRequestInput {
            employee_id: ObjectId::new().to_hex(),
            start_date: "2026-05-12".into(),
            end_date: "2026-05-10".into(),
            days: 1.0,
            ..Default::default()
        };
        assert!(request_from_create(bad_range, user_id).is_err());
    }
}
