//! HTTP handlers for §9.4 Leave Management — both the leave catalog
//! (`LeaveType`) and the per-employee applications (`LeaveApplication`),
//! plus the `approve` action.
//!
//! | Method  | Path                                | Function                            |
//! |---------|-------------------------------------|-------------------------------------|
//! | `GET`   | `/types`                            | [`list_leave_types`]                |
//! | `GET`   | `/types/:typeId`                    | [`get_leave_type`]                  |
//! | `POST`  | `/types`                            | [`create_leave_type`]               |
//! | `PATCH` | `/types/:typeId`                    | [`update_leave_type`]               |
//! | `DELETE`| `/types/:typeId`                    | [`delete_leave_type`]               |
//! | `GET`   | `/applications`                     | [`list_leave_applications`]         |
//! | `GET`   | `/applications/:applicationId`      | [`get_leave_application`]           |
//! | `POST`  | `/applications`                     | [`create_leave_application`]        |
//! | `PATCH` | `/applications/:applicationId`      | [`update_leave_application`]        |
//! | `DELETE`| `/applications/:applicationId`      | [`delete_leave_application`]        |
//! | `POST`  | `/applications/:applicationId/approve` | [`approve_leave_application`]    |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/hrm/leaves` + `/v1/crm/leaves` (legacy) —
//!   `userId == AuthUser.user_id`, the CRM tenant root from
//!   `crm-core::Identity`. Unchanged behaviour.
//! - `/v1/sabcrm/people/leaves` (SabCRM People suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Assignment, Audit, Identity, ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use hrm_payroll_types::{ApproverStep, LeaveApplication, LeaveApplicationStatus, LeaveType};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    ApproveLeaveApplicationInput, CreateLeaveApplicationInput, CreateLeaveTypeInput, DEFAULT_LIMIT,
    ListLeaveApplicationsQuery, ListLeaveTypesQuery, MAX_LIMIT, ScopeQuery,
    UpdateLeaveApplicationInput, UpdateLeaveTypeInput,
};

/// Mongo collection name for the leave-type catalog.
const LEAVE_TYPES_COLL: &str = "crm_leave_types";

/// Mongo collection name for per-employee leave applications.
const LEAVE_APPLICATIONS_COLL: &str = "crm_leave_applications";

// =========================================================================
// Helpers (shared)
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

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`] (attached as an axum `Extension` by the router
/// constructor):
///
/// - `ScopeMode::User` (legacy mounts) — scope by the verified JWT
///   subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/people/leaves`) — scope by the
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
/// `{ <userId|projectId>, archived: { $ne: true } }`.
fn base_ownership_filter(scope: &TenantScope) -> Document {
    let mut f = scope.filter();
    f.insert("archived", doc! { "$ne": true });
    f
}

/// Optional-string update helper.
fn set_opt_str(set: &mut Document, key: &str, val: Option<&String>) {
    if let Some(v) = val {
        set.insert(key, v.as_str());
    }
}

/// Optional-ObjectId-like update helper (parses a 24-char hex when present).
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Optional-bool update helper.
fn set_opt_bool(set: &mut Document, key: &str, val: Option<bool>) {
    if let Some(v) = val {
        set.insert(key, v);
    }
}

/// Resolve a project-id input. When the caller sent a non-empty hex
/// string we parse it; when absent we mint a fresh ObjectId so the
/// document is at least syntactically valid (mirrors the convention
/// established in `crm-leads::create_lead`).
fn resolve_project_id(raw: Option<&str>) -> Result<ObjectId> {
    match raw.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s),
        None => Ok(ObjectId::new()),
    }
}

/// Compute the day count for a leave application. A naive
/// `(to - from) + 1`-day count, halved when `half_day` is true.
/// Production work hands this off to the leave-balance worker once it
/// lands; we compute something coherent here so the document is never
/// persisted with a zero/garbage `days`.
fn compute_days(from: chrono::DateTime<Utc>, to: chrono::DateTime<Utc>, half_day: bool) -> f32 {
    let span = (to.date_naive() - from.date_naive()).num_days() + 1;
    let raw = span.max(1) as f32;
    if half_day { raw / 2.0 } else { raw }
}

// =========================================================================
// LeaveType — list / get / create / update / delete
// =========================================================================

