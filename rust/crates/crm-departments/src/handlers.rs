//! HTTP handlers for the §9.2 Department + Designation entities.
//!
//! Two parallel sets of five handlers — one per resource — sharing a
//! common helper toolkit. Mongo collections:
//!   - `crm_departments`
//!   - `crm_designations`
//!
//! | Method  | Path                          | Function                |
//! |---------|-------------------------------|-------------------------|
//! | `GET`   | `/departments`                | [`list_departments`]    |
//! | `GET`   | `/departments/:departmentId`  | [`get_department`]      |
//! | `POST`  | `/departments`                | [`create_department`]   |
//! | `PATCH` | `/departments/:departmentId`  | [`update_department`]   |
//! | `DELETE`| `/departments/:departmentId`  | [`delete_department`]   |
//! | `GET`   | `/designations`               | [`list_designations`]   |
//! | `GET`   | `/designations/:designationId`| [`get_designation`]     |
//! | `POST`  | `/designations`               | [`create_designation`]  |
//! | `PATCH` | `/designations/:designationId`| [`update_designation`]  |
//! | `DELETE`| `/designations/:designationId`| [`delete_designation`]  |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Audit, Identity};
use futures::TryStreamExt;
use hrm_payroll_types::{Department, Designation};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateDepartmentInput, CreateDesignationInput, DEFAULT_LIMIT, ListDepartmentsQuery,
    ListDesignationsQuery, MAX_LIMIT, UpdateDepartmentInput, UpdateDesignationInput,
};

/// Mongo collection names. Must match the TS server actions so the
/// Rust BFF and the legacy Next.js code share backing collections
/// during the migration window.
const DEPARTMENTS_COLL: &str = "crm_departments";
const DESIGNATIONS_COLL: &str = "crm_designations";

// =========================================================================
// Helpers
// =========================================================================

/// Resolve the calling tenant root from the verified [`AuthUser`].
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Clamp `requested` page-size into `[1, MAX_LIMIT]`, defaulting to
/// [`DEFAULT_LIMIT`] when absent.
fn clamp_limit(requested: Option<u32>) -> i64 {
    match requested {
        None => DEFAULT_LIMIT,
        Some(n) => (n as i64).clamp(1, MAX_LIMIT),
    }
}

/// Materialize the base ownership filter:
/// `{ userId, archived: { $ne: true } }`. Soft-deleted rows
/// (`archived = true`) are excluded by default.
fn base_ownership_filter(user: ObjectId) -> Document {
    doc! {
        "userId": user,
        "archived": { "$ne": true },
    }
}

/// Optional-string update helper. PATCH semantics — absent ≠ `null`.
fn set_opt_str(set: &mut Document, key: &str, val: Option<&String>) {
    if let Some(v) = val {
        set.insert(key, v.as_str());
    }
}

/// Optional-ObjectId-like update helper. Parses 24-char hex when
/// present; rejects malformed input with `BadRequest`.
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Parse an optional 24-char hex string into an `ObjectId`. Empty
/// strings are treated as absent. Used at create time.
fn parse_opt_oid(val: Option<&String>) -> Result<Option<ObjectId>> {
    match val.map(|s| s.as_str()).filter(|s| !s.is_empty()) {
        Some(s) => Ok(Some(oid_from_str(s)?)),
        None => Ok(None),
    }
}

// =========================================================================
// Departments
// =========================================================================

/// `GET /v1/crm/departments` — paginated list scoped to the
/// authenticated user's departments. `q` does a case-insensitive
/// substring search across `name`, `code`, and `costCenter`. Sorted by
/// `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_departments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListDepartmentsQuery>,
) -> Result<Json<Vec<Department>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "name": regex.clone() }),
                Bson::Document(doc! { "code": regex.clone() }),
                Bson::Document(doc! { "costCenter": regex }),
            ]),
        );
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Department>(DEPARTMENTS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_departments.find"))
        })?;
    let rows: Vec<Department> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_departments.collect"))
    })?;

    Ok(Json(rows))
}

/// `GET /v1/crm/departments/:departmentId` — single fetch.
#[instrument(skip_all, fields(user_id = %user.user_id, department_id = %department_id))]
pub async fn get_department(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(department_id): Path<String>,
) -> Result<Json<Department>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&department_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Department>(DEPARTMENTS_COLL);
    let row = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_departments.find_one")))?
        .ok_or_else(|| ApiError::NotFound("department".to_owned()))?;

    Ok(Json(row))
}

