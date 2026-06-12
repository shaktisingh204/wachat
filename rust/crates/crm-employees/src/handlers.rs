//! HTTP handlers for the §9.1 Employee entity.
//!
//! Five handlers:
//!
//! | Method  | Path                | Function              |
//! |---------|---------------------|-----------------------|
//! | `GET`   | `/`                 | [`list_employees`]    |
//! | `GET`   | `/:employeeId`      | [`get_employee`]      |
//! | `POST`  | `/`                 | [`create_employee`]   |
//! | `PATCH` | `/:employeeId`      | [`update_employee`]   |
//! | `DELETE`| `/:employeeId`      | [`delete_employee`]   |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/hrm/employees` + `/v1/crm/employees` (legacy) —
//!   `userId == AuthUser.user_id`, the CRM tenant root from
//!   `crm-core::Identity`. Unchanged behaviour.
//! - `/v1/sabcrm/people/employees` (SabCRM People suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.
//!
//! Employees are NOT in the §13.5 lineage chain — they are a root HRM
//! node — so this crate does not seed `lineage[]` on create. See the
//! crate-level docs for context.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use hrm_payroll_types::{Employee, EmploymentStatus, EmploymentType};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateEmployeeInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, ScopeQuery, UpdateEmployeeInput,
};

/// Mongo collection name. Matches the §9.1 spec and the
/// `Employee` doc-comment in `hrm-payroll-types::employee`.
const EMPLOYEES_COLL: &str = "crm_employees";

// =========================================================================
// Helpers
// =========================================================================

/// Resolve the calling tenant root from the verified [`AuthUser`].
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Clamp `requested` page-size into `[1, MAX_LIMIT]`, defaulting to
/// [`DEFAULT_LIMIT`] when absent. Returns an `i64` to match the
/// `mongodb` driver's `FindOptions::limit` signature.
fn clamp_limit(requested: Option<u32>) -> i64 {
    match requested {
        None => DEFAULT_LIMIT,
        Some(n) => (n as i64).clamp(1, MAX_LIMIT),
    }
}

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`] (attached as an axum `Extension` by the router
/// constructor):
///
/// - `ScopeMode::User` (legacy mounts) — scope by the verified JWT
///   subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/people/employees`) — scope by the
///   caller-supplied `projectId`, 4xx when absent/invalid. The Next.js
///   action gate has already validated project membership before the
///   request reaches Rust.
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

/// Materialize the base ownership filter for the resolved scope:
/// `{ <userId|projectId>, archived: { $ne: true } }`. Soft-deleted rows
/// (`archived = true`) are excluded by default; callers that want to
/// surface them must build their own filter.
fn base_ownership_filter(scope: &TenantScope) -> Document {
    let mut f = scope.filter();
    f.insert("archived", doc! { "$ne": true });
    f
}

/// Optional-string update helper. When the input field is `Some`,
/// inserts the value at `key` in `$set`; when `None`, leaves the
/// document untouched (PATCH semantics — absent ≠ `null`).
fn set_opt_str(set: &mut Document, key: &str, val: Option<&String>) {
    if let Some(v) = val {
        set.insert(key, v.as_str());
    }
}

/// Optional-ObjectId-like update helper. Parses a 24-char hex string
/// when present and stores the OID; rejects malformed input with
/// `BadRequest`.
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Serialize an `EmploymentStatus` enum to its on-the-wire snake_case
/// label so we can store it as a plain string in `$set` updates and in
/// the synthetic create document.
fn status_label(s: EmploymentStatus) -> &'static str {
    match s {
        EmploymentStatus::Active => "active",
        EmploymentStatus::OnLeave => "on_leave",
        EmploymentStatus::Terminated => "terminated",
        EmploymentStatus::Resigned => "resigned",
    }
}

/// Serialize an `EmploymentType` enum to its on-the-wire snake_case
/// label.
fn employment_type_label(t: EmploymentType) -> &'static str {
    match t {
        EmploymentType::FullTime => "full_time",
        EmploymentType::PartTime => "part_time",
        EmploymentType::Contract => "contract",
        EmploymentType::Intern => "intern",
        EmploymentType::Consultant => "consultant",
    }
}

/// Validate a status string against the canonical `EmploymentStatus`
/// labels. Used by the list filter so the filter rejects garbage early
/// rather than silently returning an empty set.
fn parse_status_label(s: &str) -> Result<&'static str> {
    match s {
        "active" => Ok("active"),
        "on_leave" => Ok("on_leave"),
        "terminated" => Ok("terminated"),
        "resigned" => Ok("resigned"),
        other => Err(ApiError::BadRequest(format!(
            "invalid employment status: {other}"
        ))),
    }
}