/// `GET /v1/crm/leaves/types` — paginated list scoped to the
/// authenticated user's leave-type catalog. The `q` query param is a
/// case-insensitive substring search across `code` and `name`. Sorted
/// by `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_leave_types(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListLeaveTypesQuery>,
) -> Result<Json<Vec<LeaveType>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "code": regex.clone() }),
                Bson::Document(doc! { "name": regex }),
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

    let coll = mongo.collection::<LeaveType>(LEAVE_TYPES_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_types.find"))
        })?;
    let rows: Vec<LeaveType> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_types.collect"))
    })?;

    Ok(Json(rows))
}

/// `GET /v1/crm/leaves/types/:typeId` — single catalog row. 404 if not
/// found OR not owned by the caller (existence is not leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, type_id = %type_id))]
pub async fn get_leave_type(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(type_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<LeaveType>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&type_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", oid);

    let coll = mongo.collection::<LeaveType>(LEAVE_TYPES_COLL);
    let row = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_leave_types.find_one")))?
        .ok_or_else(|| ApiError::NotFound("leaveType".to_owned()))?;

    Ok(Json(row))
}

/// `POST /v1/crm/leaves/types` — insert a new catalog row.
///
/// Required: `code`, `name`. Defaults applied: `paid` defaults to `true`
/// (matches `LeaveType`'s persisted default), `accrualRule` defaults to
/// `"none"`, `carryForward` / `encashable` default to `false`.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_leave_type(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateLeaveTypeInput>,
) -> Result<Json<LeaveType>> {
    if input.code.trim().is_empty() || input.name.trim().is_empty() {
        return Err(ApiError::Validation(
            "code and name are required.".to_owned(),
        ));
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
        TenantScope::User(_) => resolve_project_id(input.project_id.as_deref())?,
    };

    let lt = LeaveType {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        code: input.code.trim().to_owned(),
        name: input.name.trim().to_owned(),
        paid: input.paid.unwrap_or(true),
        accrual_rule: input
            .accrual_rule
            .clone()
            .unwrap_or_else(|| "none".to_owned()),
        max_balance: input.max_balance,
        carry_forward: input.carry_forward.unwrap_or(false),
        encashable: input.encashable.unwrap_or(false),
        gender_restricted: input.gender_restricted.clone(),
        min_service_months: input.min_service_months,
    };

    let coll = mongo.collection::<LeaveType>(LEAVE_TYPES_COLL);
    coll.insert_one(&lt).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_types.insert_one"))
    })?;

    Ok(Json(lt))
}

/// `PATCH /v1/crm/leaves/types/:typeId` — partial update. `updatedAt` /
/// `updatedBy` are always refreshed. 404 if not owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, type_id = %type_id))]
pub async fn update_leave_type(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(type_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdateLeaveTypeInput>,
) -> Result<Json<LeaveType>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&type_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "code", input.code.as_ref());
    set_opt_str(&mut set, "name", input.name.as_ref());
    set_opt_str(&mut set, "accrualRule", input.accrual_rule.as_ref());
    set_opt_str(
        &mut set,
        "genderRestricted",
        input.gender_restricted.as_ref(),
    );
    set_opt_bool(&mut set, "paid", input.paid);
    set_opt_bool(&mut set, "carryForward", input.carry_forward);
    set_opt_bool(&mut set, "encashable", input.encashable);
    if let Some(mb) = input.max_balance {
        set.insert("maxBalance", mb as f64);
    }
    if let Some(months) = input.min_service_months {
        set.insert("minServiceMonths", months as i64);
    }

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Document>(LEAVE_TYPES_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_types.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("leaveType".to_owned()));
    }

    let typed = mongo.collection::<LeaveType>(LEAVE_TYPES_COLL);
    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_leave_types.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("leaveType".to_owned()))?;

    Ok(Json(row))
}

/// `DELETE /v1/crm/leaves/types/:typeId` — soft delete. Sets
/// `archived = true` and stamps `deletedAt`.
#[instrument(skip_all, fields(user_id = %user.user_id, type_id = %type_id))]
pub async fn delete_leave_type(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(type_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&type_id)?;

    let now = bson::DateTime::from_chrono(Utc::now());
    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", oid);

    let update = doc! {
        "$set": {
            "archived": true,
            "deletedAt": now,
            "updatedAt": now,
            "updatedBy": user_id,
        },
    };

    let coll = mongo.collection::<Document>(LEAVE_TYPES_COLL);
    let res = coll.update_one(filter, update).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_types.soft_delete"))
    })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("leaveType".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "archived": true })))
}

// =========================================================================
// LeaveApplication — list / get / create / update / delete
// =========================================================================

