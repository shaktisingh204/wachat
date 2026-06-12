//! HTTP handlers for the Shift entity.
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/crm/shifts` (legacy) — `userId == AuthUser.user_id`. Unchanged
//!   behaviour.
//! - `/v1/sabcrm/people/shifts` (SabCRM People suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.

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
    CreateShiftInput, CreateShiftResponse, DeleteShiftResponse, ListQuery, ScopeQuery,
    UpdateShiftInput,
};
use crate::types::CrmShift;

const COLL: &str = "crm_shifts";
const ENTITY_KIND: &str = "shift";

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`]:
///
/// - `ScopeMode::User` (legacy `/v1/crm/shifts`) — scope by the verified
///   JWT subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/people/shifts`) — scope by the
///   caller-supplied `projectId`, 4xx when absent/invalid.
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

/// Validate `HH:MM` 24-hour time strings, e.g. `"09:00"`, `"23:59"`.
///
/// Returns the trimmed/canonical value on success.
fn validate_hhmm(field: &str, value: &str) -> Result<String> {
    let s = value.trim();
    if s.is_empty() {
        return Err(ApiError::Validation(format!("{field} is required")));
    }
    let mut parts = s.split(':');
    let h_str = parts.next();
    let m_str = parts.next();
    if parts.next().is_some() || h_str.is_none() || m_str.is_none() {
        return Err(ApiError::Validation(format!(
            "{field} must be in HH:MM 24-hour format"
        )));
    }
    let h_str = h_str.unwrap();
    let m_str = m_str.unwrap();
    if h_str.is_empty() || h_str.len() > 2 || m_str.len() != 2 {
        return Err(ApiError::Validation(format!(
            "{field} must be in HH:MM 24-hour format"
        )));
    }
    let hour: u8 = h_str
        .parse()
        .map_err(|_| ApiError::Validation(format!("{field} must be in HH:MM 24-hour format")))?;
    let minute: u8 = m_str
        .parse()
        .map_err(|_| ApiError::Validation(format!("{field} must be in HH:MM 24-hour format")))?;
    if hour > 23 || minute > 59 {
        return Err(ApiError::Validation(format!(
            "{field} must be in HH:MM 24-hour format"
        )));
    }
    Ok(format!("{hour:02}:{minute:02}"))
}

fn list_filter(
    scope: &TenantScope,
    status: Option<&str>,
    is_active: Option<bool>,
    is_default: Option<bool>,
    department_id: Option<&str>,
) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(v) = is_active {
        filter.insert("isActive", v);
    }
    if let Some(v) = is_default {
        filter.insert("isDefault", v);
    }
    if let Some(d) = department_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("departmentIds", d);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut f = scope.filter();
    f.insert("_id", oid);
    f
}

fn parse_oid_vec(input: Option<Vec<String>>) -> Vec<ObjectId> {
    input
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect()
}