// =========================================================================
// GET / — list_employees
// =========================================================================

/// `GET /v1/crm/employees` — paginated list scoped to the authenticated
/// user's employees. Supports a free-text `q`, plus filter columns
/// `departmentId` / `designationId` / `status`. Sorted by `createdAt`
/// desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_employees(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Employee>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);

    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "firstName": regex.clone() }),
                Bson::Document(doc! { "lastName": regex.clone() }),
                Bson::Document(doc! { "displayName": regex.clone() }),
                Bson::Document(doc! { "workEmail": regex.clone() }),
                Bson::Document(doc! { "employeeId": regex }),
            ]),
        );
    }

    if let Some(dep) = q.department_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("departmentId", oid_from_str(dep)?);
    }
    if let Some(des) = q.designation_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("designationId", oid_from_str(des)?);
    }
    if let Some(st) = q.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", parse_status_label(st)?);
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Employee>(EMPLOYEES_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_employees.find")))?;
    let employees: Vec<Employee> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_employees.collect")))?;

    Ok(Json(employees))
}

// =========================================================================
// GET /:employeeId — get_employee
// =========================================================================

/// `GET /v1/crm/employees/:employeeId` — fetch a single employee.
/// Returns 404 if the employee doesn't exist OR isn't owned by the
/// caller (we collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, employee_id = %employee_id))]
pub async fn get_employee(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(employee_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<Employee>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let emp_oid = oid_from_str(&employee_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", emp_oid);

    let coll = mongo.collection::<Employee>(EMPLOYEES_COLL);
    let employee = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_employees.find_one")))?
        .ok_or_else(|| ApiError::NotFound("employee".to_owned()))?;

    Ok(Json(employee))
}

// =========================================================================
// POST / — create_employee
// =========================================================================

/// `POST /v1/crm/employees` — insert a new employee.
///
/// Builds a BSON document that matches the flattened `Employee` shape
/// from `hrm-payroll-types::employee`, persists it, and re-reads it via
/// the typed collection so the response is a canonical `Employee`.
///
/// **Designation handling.** The §9.1 type model carries a
/// `designation` *string* on the document (denormalized for list
/// rendering) plus a `designationId` *ObjectId* FK we also stamp
/// alongside it. Without the Designation collection wired in via this
/// crate, the inserted `designation` string defaults to the hex of the
/// designation FK; the downstream "designation lookup" worker
/// reconciles it on first read. This keeps the typed deserializer happy
/// (`designation: String` is non-optional) without coupling this crate
/// to the §9.2 collection.
///
/// **Employee code.** §9.1 requires a tenant-issued `employeeId`
/// ("EMP-0001"). We synthesize a placeholder `EMP-<short-hex>` derived
/// from the new ObjectId so the doc is valid; tenant admins can rename
/// it via PATCH (or via the dedicated "regenerate employee code"
/// endpoint, when that ships).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_employee(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEmployeeInput>,
) -> Result<Json<Employee>> {
    if input.first_name.trim().is_empty() || input.last_name.trim().is_empty() {
        return Err(ApiError::Validation(
            "firstName and lastName are required.".to_owned(),
        ));
    }
    if input.work_email.trim().is_empty() {
        return Err(ApiError::Validation("workEmail is required.".to_owned()));
    }

    let user_id = user_oid(&user)?;
    // In project mode the body's `projectId` IS the tenant scope and is
    // therefore mandatory (4xx when absent) — `resolve_scope` enforces
    // that. In legacy user mode the scope is the JWT subject and the
    // body `projectId` stays optional, exactly as before. The stamped
    // `userId` is always `AuthUser.user_id` (auditing).
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => p,
        TenantScope::User(_) => match input.project_id.as_deref().filter(|s| !s.is_empty()) {
            Some(s) => oid_from_str(s)?,
            // §9.1 requires a project scope, but legacy single-tenant
            // callers omit it and pick up a freshly-minted id at insert
            // time. Match the legacy behaviour during the migration window.
            None => ObjectId::new(),
        },
    };

    let department_oid = oid_from_str(&input.department_id)?;
    let designation_oid = oid_from_str(&input.designation_id)?;
    let salary_structure_oid = oid_from_str(&input.salary_structure_id)?;

    let reporting_manager_oid = match input
        .reporting_manager_id
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let dotted_line_manager_oid = match input
        .dotted_line_manager_id
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    let now = bson::DateTime::from_chrono(Utc::now());
    let employee_oid = ObjectId::new();
    // Short, stable employee code derived from the new OID. Tenant
    // admins rename via PATCH if they want the canonical "EMP-0001"
    // sequence; we never block creation on it.
    let employee_code = format!("EMP-{}", &employee_oid.to_hex()[18..24].to_uppercase());

    let employment_type =
        employment_type_label(input.employment_type.unwrap_or(EmploymentType::FullTime));
    let status = status_label(input.status.unwrap_or(EmploymentStatus::Active));

    let mut doc = doc! {
        "_id": employee_oid,
        "projectId": project_id,
        "userId": user_id,

        // Audit
        "createdAt": now,
        "updatedAt": now,
        "createdBy": user_id,
        "updatedBy": user_id,

        // Personal — required
        "firstName": input.first_name.trim(),
        "lastName": input.last_name.trim(),
        "dob": bson::DateTime::from_chrono(input.dob),

        // Employment — required
        "employeeId": &employee_code,
        "joiningDate": bson::DateTime::from_chrono(input.joining_date),
        "employmentType": employment_type,
        "departmentId": department_oid,
        "designationId": designation_oid,
        // Denormalized designation label — see function-level comment.
        "designation": designation_oid.to_hex(),
        "workEmail": input.work_email.trim(),
        "salaryStructureId": salary_structure_oid,
        "status": status,

        // Lifecycle defaults
        "archived": false,
    };

    // Optional personal fields
    if let Some(v) = input.display_name.as_deref().filter(|s| !s.is_empty()) {
        doc.insert("displayName", v);
    }
    if let Some(v) = input.salutation.as_deref().filter(|s| !s.is_empty()) {
        doc.insert("salutation", v);
    }
    if let Some(g) = input.gender {
        // Gender serializes via serde with rename_all = snake_case;
        // dump-and-reparse keeps us in sync with the enum in one place.
        let label = serde_json::to_string(&g)
            .ok()
            .and_then(|s| serde_json::from_str::<String>(&s).ok())
            .unwrap_or_else(|| "other".to_owned());
        doc.insert("gender", label);
    }
    if let Some(v) = input.personal_email.as_deref().filter(|s| !s.is_empty()) {
        doc.insert("personalEmail", v);
    }
    if let Some(v) = input.personal_phone.as_deref().filter(|s| !s.is_empty()) {
        doc.insert("personalPhone", v);
    }

    // Optional employment fields
    if let Some(v) = input.work_phone.as_deref().filter(|s| !s.is_empty()) {
        doc.insert("workPhone", v);
    }
    if let Some(oid) = reporting_manager_oid {
        doc.insert("reportingManagerId", oid);
    }
    if let Some(oid) = dotted_line_manager_oid {
        doc.insert("dottedLineManagerId", oid);
    }
    if let Some(ctc) = input.ctc {
        doc.insert("ctc", ctc);
    }
    if let Some(pct) = input.variable_pct {
        doc.insert("variablePct", pct as f64);
    }
    if let Some(d) = input.notice_period_days {
        doc.insert("noticePeriodDays", d as i64);
    }

    let raw = mongo.collection::<Document>(EMPLOYEES_COLL);
    raw.insert_one(&doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_employees.insert_one"))
    })?;

    // Re-read via the typed collection so the response is the canonical
    // [`Employee`] shape.
    let typed = mongo.collection::<Employee>(EMPLOYEES_COLL);
    let employee = typed
        .find_one(doc! { "_id": employee_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_employees.find_one(after-insert)"),
            )
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "employee disappeared between insert and read"
            ))
        })?;

    Ok(Json(employee))
}