/// Render a [`LeaveApplicationStatus`] as the canonical Mongo string the
/// flattened `status` field stores. Mirrors the enum's snake_case serde
/// rename.
fn status_to_str(status: LeaveApplicationStatus) -> &'static str {
    match status {
        LeaveApplicationStatus::Pending => "pending",
        LeaveApplicationStatus::Approved => "approved",
        LeaveApplicationStatus::Rejected => "rejected",
        LeaveApplicationStatus::Cancelled => "cancelled",
    }
}

/// `GET /v1/crm/leaves/applications` — paginated list scoped to the
/// authenticated user. Optional filters: `employeeId` (matches the
/// flattened `assignedTo`), `status`. Sorted by `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_leave_applications(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListLeaveApplicationsQuery>,
) -> Result<Json<Vec<LeaveApplication>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);
    if let Some(emp) = q
        .employee_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let oid = oid_from_str(emp)?;
        filter.insert("assignedTo", oid);
    }
    if let Some(status) = q.status {
        filter.insert("status", status_to_str(status));
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<LeaveApplication>(LEAVE_APPLICATIONS_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_applications.find"))
    })?;
    let rows: Vec<LeaveApplication> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_applications.collect"))
    })?;

    Ok(Json(rows))
}

/// `GET /v1/crm/leaves/applications/:applicationId` — single application.
/// 404 if not owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, application_id = %application_id))]
pub async fn get_leave_application(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(application_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<LeaveApplication>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&application_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", oid);

    let coll = mongo.collection::<LeaveApplication>(LEAVE_APPLICATIONS_COLL);
    let row = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_applications.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("leaveApplication".to_owned()))?;

    Ok(Json(row))
}

/// `POST /v1/crm/leaves/applications` — submit a new application.
///
/// Status always starts as `Pending`. The applicant defaults to the
/// authenticated user (stamped on `Assignment.assignedTo`); admins can
/// submit on behalf of someone else by passing `employeeId`.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_leave_application(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateLeaveApplicationInput>,
) -> Result<Json<LeaveApplication>> {
    let user_id = user_oid(&user)?;

    if input.to < input.from {
        return Err(ApiError::Validation(
            "to must be on or after from.".to_owned(),
        ));
    }

    let leave_type_oid = oid_from_str(&input.leave_type_id)?;
    // In project mode the body's `projectId` IS the tenant scope and is
    // therefore mandatory (4xx when absent); legacy user-mode behaviour
    // is unchanged. The stamped `userId` is always `AuthUser.user_id`.
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => p,
        TenantScope::User(_) => resolve_project_id(input.project_id.as_deref())?,
    };

    // Verify the referenced LeaveType exists and is owned by the same
    // tenant scope. Without this check a caller could attach an
    // application to someone else's catalog row. Cross-collection reads
    // use `scope.filter()` so a Project-mounted create only sees that
    // project's catalog.
    {
        let coll = mongo.collection::<LeaveType>(LEAVE_TYPES_COLL);
        let mut f = base_ownership_filter(&scope);
        f.insert("_id", leave_type_oid);
        let exists = coll.find_one(f).await.map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_leave_applications.create.lookup_type"),
            )
        })?;
        if exists.is_none() {
            return Err(ApiError::NotFound("leaveType".to_owned()));
        }
    }

    let applicant = match input
        .employee_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => oid_from_str(s)?,
        // Default applicant = the authenticated caller. Stamped on
        // `Assignment.assignedTo` so the per-employee dashboard's
        // "my applications" filter just works.
        None => user_id,
    };

    let half_day = input.half_day.unwrap_or(false);
    let days = compute_days(input.from, input.to, half_day);

    let app = LeaveApplication {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        assignment: Assignment {
            assigned_to: Some(applicant),
            ..Default::default()
        },
        leave_type_id: leave_type_oid,
        from: input.from,
        to: input.to,
        half_day,
        days,
        reason: input.reason.clone(),
        attachments: input.attachments.clone().unwrap_or_default(),
        approver_chain: Vec::new(),
        // Always starts pending. Workflow transitions go through the
        // approve / reject / cancel actions.
        status: LeaveApplicationStatus::Pending,
        balance_snapshot: None,
    };

    let coll = mongo.collection::<LeaveApplication>(LEAVE_APPLICATIONS_COLL);
    coll.insert_one(&app).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_applications.insert_one"))
    })?;

    Ok(Json(app))
}