/// `POST /v1/crm/departments` — insert.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_department(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDepartmentInput>,
) -> Result<Json<Department>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }

    let user_id = user_oid(&user)?;

    let parent = parse_opt_oid(input.parent_department_id.as_ref())?;
    let head = parse_opt_oid(input.head_id.as_ref())?;

    let dept = Department {
        identity: Identity {
            id: ObjectId::new(),
            // §9.2 reference data lives at the tenant root; the legacy
            // TS action did not bind a project either. Synthesize a
            // fresh OID so the document is syntactically valid.
            project_id: ObjectId::new(),
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        code: input.code.clone(),
        name: input.name.trim().to_owned(),
        parent_department_id: parent,
        head_id: head,
        cost_center: input.cost_center.clone(),
        description: input.description.clone(),
        active: input.active.unwrap_or(true),
        color: input.color.clone(),
    };

    let coll = mongo.collection::<Department>(DEPARTMENTS_COLL);
    coll.insert_one(&dept).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_departments.insert_one"))
    })?;

    Ok(Json(dept))
}

/// `PATCH /v1/crm/departments/:departmentId` — partial update.
#[instrument(skip_all, fields(user_id = %user.user_id, department_id = %department_id))]
pub async fn update_department(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(department_id): Path<String>,
    Json(input): Json<UpdateDepartmentInput>,
) -> Result<Json<Department>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&department_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "name", input.name.as_ref());
    set_opt_str(&mut set, "code", input.code.as_ref());
    set_opt_str(&mut set, "costCenter", input.cost_center.as_ref());
    set_opt_str(&mut set, "description", input.description.as_ref());
    set_opt_str(&mut set, "color", input.color.as_ref());
    set_opt_oid(
        &mut set,
        "parentDepartmentId",
        input.parent_department_id.as_ref(),
    )?;
    set_opt_oid(&mut set, "headId", input.head_id.as_ref())?;
    if let Some(active) = input.active {
        set.insert("active", active);
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let raw = mongo.collection::<Document>(DEPARTMENTS_COLL);
    let res = raw
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_departments.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("department".to_owned()));
    }

    let typed = mongo.collection::<Department>(DEPARTMENTS_COLL);
    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_departments.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("department".to_owned()))?;

    Ok(Json(row))
}

/// `DELETE /v1/crm/departments/:departmentId` — **hard delete** per the
/// CRM ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10).
#[instrument(skip_all, fields(user_id = %user.user_id, department_id = %department_id))]
pub async fn delete_department(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(department_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&department_id)?;

    let filter = doc! { "_id": oid, "userId": user_id };

    let coll = mongo.collection::<Document>(DEPARTMENTS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_departments.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("department".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

// =========================================================================
// Designations
// =========================================================================

/// `GET /v1/crm/designations` — paginated list scoped to the caller.
/// `q` searches `name` / `code` / `grade`. `departmentId` filters by
/// the parent department.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_designations(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListDesignationsQuery>,
) -> Result<Json<Vec<Designation>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);

    if let Some(dept) = q.department_id.as_deref().filter(|s| !s.is_empty()) {
        let dept_oid = oid_from_str(dept)?;
        filter.insert("departmentId", dept_oid);
    }

    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "name": regex.clone() }),
                Bson::Document(doc! { "code": regex.clone() }),
                Bson::Document(doc! { "grade": regex }),
            ]),
        );
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Designation>(DESIGNATIONS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_designations.find"))
        })?;
    let rows: Vec<Designation> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_designations.collect"))
    })?;

    Ok(Json(rows))
}

/// `GET /v1/crm/designations/:designationId` — single fetch.
#[instrument(skip_all, fields(user_id = %user.user_id, designation_id = %designation_id))]
pub async fn get_designation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(designation_id): Path<String>,
) -> Result<Json<Designation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&designation_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Designation>(DESIGNATIONS_COLL);
    let row = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_designations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("designation".to_owned()))?;

    Ok(Json(row))
}