// =========================================================================
// PATCH /:employeeId — update_employee
// =========================================================================

/// `PATCH /v1/crm/employees/:employeeId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the employee
/// doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, employee_id = %employee_id))]
pub async fn update_employee(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(employee_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdateEmployeeInput>,
) -> Result<Json<Employee>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let emp_oid = oid_from_str(&employee_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    // Personal
    set_opt_str(&mut set, "firstName", input.first_name.as_ref());
    set_opt_str(&mut set, "lastName", input.last_name.as_ref());
    set_opt_str(&mut set, "displayName", input.display_name.as_ref());
    set_opt_str(&mut set, "salutation", input.salutation.as_ref());
    if let Some(when) = input.dob {
        set.insert("dob", bson::DateTime::from_chrono(when));
    }
    if let Some(g) = input.gender {
        let label = serde_json::to_string(&g)
            .ok()
            .and_then(|s| serde_json::from_str::<String>(&s).ok())
            .unwrap_or_else(|| "other".to_owned());
        set.insert("gender", label);
    }

    // Contact
    set_opt_str(&mut set, "personalEmail", input.personal_email.as_ref());
    set_opt_str(&mut set, "personalPhone", input.personal_phone.as_ref());
    set_opt_str(&mut set, "workEmail", input.work_email.as_ref());
    set_opt_str(&mut set, "workPhone", input.work_phone.as_ref());

    // Employment
    if let Some(when) = input.joining_date {
        set.insert("joiningDate", bson::DateTime::from_chrono(when));
    }
    set_opt_oid(&mut set, "departmentId", input.department_id.as_ref())?;
    set_opt_oid(&mut set, "designationId", input.designation_id.as_ref())?;
    set_opt_oid(
        &mut set,
        "salaryStructureId",
        input.salary_structure_id.as_ref(),
    )?;
    set_opt_oid(
        &mut set,
        "reportingManagerId",
        input.reporting_manager_id.as_ref(),
    )?;
    set_opt_oid(
        &mut set,
        "dottedLineManagerId",
        input.dotted_line_manager_id.as_ref(),
    )?;
    if let Some(t) = input.employment_type {
        set.insert("employmentType", employment_type_label(t));
    }
    if let Some(s) = input.status {
        set.insert("status", status_label(s));
    }
    if let Some(ctc) = input.ctc {
        set.insert("ctc", ctc);
    }
    if let Some(pct) = input.variable_pct {
        set.insert("variablePct", pct as f64);
    }
    if let Some(d) = input.notice_period_days {
        set.insert("noticePeriodDays", d as i64);
    }

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", emp_oid);

    let coll = mongo.collection::<Document>(EMPLOYEES_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_employees.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("employee".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`Employee`] shape.
    let typed = mongo.collection::<Employee>(EMPLOYEES_COLL);
    let employee = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_employees.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("employee".to_owned()))?;

    Ok(Json(employee))
}

// =========================================================================
// DELETE /:employeeId — delete_employee
// =========================================================================

/// `DELETE /v1/crm/employees/:employeeId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the employee doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, employee_id = %employee_id))]
pub async fn delete_employee(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(employee_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let emp_oid = oid_from_str(&employee_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", emp_oid);

    let coll = mongo.collection::<Document>(EMPLOYEES_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_employees.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("employee".to_owned()));
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

    /// Test-only [`AuthUser`] with a valid 24-hex subject.
    fn fake_user(oid: &ObjectId) -> AuthUser {
        AuthUser {
            user_id: oid.to_hex(),
            tenant_id: String::new(),
            roles: Vec::new(),
        }
    }

    #[test]
    fn base_filter_excludes_archived_user_scope() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(&TenantScope::User(oid));
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        assert!(!f.contains_key("projectId"));
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn base_filter_excludes_archived_project_scope() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(&TenantScope::Project(oid));
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn resolve_scope_project_rejects_missing_project_id() {
        // The `project_router` mount attaches `ScopeMode::Project`; a
        // request without `projectId` must 4xx (mirrors the
        // `crm-core::scope` tests).
        let user = fake_user(&ObjectId::new());
        let err = resolve_scope(ScopeMode::Project, &user, None).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
        let err = resolve_scope(ScopeMode::Project, &user, Some("  ")).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
        let err = resolve_scope(ScopeMode::Project, &user, Some("not-an-oid")).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
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
    fn set_opt_str_skips_none() {
        let mut d = doc! {};
        set_opt_str(&mut d, "firstName", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "Asha".to_owned();
        set_opt_str(&mut d, "firstName", Some(&v));
        assert_eq!(d.get_str("firstName").unwrap(), "Asha");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "departmentId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn status_label_round_trip_covers_all_variants() {
        assert_eq!(status_label(EmploymentStatus::Active), "active");
        assert_eq!(status_label(EmploymentStatus::OnLeave), "on_leave");
        assert_eq!(status_label(EmploymentStatus::Terminated), "terminated");
        assert_eq!(status_label(EmploymentStatus::Resigned), "resigned");
    }

    #[test]
    fn employment_type_label_round_trip_covers_all_variants() {
        assert_eq!(employment_type_label(EmploymentType::FullTime), "full_time");
        assert_eq!(employment_type_label(EmploymentType::PartTime), "part_time");
        assert_eq!(employment_type_label(EmploymentType::Contract), "contract");
        assert_eq!(employment_type_label(EmploymentType::Intern), "intern");
        assert_eq!(
            employment_type_label(EmploymentType::Consultant),
            "consultant"
        );
    }

    #[test]
    fn parse_status_label_accepts_known() {
        assert_eq!(parse_status_label("active").unwrap(), "active");
        assert_eq!(parse_status_label("on_leave").unwrap(), "on_leave");
        assert_eq!(parse_status_label("terminated").unwrap(), "terminated");
        assert_eq!(parse_status_label("resigned").unwrap(), "resigned");
    }

    #[test]
    fn parse_status_label_rejects_garbage() {
        let err = parse_status_label("not-a-status").unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }
}