/// `PATCH /v1/crm/leaves/applications/:applicationId` — partial update.
/// `status` is intentionally not patchable here — use the approve /
/// reject / cancel actions instead.
#[instrument(skip_all, fields(user_id = %user.user_id, application_id = %application_id))]
pub async fn update_leave_application(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(application_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdateLeaveApplicationInput>,
) -> Result<Json<LeaveApplication>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&application_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_oid(&mut set, "leaveTypeId", input.leave_type_id.as_ref())?;
    set_opt_str(&mut set, "reason", input.reason.as_ref());
    set_opt_bool(&mut set, "halfDay", input.half_day);
    if let Some(when) = input.from {
        set.insert("from", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.to {
        set.insert("to", bson::DateTime::from_chrono(when));
    }
    if let Some(atts) = input.attachments.as_ref() {
        let bson_atts = bson::to_bson(atts).map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_leave_applications.update.attachments"),
            )
        })?;
        set.insert("attachments", bson_atts);
    }

    // If from/to/halfDay shifted, recompute `days` so the snapshot stays
    // coherent. We re-read the doc to fill in the unchanged fields.
    let needs_recount = input.from.is_some() || input.to.is_some() || input.half_day.is_some();

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Document>(LEAVE_APPLICATIONS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_applications.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("leaveApplication".to_owned()));
    }

    let typed = mongo.collection::<LeaveApplication>(LEAVE_APPLICATIONS_COLL);
    let mut row = typed
        .find_one(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_leave_applications.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("leaveApplication".to_owned()))?;

    if needs_recount {
        let days = compute_days(row.from, row.to, row.half_day);
        if (days - row.days).abs() > f32::EPSILON {
            let coll_d = mongo.collection::<Document>(LEAVE_APPLICATIONS_COLL);
            coll_d
                .update_one(filter, doc! { "$set": { "days": days as f64 } })
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("crm_leave_applications.update_days"),
                    )
                })?;
            row.days = days;
        }
    }

    Ok(Json(row))
}

