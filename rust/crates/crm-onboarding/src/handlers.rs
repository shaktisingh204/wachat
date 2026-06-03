//! HTTP handlers for the Onboarding entity.

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
    CreateOnboardingInput, CreateOnboardingResponse, DeleteOnboardingResponse, ListQuery,
    UpdateOnboardingInput,
};
use crate::types::CrmOnboarding;

const COLL: &str = "crm_onboardings";
const ENTITY_KIND: &str = "onboarding";

fn list_filter(user_id: ObjectId, status: Option<&str>, employee_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "pending" | "in_progress" | "completed" | "cancelled" => {
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

fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}

/// Clamp `progress` into `[0.0, 100.0]` and round NaN to 0.
fn clamp_progress(p: f64) -> f64 {
    if p.is_nan() {
        0.0
    } else if p < 0.0 {
        0.0
    } else if p > 100.0 {
        100.0
    } else {
        p
    }
}

fn onboarding_from_create(
    input: CreateOnboardingInput,
    user_id: ObjectId,
) -> Result<CrmOnboarding> {
    let employee_id = input.employee_id.as_deref().and_then(parse_oid);
    let candidate_id = input.candidate_id.as_deref().and_then(parse_oid);
    if employee_id.is_none() && candidate_id.is_none() {
        return Err(ApiError::Validation(
            "either employeeId or candidateId is required".to_owned(),
        ));
    }
    let status = input.status.unwrap_or_else(|| "pending".to_owned());
    let now = BsonDateTime::from_chrono(Utc::now());
    let completed_at = if status == "completed" {
        Some(now)
    } else {
        None
    };
    Ok(CrmOnboarding {
        id: None,
        user_id,
        employee_id,
        employee_name: input
            .employee_name
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        candidate_id,
        job_id: input.job_id.as_deref().and_then(parse_oid),
        joining_date: input.joining_date.as_deref().and_then(parse_date),
        buddy_id: input.buddy_id.as_deref().and_then(parse_oid),
        manager_id: input.manager_id.as_deref().and_then(parse_oid),
        department_id: input.department_id.as_deref().and_then(parse_oid),
        checklist: input.checklist.unwrap_or_default(),
        progress: clamp_progress(input.progress.unwrap_or(0.0)),
        notes: input.notes,
        status,
        completed_at,
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateOnboardingInput) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch
        .employee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("employeeId", v);
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v);
    }
    if let Some(v) = patch.candidate_id.as_deref().and_then(parse_oid) {
        set.insert("candidateId", v);
    }
    if let Some(v) = patch.job_id.as_deref().and_then(parse_oid) {
        set.insert("jobId", v);
    }
    if let Some(v) = patch.joining_date.as_deref().and_then(parse_date) {
        set.insert("joiningDate", v);
    }
    if let Some(v) = patch.buddy_id.as_deref().and_then(parse_oid) {
        set.insert("buddyId", v);
    }
    if let Some(v) = patch.manager_id.as_deref().and_then(parse_oid) {
        set.insert("managerId", v);
    }
    if let Some(v) = patch.department_id.as_deref().and_then(parse_oid) {
        set.insert("departmentId", v);
    }
    if let Some(v) = patch.checklist {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|t| bson::to_document(&t).ok())
            .collect();
        set.insert("checklist", arr);
    }
    if let Some(v) = patch.progress {
        set.insert("progress", clamp_progress(v));
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        if v == "completed" {
            set.insert("completedAt", now);
        }
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmOnboarding) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmOnboarding>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_onboardings(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.employee_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["employeeName", "notes"]);
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
    let coll = mongo.collection::<CrmOnboarding>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_onboardings.find"))
        })?;
    let mut rows: Vec<CrmOnboarding> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_onboardings.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %onboarding_id))]
pub async fn get_onboarding(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(onboarding_id): Path<String>,
) -> Result<Json<CrmOnboarding>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&onboarding_id)?;
    let coll = mongo.collection::<CrmOnboarding>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_onboardings.find_one")))?
        .ok_or_else(|| ApiError::NotFound("onboarding".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_onboarding(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateOnboardingInput>,
) -> Result<Json<CreateOnboardingResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = onboarding_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmOnboarding>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_onboardings.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateOnboardingResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %onboarding_id))]
pub async fn update_onboarding(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(onboarding_id): Path<String>,
    Json(patch): Json<UpdateOnboardingInput>,
) -> Result<Json<CrmOnboarding>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&onboarding_id)?;
    let coll = mongo.collection::<CrmOnboarding>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_onboardings.find_one")))?
        .ok_or_else(|| ApiError::NotFound("onboarding".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_onboardings.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("onboarding".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_onboardings.refetch")))?
        .ok_or_else(|| ApiError::NotFound("onboarding".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %onboarding_id))]
pub async fn delete_onboarding(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(onboarding_id): Path<String>,
) -> Result<Json<DeleteOnboardingResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&onboarding_id)?;
    let coll = mongo.collection::<CrmOnboarding>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_onboardings.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("onboarding".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteOnboardingResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_requires_employee_or_candidate() {
        let user_id = ObjectId::new();
        let input = CreateOnboardingInput::default();
        assert!(onboarding_from_create(input, user_id).is_err());
    }

    #[test]
    fn create_stamps_completed_at_when_status_completed() {
        let user_id = ObjectId::new();
        let input = CreateOnboardingInput {
            employee_id: Some(ObjectId::new().to_hex()),
            status: Some("completed".into()),
            ..Default::default()
        };
        let o = onboarding_from_create(input, user_id).unwrap();
        assert_eq!(o.status, "completed");
        assert!(o.completed_at.is_some());
    }

    #[test]
    fn progress_is_clamped_into_0_100() {
        assert_eq!(clamp_progress(-5.0), 0.0);
        assert_eq!(clamp_progress(0.0), 0.0);
        assert_eq!(clamp_progress(50.0), 50.0);
        assert_eq!(clamp_progress(100.0), 100.0);
        assert_eq!(clamp_progress(250.0), 100.0);
        assert_eq!(clamp_progress(f64::NAN), 0.0);
    }
}
