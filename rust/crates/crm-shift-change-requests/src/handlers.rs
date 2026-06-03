//! HTTP handlers for the Shift Change Request entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
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
    CreateShiftChangeRequestInput, CreateShiftChangeRequestResponse,
    DeleteShiftChangeRequestResponse, ListQuery, UpdateShiftChangeRequestInput,
};
use crate::types::CrmShiftChangeRequest;

const COLL: &str = "crm_shift_change_requests";
const ENTITY_KIND: &str = "shift_change_request";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "pending" => {
            filter.insert("status", "pending");
        }
        "approved" => {
            filter.insert("status", "approved");
        }
        "rejected" => {
            filter.insert("status", "rejected");
        }
        "cancelled" => {
            filter.insert("status", "cancelled");
        }
        _ => {
            // The TS action treats `archived` only on soft-delete via update;
            // there's no `archived` status in the canonical enum, but we still
            // hide it from default listings for symmetry with sibling crates.
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(
    input: CreateShiftChangeRequestInput,
    user_id: ObjectId,
) -> Result<CrmShiftChangeRequest> {
    if input.employee_id.trim().is_empty() {
        return Err(ApiError::Validation("employee_id is required".to_owned()));
    }
    if input.current_shift_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "current_shift_id is required".to_owned(),
        ));
    }
    if input.requested_shift_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "requested_shift_id is required".to_owned(),
        ));
    }
    if input.current_shift_id == input.requested_shift_id {
        return Err(ApiError::Validation(
            "requested_shift_id must differ from current_shift_id".to_owned(),
        ));
    }

    Ok(CrmShiftChangeRequest {
        id: None,
        user_id,
        employee_id: input.employee_id.trim().to_string(),
        employee_name: input.employee_name,
        current_shift_id: input.current_shift_id.trim().to_string(),
        current_shift_name: input.current_shift_name,
        requested_shift_id: input.requested_shift_id.trim().to_string(),
        requested_shift_name: input.requested_shift_name,
        effective_date: BsonDateTime::from_chrono(input.effective_date),
        reason: input.reason,
        status: input.status.unwrap_or_else(|| "pending".to_owned()),
        approver_id: None,
        approved_at: None,
        response_notes: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateShiftChangeRequestInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_id {
        set.insert("employee_id", v.trim());
    }
    if let Some(v) = patch.employee_name {
        set.insert("employee_name", v);
    }
    if let Some(v) = patch.current_shift_id {
        set.insert("current_shift_id", v.trim());
    }
    if let Some(v) = patch.current_shift_name {
        set.insert("current_shift_name", v);
    }
    if let Some(v) = patch.requested_shift_id {
        set.insert("requested_shift_id", v.trim());
    }
    if let Some(v) = patch.requested_shift_name {
        set.insert("requested_shift_name", v);
    }
    if let Some(v) = patch.effective_date {
        set.insert("effective_date", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.reason {
        set.insert("reason", v);
    }
    if let Some(v) = patch.status {
        // When transitioning to a terminal state, stamp approved_at.
        if matches!(v.as_str(), "approved" | "rejected") {
            set.insert("approved_at", BsonDateTime::from_chrono(Utc::now()));
        }
        set.insert("status", v);
    }
    if let Some(v) = patch.approver_id {
        set.insert("approver_id", v);
    }
    if let Some(v) = patch.response_notes {
        set.insert("response_notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmShiftChangeRequest) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ListResponse {
    pub items: Vec<CrmShiftChangeRequest>,
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
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(emp) = q
        .employee_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("employee_id", emp);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "employee_name",
                "reason",
                "current_shift_name",
                "requested_shift_name",
            ],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmShiftChangeRequest>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.find"))
    })?;
    let mut rows: Vec<CrmShiftChangeRequest> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.collect"))
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
) -> Result<Json<CrmShiftChangeRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;
    let coll = mongo.collection::<CrmShiftChangeRequest>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("shift_change_request".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateShiftChangeRequestInput>,
) -> Result<Json<CreateShiftChangeRequestResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmShiftChangeRequest>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.insert"))
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

    Ok(Json(CreateShiftChangeRequestResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %request_id))]
pub async fn update_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
    Json(patch): Json<UpdateShiftChangeRequestInput>,
) -> Result<Json<CrmShiftChangeRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;

    let coll = mongo.collection::<CrmShiftChangeRequest>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("shift_change_request".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("shift_change_request".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("shift_change_request".to_owned()))?;

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
) -> Result<Json<DeleteShiftChangeRequestResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;

    let coll = mongo.collection::<CrmShiftChangeRequest>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("shift_change_request".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteShiftChangeRequestResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn sample_input() -> CreateShiftChangeRequestInput {
        CreateShiftChangeRequestInput {
            employee_id: "emp_1".into(),
            employee_name: Some("Aakash".into()),
            current_shift_id: "shift_a".into(),
            current_shift_name: Some("Morning".into()),
            requested_shift_id: "shift_b".into(),
            requested_shift_name: Some("Evening".into()),
            effective_date: Utc.with_ymd_and_hms(2026, 6, 1, 0, 0, 0).unwrap(),
            reason: Some("Family event".into()),
            status: None,
        }
    }

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn entity_from_create_defaults_to_pending() {
        let user_id = ObjectId::new();
        let e = entity_from_create(sample_input(), user_id).unwrap();
        assert_eq!(e.status, "pending");
        assert!(e.approver_id.is_none());
        assert!(e.approved_at.is_none());
    }

    #[test]
    fn entity_from_create_rejects_identical_shifts() {
        let user_id = ObjectId::new();
        let mut input = sample_input();
        input.requested_shift_id = input.current_shift_id.clone();
        assert!(entity_from_create(input, user_id).is_err());
    }

    #[test]
    fn entity_from_create_rejects_missing_required_fields() {
        let user_id = ObjectId::new();
        let mut bad_emp = sample_input();
        bad_emp.employee_id = "  ".into();
        assert!(entity_from_create(bad_emp, user_id).is_err());

        let mut bad_cur = sample_input();
        bad_cur.current_shift_id = " ".into();
        assert!(entity_from_create(bad_cur, user_id).is_err());

        let mut bad_req = sample_input();
        bad_req.requested_shift_id = " ".into();
        assert!(entity_from_create(bad_req, user_id).is_err());
    }
}
