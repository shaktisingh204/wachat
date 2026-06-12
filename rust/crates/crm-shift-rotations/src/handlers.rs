//! HTTP handlers for the ShiftRotation entity.
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/crm/shift-rotations` (legacy) — `userId == AuthUser.user_id`.
//! - `/v1/sabcrm/people/shift-rotations` (SabCRM People suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent).

use axum::{
    Extension, Json,
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
use crm_core::{ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateRotationInput, CreateRotationResponse, DeleteRotationResponse, ListQuery, ScopeQuery,
    UpdateRotationInput,
};
use crate::types::CrmShiftRotation;

const COLL: &str = "crm_shift_rotations";
const ENTITY_KIND: &str = "shift_rotation";

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

fn list_filter(
    scope: &TenantScope,
    status: Option<&str>,
    employee_id: Option<&str>,
    department_id: Option<&str>,
    team_id: Option<&str>,
    is_active: Option<bool>,
) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" | "paused" | "completed" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(e) = employee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("employeeId", e);
    }
    if let Some(d) = department_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("departmentId", d);
    }
    if let Some(t) = team_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("teamId", t);
    }
    if let Some(v) = is_active {
        filter.insert("isActive", v);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut f = scope.filter();
    f.insert("_id", oid);
    f
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn parse_oid(s: &Option<String>) -> Option<ObjectId> {
    s.as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
}

fn rotation_from_create(
    input: CreateRotationInput,
    user_id: ObjectId,
    project_id: Option<ObjectId>,
) -> Result<CrmShiftRotation> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.cycle_days <= 0 {
        return Err(ApiError::Validation(
            "cycleDays must be greater than 0".to_owned(),
        ));
    }
    let start_date = parse_date(input.start_date.trim()).ok_or_else(|| {
        ApiError::Validation("startDate must be a valid RFC3339 datetime".to_owned())
    })?;
    let end_date = input
        .end_date
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(parse_date);

    let employee_id = parse_oid(&input.employee_id);
    let department_id = parse_oid(&input.department_id);
    let team_id = parse_oid(&input.team_id);
    if employee_id.is_none() && department_id.is_none() && team_id.is_none() {
        return Err(ApiError::Validation(
            "at least one of employeeId, departmentId, or teamId is required".to_owned(),
        ));
    }

    Ok(CrmShiftRotation {
        id: None,
        user_id,
        project_id,
        name: input.name.trim().to_owned(),
        description: input
            .description
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        employee_id,
        department_id,
        team_id,
        pattern: input.pattern.unwrap_or_default(),
        cycle_days: input.cycle_days,
        start_date,
        end_date,
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateRotationInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = parse_oid(&patch.employee_id) {
        set.insert("employeeId", v);
    }
    if let Some(v) = parse_oid(&patch.department_id) {
        set.insert("departmentId", v);
    }
    if let Some(v) = parse_oid(&patch.team_id) {
        set.insert("teamId", v);
    }
    if let Some(v) = patch.pattern {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|p| bson::to_document(&p).ok())
            .collect();
        set.insert("pattern", arr);
    }
    if let Some(v) = patch.cycle_days {
        if v <= 0 {
            return Err(ApiError::Validation(
                "cycleDays must be greater than 0".to_owned(),
            ));
        }
        set.insert("cycleDays", v);
    }
    if let Some(v) = patch.start_date.as_deref() {
        let d = parse_date(v.trim()).ok_or_else(|| {
            ApiError::Validation("startDate must be a valid RFC3339 datetime".to_owned())
        })?;
        set.insert("startDate", d);
    }
    if let Some(v) = patch.end_date.as_deref() {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            set.insert("endDate", bson::Bson::Null);
        } else {
            let d = parse_date(trimmed).ok_or_else(|| {
                ApiError::Validation("endDate must be a valid RFC3339 datetime".to_owned())
            })?;
            set.insert("endDate", d);
        }
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmShiftRotation) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmShiftRotation>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_rotations(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(
        &scope,
        q.status.as_deref(),
        q.employee_id.as_deref(),
        q.department_id.as_deref(),
        q.team_id.as_deref(),
        q.is_active,
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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
    let coll = mongo.collection::<CrmShiftRotation>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_shift_rotations.find"))
    })?;
    let mut rows: Vec<CrmShiftRotation> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_shift_rotations.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rotation_id))]
pub async fn get_rotation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(rotation_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<CrmShiftRotation>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&rotation_id)?;
    let coll = mongo.collection::<CrmShiftRotation>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_rotations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("shift_rotation".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_rotation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRotationInput>,
) -> Result<Json<CreateRotationResponse>> {
    let user_id = user_oid(&user)?;
    // Project mode: body `projectId` IS the tenant scope (mandatory).
    // User mode: scope is the JWT subject, body `projectId` optional
    // (behaviour freeze). `userId` is always stamped for auditing.
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => Some(p),
        TenantScope::User(_) => parse_oid(&input.project_id),
    };
    let mut entity = rotation_from_create(input, user_id, project_id)?;
    let coll = mongo.collection::<CrmShiftRotation>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_shift_rotations.insert"))
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
    Ok(Json(CreateRotationResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rotation_id))]
pub async fn update_rotation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(rotation_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(patch): Json<UpdateRotationInput>,
) -> Result<Json<CrmShiftRotation>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&rotation_id)?;
    let coll = mongo.collection::<CrmShiftRotation>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_rotations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("shift_rotation".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_rotations.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("shift_rotation".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_rotations.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("shift_rotation".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rotation_id))]
pub async fn delete_rotation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(rotation_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<DeleteRotationResponse>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&rotation_id)?;
    let coll = mongo.collection::<CrmShiftRotation>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_shift_rotations.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("shift_rotation".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteRotationResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_valid_input() -> CreateRotationInput {
        CreateRotationInput {
            name: "Weekly Rotation".into(),
            cycle_days: 7,
            start_date: "2026-01-01T00:00:00Z".into(),
            employee_id: Some(ObjectId::new().to_hex()),
            ..Default::default()
        }
    }

    #[test]
    fn rotation_from_create_accepts_valid_input_and_defaults() {
        let user_id = ObjectId::new();
        let entity = rotation_from_create(base_valid_input(), user_id, None).unwrap();
        assert_eq!(entity.name, "Weekly Rotation");
        assert_eq!(entity.cycle_days, 7);
        assert_eq!(entity.status, "active");
        assert!(entity.is_active);
        assert!(entity.employee_id.is_some());
        assert!(entity.pattern.is_empty());
        assert!(entity.end_date.is_none());
        assert!(entity.project_id.is_none());
    }

    #[test]
    fn rotation_from_create_rejects_empty_name_and_bad_cycle() {
        let user_id = ObjectId::new();

        let bad_name = CreateRotationInput {
            name: "   ".into(),
            ..base_valid_input()
        };
        assert!(rotation_from_create(bad_name, user_id, None).is_err());

        let bad_cycle = CreateRotationInput {
            cycle_days: 0,
            ..base_valid_input()
        };
        assert!(rotation_from_create(bad_cycle, user_id, None).is_err());

        let neg_cycle = CreateRotationInput {
            cycle_days: -1,
            ..base_valid_input()
        };
        assert!(rotation_from_create(neg_cycle, user_id, None).is_err());

        let bad_date = CreateRotationInput {
            start_date: "not-a-date".into(),
            ..base_valid_input()
        };
        assert!(rotation_from_create(bad_date, user_id, None).is_err());
    }

    #[test]
    fn rotation_from_create_requires_at_least_one_target() {
        let user_id = ObjectId::new();
        let no_target = CreateRotationInput {
            name: "Weekly".into(),
            cycle_days: 7,
            start_date: "2026-01-01T00:00:00Z".into(),
            employee_id: None,
            department_id: None,
            team_id: None,
            ..Default::default()
        };
        assert!(rotation_from_create(no_target, user_id, None).is_err());

        let with_dept = CreateRotationInput {
            name: "Weekly".into(),
            cycle_days: 7,
            start_date: "2026-01-01T00:00:00Z".into(),
            department_id: Some(ObjectId::new().to_hex()),
            ..Default::default()
        };
        let entity = rotation_from_create(with_dept, user_id, None).unwrap();
        assert!(entity.department_id.is_some());
        assert!(entity.employee_id.is_none());
    }

    #[test]
    fn rotation_from_create_stamps_project_scope() {
        let user_id = ObjectId::new();
        let project_id = ObjectId::new();
        let entity =
            rotation_from_create(base_valid_input(), user_id, Some(project_id)).unwrap();
        assert_eq!(entity.project_id, Some(project_id));
        let json = serde_json::to_value(&entity).unwrap();
        assert_eq!(json["projectId"]["$oid"], project_id.to_hex());
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
        let f = list_filter(&TenantScope::Project(project), None, None, None, None, None);
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
        let f = ownership_filter(&TenantScope::Project(project), ObjectId::new());
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn scope_query_parses_camel_case_project_id() {
        let q: ScopeQuery = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439099"
        }))
        .unwrap();
        assert_eq!(q.project_id.as_deref(), Some("507f1f77bcf86cd799439099"));
        let empty: ScopeQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(empty.project_id.is_none());
    }
}