/// `DELETE /v1/crm/leaves/applications/:applicationId` — **hard delete**.
/// Per the CRM ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM
/// entities use hard deletes — the row is removed from the collection.
/// Fails with 404 if the application doesn't exist OR isn't owned by
/// the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, application_id = %application_id))]
pub async fn delete_leave_application(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(application_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&application_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", oid);

    let coll = mongo.collection::<Document>(LEAVE_APPLICATIONS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_applications.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("leaveApplication".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

// =========================================================================
// LeaveApplication — approve action
// =========================================================================

/// `POST /v1/crm/leaves/applications/:applicationId/approve` — flips
/// `status` to `Approved` and appends an [`ApproverStep`] (the caller's
/// user id, current timestamp, optional comment) onto `approverChain`.
///
/// The action only operates on `Pending` applications — applications
/// already in a terminal state (`Approved` / `Rejected` / `Cancelled`)
/// return `409 Conflict` so the UI can surface a clean "already
/// decided" path. 404 if the application doesn't exist or isn't owned
/// by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, application_id = %application_id))]
pub async fn approve_leave_application(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(application_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<ApproveLeaveApplicationInput>,
) -> Result<Json<LeaveApplication>> {
    // Project mode requires `projectId` — accepted on the body or the
    // query string (the body wins when both are present).
    let scope = resolve_scope(
        mode,
        &user,
        input
            .project_id
            .as_deref()
            .or(scope_q.project_id.as_deref()),
    )?;
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&application_id)?;

    // Read first so we can enforce the "must be pending" guard. The
    // approve flow is rare (one row per HR decision) so the extra
    // round-trip is fine; it lets us return a precise 409 instead of a
    // silent no-op when the same step is double-clicked.
    let typed = mongo.collection::<LeaveApplication>(LEAVE_APPLICATIONS_COLL);
    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", oid);
    let current = typed
        .find_one(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leave_applications.approve.read"))
        })?
        .ok_or_else(|| ApiError::NotFound("leaveApplication".to_owned()))?;

    if current.status != LeaveApplicationStatus::Pending {
        return Err(ApiError::Conflict(format!(
            "leaveApplication is already {} and cannot be approved",
            status_to_str(current.status)
        )));
    }

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);

    let step = ApproverStep {
        approver_id: user_id,
        status: LeaveApplicationStatus::Approved,
        decided_at: Some(now),
        comment: input.comment.clone(),
    };
    let step_bson = bson::to_bson(&step).map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_leave_applications.approve.serialize_step"),
        )
    })?;

    // Atomic flip: status -> approved, push step onto approverChain,
    // refresh updated*. We keep `status` guarded to `pending` so a race
    // between two reviewers can't double-approve (the first wins; the
    // second sees `matched_count == 0` and we surface a 409).
    let coll = mongo.collection::<Document>(LEAVE_APPLICATIONS_COLL);
    let mut guarded = filter.clone();
    guarded.insert("status", "pending");
    let update = doc! {
        "$set": {
            "status": "approved",
            "updatedAt": now_bson,
            "updatedBy": user_id,
        },
        "$push": { "approverChain": step_bson },
    };
    let res = coll.update_one(guarded, update).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_leave_applications.approve.update"))
    })?;
    if res.matched_count == 0 {
        // Either the row was archived/deleted between read and write,
        // or another reviewer flipped status first. Either way the
        // caller's intent (approve this pending application) is no
        // longer valid.
        return Err(ApiError::Conflict(
            "leaveApplication state changed during approval; refresh and retry".to_owned(),
        ));
    }

    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_leave_applications.approve.find_one(after)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("leaveApplication".to_owned()))?;

    Ok(Json(row))
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

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
        assert!(f.get_document("archived").unwrap().contains_key("$ne"));
    }

    #[test]
    fn base_filter_excludes_archived_project_scope() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(&TenantScope::Project(oid));
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
        assert!(f.get_document("archived").unwrap().contains_key("$ne"));
    }

    #[test]
    fn resolve_scope_project_rejects_missing_project_id() {
        // The `project_router` mount attaches `ScopeMode::Project`; a
        // request without `projectId` must 4xx (mirrors the
        // `crm-core::scope` tests).
        let user = fake_user(&ObjectId::new());
        let err = resolve_scope(ScopeMode::Project, &user, None).unwrap_err();
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
        set_opt_str(&mut d, "name", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "EL".to_owned();
        set_opt_str(&mut d, "code", Some(&v));
        assert_eq!(d.get_str("code").unwrap(), "EL");
    }

    #[test]
    fn set_opt_bool_inserts_some() {
        let mut d = doc! {};
        set_opt_bool(&mut d, "carryForward", Some(true));
        assert_eq!(d.get_bool("carryForward").unwrap(), true);
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "leaveTypeId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn resolve_project_id_mints_when_absent() {
        let oid = resolve_project_id(None).unwrap();
        // Just assert we got a syntactically valid ObjectId — minted
        // ids are unique per call so we can't compare against anything.
        assert_eq!(oid.to_hex().len(), 24);
    }

    #[test]
    fn resolve_project_id_parses_when_provided() {
        let real = ObjectId::new().to_hex();
        let oid = resolve_project_id(Some(&real)).unwrap();
        assert_eq!(oid.to_hex(), real);
    }

    #[test]
    fn compute_days_full_day_inclusive_range() {
        let from = Utc.with_ymd_and_hms(2026, 5, 10, 0, 0, 0).unwrap();
        let to = Utc.with_ymd_and_hms(2026, 5, 12, 0, 0, 0).unwrap();
        // 10, 11, 12 -> 3 days.
        assert_eq!(compute_days(from, to, false), 3.0);
    }

    #[test]
    fn compute_days_half_day_halves_count() {
        let day = Utc.with_ymd_and_hms(2026, 5, 10, 0, 0, 0).unwrap();
        // Same-day half-day -> 0.5.
        assert_eq!(compute_days(day, day, true), 0.5);
    }

    #[test]
    fn compute_days_floor_one_when_to_before_from() {
        // Defensive: `to < from` is rejected at the handler boundary,
        // but the helper still floors at 1 day so it never produces 0
        // or negative.
        let from = Utc.with_ymd_and_hms(2026, 5, 12, 0, 0, 0).unwrap();
        let to = Utc.with_ymd_and_hms(2026, 5, 10, 0, 0, 0).unwrap();
        assert!(compute_days(from, to, false) >= 1.0);
    }

    #[test]
    fn status_to_str_round_trips_with_serde() {
        // The Mongo string we write must match what serde renders so
        // typed reads still parse correctly.
        for s in [
            LeaveApplicationStatus::Pending,
            LeaveApplicationStatus::Approved,
            LeaveApplicationStatus::Rejected,
            LeaveApplicationStatus::Cancelled,
        ] {
            let serde_form = serde_json::to_value(s).unwrap();
            assert_eq!(serde_form.as_str(), Some(status_to_str(s)));
        }
    }
}