/// `POST /v1/crm/designations` — insert.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_designation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDesignationInput>,
) -> Result<Json<Designation>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }

    let user_id = user_oid(&user)?;

    let department = parse_opt_oid(input.department_id.as_ref())?;
    let reports_to = parse_opt_oid(input.reports_to_designation_id.as_ref())?;

    let role = Designation {
        identity: Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        code: input.code.clone(),
        name: input.name.trim().to_owned(),
        department_id: department,
        level: input.level,
        grade: input.grade.clone(),
        min_ctc: input.min_ctc,
        max_ctc: input.max_ctc,
        reports_to_designation_id: reports_to,
        description: input.description.clone(),
        active: input.active.unwrap_or(true),
        color: input.color.clone(),
    };

    let coll = mongo.collection::<Designation>(DESIGNATIONS_COLL);
    coll.insert_one(&role).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_designations.insert_one"))
    })?;

    Ok(Json(role))
}

/// `PATCH /v1/crm/designations/:designationId` — partial update.
#[instrument(skip_all, fields(user_id = %user.user_id, designation_id = %designation_id))]
pub async fn update_designation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(designation_id): Path<String>,
    Json(input): Json<UpdateDesignationInput>,
) -> Result<Json<Designation>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&designation_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "name", input.name.as_ref());
    set_opt_str(&mut set, "code", input.code.as_ref());
    set_opt_str(&mut set, "grade", input.grade.as_ref());
    set_opt_str(&mut set, "description", input.description.as_ref());
    set_opt_str(&mut set, "color", input.color.as_ref());
    set_opt_oid(&mut set, "departmentId", input.department_id.as_ref())?;
    set_opt_oid(
        &mut set,
        "reportsToDesignationId",
        input.reports_to_designation_id.as_ref(),
    )?;
    if let Some(level) = input.level {
        set.insert("level", level as i32);
    }
    if let Some(min_ctc) = input.min_ctc {
        set.insert("minCtc", min_ctc);
    }
    if let Some(max_ctc) = input.max_ctc {
        set.insert("maxCtc", max_ctc);
    }
    if let Some(active) = input.active {
        set.insert("active", active);
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let raw = mongo.collection::<Document>(DESIGNATIONS_COLL);
    let res = raw
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_designations.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("designation".to_owned()));
    }

    let typed = mongo.collection::<Designation>(DESIGNATIONS_COLL);
    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_designations.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("designation".to_owned()))?;

    Ok(Json(row))
}

/// `DELETE /v1/crm/designations/:designationId` — soft delete.
#[instrument(skip_all, fields(user_id = %user.user_id, designation_id = %designation_id))]
pub async fn delete_designation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(designation_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&designation_id)?;

    let filter = doc! { "_id": oid, "userId": user_id };

    let coll = mongo.collection::<Document>(DESIGNATIONS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_designations.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("designation".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_limit_uses_default_when_absent() {
        assert_eq!(clamp_limit(None), DEFAULT_LIMIT);
    }

    #[test]
    fn clamp_limit_caps_at_max() {
        assert_eq!(clamp_limit(Some(500)), MAX_LIMIT);
    }

    #[test]
    fn clamp_limit_floors_at_one() {
        assert_eq!(clamp_limit(Some(0)), 1);
    }

    #[test]
    fn base_filter_excludes_archived() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(oid);
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn set_opt_str_skips_none_for_department_field() {
        let mut d = doc! {};
        set_opt_str(&mut d, "costCenter", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some_for_department_field() {
        let mut d = doc! {};
        let v = "CC-1001".to_owned();
        set_opt_str(&mut d, "costCenter", Some(&v));
        assert_eq!(d.get_str("costCenter").unwrap(), "CC-1001");
    }

    #[test]
    fn set_opt_oid_rejects_garbage_for_designation_field() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "departmentId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn parse_opt_oid_treats_empty_as_absent() {
        let empty = "".to_owned();
        assert!(parse_opt_oid(Some(&empty)).unwrap().is_none());
        assert!(parse_opt_oid(None).unwrap().is_none());
    }

    #[test]
    fn parse_opt_oid_parses_valid_hex() {
        let raw = "65a0a0a0a0a0a0a0a0a0a0a0".to_owned();
        let oid = parse_opt_oid(Some(&raw)).unwrap().unwrap();
        assert_eq!(oid.to_hex(), raw);
    }
}