fn shift_from_create(
    input: CreateShiftInput,
    user_id: ObjectId,
    project_id: Option<ObjectId>,
) -> Result<CrmShift> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let start_time = validate_hhmm("startTime", &input.start_time)?;
    let end_time = validate_hhmm("endTime", &input.end_time)?;
    Ok(CrmShift {
        id: None,
        user_id,
        project_id,
        name: input.name.trim().to_owned(),
        code: input
            .code
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        start_time,
        end_time,
        break_minutes: input.break_minutes,
        grace_minutes: input.grace_minutes,
        is_night_shift: input.is_night_shift.unwrap_or(false),
        working_days: input.working_days.unwrap_or_default(),
        color: input
            .color
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        description: input
            .description
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        is_default: input.is_default.unwrap_or(false),
        department_ids: parse_oid_vec(input.department_ids),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateShiftInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.code {
        set.insert("code", v);
    }
    if let Some(v) = patch.start_time.as_deref() {
        let t = validate_hhmm("startTime", v)?;
        set.insert("startTime", t);
    }
    if let Some(v) = patch.end_time.as_deref() {
        let t = validate_hhmm("endTime", v)?;
        set.insert("endTime", t);
    }
    if let Some(v) = patch.break_minutes {
        set.insert("breakMinutes", v);
    }
    if let Some(v) = patch.grace_minutes {
        set.insert("graceMinutes", v);
    }
    if let Some(v) = patch.is_night_shift {
        set.insert("isNightShift", v);
    }
    if let Some(v) = patch.working_days {
        set.insert("workingDays", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.department_ids {
        let arr: Vec<ObjectId> = v
            .into_iter()
            .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
            .collect();
        set.insert("departmentIds", arr);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmShift) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmShift>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_shifts(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(
        &scope,
        q.status.as_deref(),
        q.is_active,
        q.is_default,
        q.department_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code", "description"]);
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
    let coll = mongo.collection::<CrmShift>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.find")))?;
    let mut rows: Vec<CrmShift> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %shift_id))]
pub async fn get_shift(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(shift_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<CrmShift>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&shift_id)?;
    let coll = mongo.collection::<CrmShift>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("shift".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_shift(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateShiftInput>,
) -> Result<Json<CreateShiftResponse>> {
    let user_id = user_oid(&user)?;
    // In project mode the body's `projectId` IS the tenant scope and is
    // therefore mandatory (4xx when absent). In legacy user mode the
    // scope is the JWT subject and the body `projectId` stays optional
    // (behaviour freeze). The stamped `userId` is always
    // `AuthUser.user_id` (auditing).
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
    let mut entity = shift_from_create(input, user_id, project_id)?;
    let coll = mongo.collection::<CrmShift>(COLL);
    if entity.is_default {
        let mut unset_filter = scope.filter();
        unset_filter.insert("isDefault", true);
        let _ = coll
            .update_many(unset_filter, doc! { "$set": { "isDefault": false } })
            .await;
    }
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateShiftResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %shift_id))]
pub async fn update_shift(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(shift_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(patch): Json<UpdateShiftInput>,
) -> Result<Json<CrmShift>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&shift_id)?;
    let coll = mongo.collection::<CrmShift>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("shift".to_owned()))?;
    if matches!(patch.is_default, Some(true)) {
        let mut unset_filter = scope.filter();
        unset_filter.insert("isDefault", true);
        unset_filter.insert("_id", doc! { "$ne": oid });
        let _ = coll
            .update_many(unset_filter, doc! { "$set": { "isDefault": false } })
            .await;
    }
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("shift".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.refetch")))?
        .ok_or_else(|| ApiError::NotFound("shift".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %shift_id))]
pub async fn delete_shift(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(shift_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<DeleteShiftResponse>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&shift_id)?;
    let coll = mongo.collection::<CrmShift>(COLL);
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
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("shift".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteShiftResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_hhmm_accepts_valid_times() {
        assert_eq!(validate_hhmm("startTime", "09:00").unwrap(), "09:00");
        assert_eq!(validate_hhmm("startTime", "23:59").unwrap(), "23:59");
        assert_eq!(validate_hhmm("startTime", "00:00").unwrap(), "00:00");
        // single-digit hour is normalised to two digits
        assert_eq!(validate_hhmm("startTime", "9:05").unwrap(), "09:05");
    }

    #[test]
    fn validate_hhmm_rejects_invalid_times() {
        assert!(validate_hhmm("startTime", "").is_err());
        assert!(validate_hhmm("startTime", "24:00").is_err());
        assert!(validate_hhmm("startTime", "12:60").is_err());
        assert!(validate_hhmm("startTime", "12").is_err());
        assert!(validate_hhmm("startTime", "12:00:00").is_err());
        assert!(validate_hhmm("startTime", "ab:cd").is_err());
        assert!(validate_hhmm("startTime", "12:5").is_err());
    }

    #[test]
    fn shift_from_create_defaults_and_rejects_empty_name() {
        let user_id = ObjectId::new();
        let ok = CreateShiftInput {
            name: "Morning".into(),
            start_time: "09:00".into(),
            end_time: "18:00".into(),
            ..Default::default()
        };
        let s = shift_from_create(ok, user_id, None).unwrap();
        assert_eq!(s.name, "Morning");
        assert_eq!(s.start_time, "09:00");
        assert_eq!(s.end_time, "18:00");
        assert_eq!(s.status, "active");
        assert!(s.is_active);
        assert!(!s.is_default);
        assert!(!s.is_night_shift);
        assert!(s.project_id.is_none());

        let bad = CreateShiftInput {
            name: "   ".into(),
            start_time: "09:00".into(),
            end_time: "18:00".into(),
            ..Default::default()
        };
        assert!(shift_from_create(bad, user_id, None).is_err());

        let bad_time = CreateShiftInput {
            name: "Morning".into(),
            start_time: "9".into(),
            end_time: "18:00".into(),
            ..Default::default()
        };
        assert!(shift_from_create(bad_time, user_id, None).is_err());
    }

    #[test]
    fn shift_from_create_stamps_project_scope() {
        let user_id = ObjectId::new();
        let project_id = ObjectId::new();
        let input = CreateShiftInput {
            name: "Morning".into(),
            start_time: "09:00".into(),
            end_time: "18:00".into(),
            ..Default::default()
        };
        let s = shift_from_create(input, user_id, Some(project_id)).unwrap();
        assert_eq!(s.project_id, Some(project_id));
        // `projectId` lands camelCase on the wire/document.
        let json = serde_json::to_value(&s).unwrap();
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
        // The `project_router` mount attaches `ScopeMode::Project`; a
        // request without `projectId` must 4xx (mirrors the
        // `crm-core::scope` tests).
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
        let f = list_filter(&TenantScope::Project(project), None, None, None, None);
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
