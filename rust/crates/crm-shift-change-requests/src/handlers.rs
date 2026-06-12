//! HTTP handlers for the Shift Change Request entity.
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`]:
//!
//! - `/v1/crm/shift-change-requests` (legacy) — `userId == JWT subject`.
//! - `/v1/sabcrm/people/shift-change-requests` — required `projectId`
//!   (4xx when absent). Entity fields stay snake_case on the wire; only
//!   the tenant key (`projectId`) is camelCase.

use axum::{
    Extension, Json,
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
use crm_core::{ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateShiftChangeRequestInput, CreateShiftChangeRequestResponse,
    DeleteShiftChangeRequestResponse, ListQuery, ScopeQuery, UpdateShiftChangeRequestInput,
};
use crate::types::CrmShiftChangeRequest;

const COLL: &str = "crm_shift_change_requests";
const ENTITY_KIND: &str = "shift_change_request";

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`] — `userId` (JWT subject) on the legacy mount, required
/// `projectId` on the SabCRM People mount (4xx when absent/invalid).
fn resolve_scope(
    mode: ScopeMode,
    user: &AuthUser,
    project_id: Option<&str>,
) -> Result<TenantScope> {
    match mode {
        ScopeMode::User => Ok(TenantScope::User(user_oid(user)?)),
        ScopeMode::Project => Ok(TenantScope::Project(sabcrm_project_oid(project_id)?)),
    }
}

fn list_filter(scope: &TenantScope, status: Option<&str>) -> Document {
    let mut filter = scope.filter();
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

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut f = scope.filter();
    f.insert("_id", oid);
    f
}

fn entity_from_create(
    input: CreateShiftChangeRequestInput,
    user_id: ObjectId,
    project_id: Option<ObjectId>,
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
        project_id,
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(&scope, q.status.as_deref());
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<CrmShiftChangeRequest>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&request_id)?;
    let coll = mongo.collection::<CrmShiftChangeRequest>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateShiftChangeRequestInput>,
) -> Result<Json<CreateShiftChangeRequestResponse>> {
    let user_id = user_oid(&user)?;
    // Project mode: body `projectId` IS the tenant scope (mandatory).
    // User mode: scope is the JWT subject, body `projectId` optional.
    // `userId` is always stamped for auditing.
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => Some(p),
        TenantScope::User(_) => input
            .project_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .and_then(|s| ObjectId::parse_str(s).ok()),
    };
    let mut entity = entity_from_create(input, user_id, project_id)?;
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(patch): Json<UpdateShiftChangeRequestInput>,
) -> Result<Json<CrmShiftChangeRequest>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&request_id)?;

    let coll = mongo.collection::<CrmShiftChangeRequest>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("shift_change_request".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_change_requests.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("shift_change_request".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<DeleteShiftChangeRequestResponse>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&request_id)?;

    let coll = mongo.collection::<CrmShiftChangeRequest>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
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
            project_id: None,
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
        let f = list_filter(&TenantScope::User(oid), None);
        assert!(f.contains_key("status"));
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
    }

    #[test]
    fn entity_from_create_defaults_to_pending() {
        let user_id = ObjectId::new();
        let e = entity_from_create(sample_input(), user_id, None).unwrap();
        assert_eq!(e.status, "pending");
        assert!(e.approver_id.is_none());
        assert!(e.approved_at.is_none());
        assert!(e.project_id.is_none());
    }

    #[test]
    fn entity_from_create_rejects_identical_shifts() {
        let user_id = ObjectId::new();
        let mut input = sample_input();
        input.requested_shift_id = input.current_shift_id.clone();
        assert!(entity_from_create(input, user_id, None).is_err());
    }

    #[test]
    fn entity_from_create_rejects_missing_required_fields() {
        let user_id = ObjectId::new();
        let mut bad_emp = sample_input();
        bad_emp.employee_id = "  ".into();
        assert!(entity_from_create(bad_emp, user_id, None).is_err());

        let mut bad_cur = sample_input();
        bad_cur.current_shift_id = " ".into();
        assert!(entity_from_create(bad_cur, user_id, None).is_err());

        let mut bad_req = sample_input();
        bad_req.requested_shift_id = " ".into();
        assert!(entity_from_create(bad_req, user_id, None).is_err());
    }

    #[test]
    fn entity_from_create_stamps_project_scope_camel_case() {
        let user_id = ObjectId::new();
        let project_id = ObjectId::new();
        let e = entity_from_create(sample_input(), user_id, Some(project_id)).unwrap();
        assert_eq!(e.project_id, Some(project_id));
        // The entity wire stays snake_case but the tenant key must land
        // camelCase (`projectId`) — uniform across the suite.
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["projectId"]["$oid"], project_id.to_hex());
        assert!(json.get("project_id").is_none());
        assert!(json.get("employee_id").is_some(), "entity wire stays snake_case");
    }

    /// Test-only [`AuthUser`] with a valid 24-hex subject.
    fn fake_user(oid: &ObjectId) -> AuthUser {
        AuthUser {
            user_id: oid.to_hex(),
            tenant_id: String::new(),
            roles: Vec::new(),
        }
    }

    #[test]
    fn resolve_scope_project_rejects_missing_project_id() {
        let user = fake_user(&ObjectId::new());
        assert!(matches!(
            resolve_scope(ScopeMode::Project, &user, None).unwrap_err(),
            ApiError::Validation(_)
        ));
        assert!(matches!(
            resolve_scope(ScopeMode::Project, &user, Some("  ")).unwrap_err(),
            ApiError::Validation(_)
        ));
        assert!(matches!(
            resolve_scope(ScopeMode::Project, &user, Some("not-an-oid")).unwrap_err(),
            ApiError::Validation(_)
        ));
    }

    #[test]
    fn resolve_scope_resolves_both_modes() {
        let user_oid = ObjectId::new();
        let user = fake_user(&user_oid);
        assert_eq!(
            resolve_scope(ScopeMode::User, &user, None).unwrap(),
            TenantScope::User(user_oid)
        );
        let project = ObjectId::new();
        assert_eq!(
            resolve_scope(ScopeMode::Project, &user, Some(&project.to_hex())).unwrap(),
            TenantScope::Project(project)
        );
    }

    #[test]
    fn project_scope_filters_project_id_only() {
        let project = ObjectId::new();
        let f = list_filter(&TenantScope::Project(project), None);
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
        let f = ownership_filter(&TenantScope::Project(project), ObjectId::new());
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn scope_query_parses_camel_case_project_id_despite_snake_case_wire() {
        let q: ScopeQuery = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439099"
        }))
        .unwrap();
        assert_eq!(q.project_id.as_deref(), Some("507f1f77bcf86cd799439099"));

        // The create body keeps snake_case entity fields + camelCase tenant key.
        let input: CreateShiftChangeRequestInput = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439099",
            "employee_id": "emp_1",
            "current_shift_id": "shift_a",
            "requested_shift_id": "shift_b",
            "effective_date": "2026-06-01T00:00:00Z"
        }))
        .unwrap();
        assert_eq!(
            input.project_id.as_deref(),
            Some("507f1f77bcf86cd799439099")
        );
        assert_eq!(input.employee_id, "emp_1");
    }
}
