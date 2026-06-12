//! HTTP handlers for the §9.3 Attendance entity.
//!
//! Sibling to `crm-leads::handlers` — same conventions, no lineage.
//! Six handlers (five CRUD + two-into-one punch shorthand):
//!
//! | Method  | Path                | Function              |
//! |---------|---------------------|-----------------------|
//! | `GET`   | `/`                 | [`list_attendance`]   |
//! | `GET`   | `/:attendanceId`    | [`get_attendance`]    |
//! | `POST`  | `/`                 | [`create_attendance`] |
//! | `PATCH` | `/:attendanceId`    | [`update_attendance`] |
//! | `DELETE`| `/:attendanceId`    | [`delete_attendance`] |
//! | `POST`  | `/punch-in`         | [`punch_in`]          |
//! | `POST`  | `/punch-out`        | [`punch_out`]         |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/hrm/attendance` + `/v1/crm/attendance` (legacy) —
//!   `userId == AuthUser.user_id`, the CRM tenant root from
//!   `crm-core::Identity`. Unchanged behaviour.
//! - `/v1/sabcrm/people/attendance` (SabCRM People suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Datelike, TimeZone, Utc};
use crm_core::{Audit, Identity, ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use hrm_payroll_types::{Attendance, AttendanceSource, AttendanceStatus, PunchPoint};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateAttendanceInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, PunchInput, ScopeQuery,
    UpdateAttendanceInput,
};

/// Mongo collection name. Must match the TS `crm-attendance.actions.ts`
/// literal so the Rust BFF and the legacy Next.js action share the same
/// backing collection during the migration window.
const ATTENDANCE_COLL: &str = "crm_attendance";

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
/// - `ScopeMode::Project` (`/v1/sabcrm/people/attendance`) — scope by
///   the caller-supplied `projectId`, 4xx when absent/invalid. The
///   Next.js action gate has already validated project membership
///   before the request reaches Rust.
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
/// (`archived = true`) are excluded by default.
fn base_ownership_filter(scope: &TenantScope) -> Document {
    let mut f = scope.filter();
    f.insert("archived", doc! { "$ne": true });
    f
}

/// Optional-string update helper — see `crm-leads`.
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

/// Convert a `serde`-able value into `Bson` for `$set`. Surfaces
/// validation errors instead of panicking — same pattern as
/// `crm-tickets`.
fn to_bson_val<T: serde::Serialize>(label: &str, value: &T) -> Result<Bson> {
    bson::to_bson(value).map_err(|e| ApiError::Validation(format!("{label} shape is invalid: {e}")))
}

/// Compute `[start_of_day, start_of_next_day)` (UTC) from an instant.
/// Used by the punch endpoints to find/upsert "today's row".
fn day_window_utc(now: chrono::DateTime<Utc>) -> (chrono::DateTime<Utc>, chrono::DateTime<Utc>) {
    let start = Utc
        .with_ymd_and_hms(now.year(), now.month(), now.day(), 0, 0, 0)
        .single()
        .unwrap_or(now);
    let end = start + chrono::Duration::days(1);
    (start, end)
}

// =========================================================================
// GET / — list_attendance
// =========================================================================

/// `GET /v1/crm/attendance` — paginated list scoped to the authenticated
/// user's records. Supports filtering by `employeeId`, `status`, and an
/// inclusive `[dateFrom, dateTo]` window. Sorted by `date` desc to match
/// the TS action.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_attendance(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Attendance>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);

    if let Some(emp) = q.employee_id.as_deref().filter(|s| !s.is_empty()) {
        let emp_oid = oid_from_str(emp)?;
        filter.insert("employeeId", emp_oid);
    }

    if let Some(status) = q.status {
        let bson_status = to_bson_val("status", &status)?;
        filter.insert("status", bson_status);
    }

    // Date window — combine into a single `date: { $gte, $lt }` clause
    // when both are present so we don't emit overlapping filters.
    let mut date_clause = Document::new();
    if let Some(from) = q.date_from {
        date_clause.insert("$gte", bson::DateTime::from_chrono(from));
    }
    if let Some(to) = q.date_to {
        date_clause.insert("$lte", bson::DateTime::from_chrono(to));
    }
    if !date_clause.is_empty() {
        filter.insert("date", date_clause);
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "date": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Attendance>(ATTENDANCE_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.find"))
        })?;
    let rows: Vec<Attendance> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.collect")))?;

    Ok(Json(rows))
}

// =========================================================================
// GET /:attendanceId — get_attendance
// =========================================================================

/// `GET /v1/crm/attendance/:attendanceId` — fetch a single row. Returns
/// 404 if it doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, attendance_id = %attendance_id))]
pub async fn get_attendance(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(attendance_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<Attendance>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let att_oid = oid_from_str(&attendance_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", att_oid);

    let coll = mongo.collection::<Attendance>(ATTENDANCE_COLL);
    let row = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.find_one")))?
        .ok_or_else(|| ApiError::NotFound("attendance".to_owned()))?;

    Ok(Json(row))
}

// =========================================================================
// POST / — create_attendance
// =========================================================================

/// `POST /v1/crm/attendance` — insert a new record.
///
/// Builds an [`Attendance`] from the curated [`CreateAttendanceInput`],
/// stamps `Identity` + `Audit`, persists it, and returns the full
/// document. Attendance has no lineage chain so this is a pure leaf
/// insert.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_attendance(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAttendanceInput>,
) -> Result<Json<Attendance>> {
    if input.employee_id.trim().is_empty() {
        return Err(ApiError::Validation("employeeId is required.".to_owned()));
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
            // Match `crm-leads`: stamp a fresh OID when absent so the legacy
            // single-tenant TS callers keep working during the migration.
            None => ObjectId::new(),
        },
    };
    let employee_oid = oid_from_str(input.employee_id.trim())?;
    let shift_oid = match input.shift_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let approver_oid = match input.approver_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    let attendance = Attendance {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        date: input.date,
        employee_id: employee_oid,
        shift_id: shift_oid,
        punch_in: input.punch_in.clone(),
        punch_out: input.punch_out.clone(),
        breaks: input.breaks.clone(),
        total_hours: input.total_hours,
        overtime_hours: input.overtime_hours,
        status: input.status,
        late_by_minutes: input.late_by_minutes,
        early_out_by_minutes: input.early_out_by_minutes,
        source: input.source.unwrap_or_default(),
        approver_id: approver_oid,
        notes: input.notes.clone(),
    };

    let coll = mongo.collection::<Attendance>(ATTENDANCE_COLL);
    coll.insert_one(&attendance).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.insert_one"))
    })?;

    Ok(Json(attendance))
}

// =========================================================================
// PATCH /:attendanceId — update_attendance
// =========================================================================

/// `PATCH /v1/crm/attendance/:attendanceId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the record
/// doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, attendance_id = %attendance_id))]
pub async fn update_attendance(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(attendance_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdateAttendanceInput>,
) -> Result<Json<Attendance>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let att_oid = oid_from_str(&attendance_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    if let Some(when) = input.date {
        set.insert("date", bson::DateTime::from_chrono(when));
    }
    set_opt_oid(&mut set, "employeeId", input.employee_id.as_ref())?;
    set_opt_oid(&mut set, "shiftId", input.shift_id.as_ref())?;
    set_opt_oid(&mut set, "approverId", input.approver_id.as_ref())?;
    set_opt_str(&mut set, "notes", input.notes.as_ref());

    if let Some(p) = input.punch_in.as_ref() {
        set.insert("punchIn", to_bson_val("punchIn", p)?);
    }
    if let Some(p) = input.punch_out.as_ref() {
        set.insert("punchOut", to_bson_val("punchOut", p)?);
    }
    if let Some(breaks) = input.breaks.as_ref() {
        set.insert("breaks", to_bson_val("breaks", breaks)?);
    }
    if let Some(h) = input.total_hours {
        set.insert("totalHours", h as f64);
    }
    if let Some(h) = input.overtime_hours {
        set.insert("overtimeHours", h as f64);
    }
    if let Some(status) = input.status {
        set.insert("status", to_bson_val("status", &status)?);
    }
    if let Some(m) = input.late_by_minutes {
        set.insert("lateByMinutes", m as i64);
    }
    if let Some(m) = input.early_out_by_minutes {
        set.insert("earlyOutByMinutes", m as i64);
    }
    if let Some(src) = input.source {
        set.insert("source", to_bson_val("source", &src)?);
    }

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", att_oid);

    let coll = mongo.collection::<Document>(ATTENDANCE_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("attendance".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`Attendance`] shape.
    let typed = mongo.collection::<Attendance>(ATTENDANCE_COLL);
    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_attendance.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("attendance".to_owned()))?;

    Ok(Json(row))
}

// =========================================================================
// DELETE /:attendanceId — delete_attendance (hard)
// =========================================================================

/// `DELETE /v1/crm/attendance/:attendanceId` — **soft delete**.
/// Soft deletes the record by setting `archived = true` and stamping
/// `deletedAt`. Attendance is load-bearing for payroll runs and must
/// remain auditable. Fails with 404 if the record doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, attendance_id = %attendance_id))]
pub async fn delete_attendance(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(attendance_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let att_oid = oid_from_str(&attendance_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", att_oid);

    let update = doc! {
        "$set": {
            "archived": true,
            "deletedAt": bson::DateTime::from_chrono(Utc::now()),
            "updatedAt": bson::DateTime::from_chrono(Utc::now()),
            "updatedBy": user_id,
        }
    };

    let coll = mongo.collection::<Document>(ATTENDANCE_COLL);
    let res = coll.update_one(filter, update).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.delete_one"))
    })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("attendance".to_owned()));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

// =========================================================================
// POST /punch-in and /punch-out — shorthand mobile flow
// =========================================================================

/// Direction of a punch — drives which field on the Attendance document
/// gets stamped (`punchIn` vs `punchOut`).
#[derive(Debug, Clone, Copy)]
enum PunchKind {
    In,
    Out,
}

/// Shared implementation for [`punch_in`] / [`punch_out`].
///
/// Behaviour:
/// 1. Resolve "today" as the UTC start-of-day window for `Utc::now()`.
/// 2. Find the (employeeId, today) row owned by the caller.
/// 3. If absent, insert a fresh row with `status = present`.
/// 4. Stamp the `punchIn` (or `punchOut`) field to a new [`PunchPoint`]
///    built from the request, refresh `updatedAt` / `updatedBy`, and
///    return the full document.
async fn punch_impl(
    user: AuthUser,
    mode: ScopeMode,
    mongo: MongoHandle,
    input: PunchInput,
    kind: PunchKind,
) -> Result<Json<Attendance>> {
    if input.employee_id.trim().is_empty() {
        return Err(ApiError::Validation("employeeId is required.".to_owned()));
    }

    let user_id = user_oid(&user)?;
    // In project mode the body's `projectId` IS the tenant scope and is
    // therefore mandatory (4xx when absent); legacy user-mode behaviour
    // is unchanged (scope = JWT subject, minted projectId on insert).
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => p,
        TenantScope::User(_) => match input.project_id.as_deref().filter(|s| !s.is_empty()) {
            Some(s) => oid_from_str(s)?,
            None => ObjectId::new(),
        },
    };
    let employee_oid = oid_from_str(input.employee_id.trim())?;
    let selfie_oid = match input.selfie_file_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    let now = Utc::now();
    let stamp_at = input.at.unwrap_or(now);
    let (day_start, day_end) = day_window_utc(now);

    let punch = PunchPoint {
        at: stamp_at,
        lat: input.lat,
        lng: input.lng,
        ip: input.ip.clone(),
        device: input.device.clone(),
        selfie_file_id: selfie_oid,
    };
    let source = input.source.unwrap_or(AttendanceSource::Mobile);

    // Find today's row for this employee.
    let mut filter = base_ownership_filter(&scope);
    filter.insert("employeeId", employee_oid);
    filter.insert(
        "date",
        doc! {
            "$gte": bson::DateTime::from_chrono(day_start),
            "$lt": bson::DateTime::from_chrono(day_end),
        },
    );

    let typed = mongo.collection::<Attendance>(ATTENDANCE_COLL);
    let existing = typed.find_one(filter.clone()).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.punch.find_one"))
    })?;

    if existing.is_none() {
        // Create a fresh row for today, with the punch already stamped.
        let attendance = Attendance {
            identity: Identity {
                id: ObjectId::new(),
                project_id,
                user_id,
                tenant_id: None,
            },
            audit: Audit::new(Some(user_id)),
            date: day_start,
            employee_id: employee_oid,
            shift_id: None,
            punch_in: matches!(kind, PunchKind::In).then(|| punch.clone()),
            punch_out: matches!(kind, PunchKind::Out).then(|| punch.clone()),
            breaks: Vec::new(),
            total_hours: None,
            overtime_hours: None,
            status: AttendanceStatus::Present,
            late_by_minutes: None,
            early_out_by_minutes: None,
            source,
            approver_id: None,
            notes: None,
        };

        typed.insert_one(&attendance).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.punch.insert_one"))
        })?;

        return Ok(Json(attendance));
    }

    // Row exists — stamp the appropriate punch field. We deliberately
    // OVERWRITE an existing punch so a corrected re-punch (e.g. user
    // tapped twice) replaces the bad value rather than leaving stale
    // data; the audit row keeps the original via `updatedAt` history if
    // the tenant wires up an audit log downstream.
    let key = match kind {
        PunchKind::In => "punchIn",
        PunchKind::Out => "punchOut",
    };
    let punch_bson = to_bson_val(key, &punch)?;
    let source_bson = to_bson_val("source", &source)?;
    let mut set = doc! {
        key: punch_bson,
        "source": source_bson,
        "updatedAt": bson::DateTime::from_chrono(now),
        "updatedBy": user_id,
    };

    // Calculate totalHours if we have both in and out punches.
    let pi_time = match kind {
        PunchKind::In => Some(stamp_at),
        PunchKind::Out => existing
            .as_ref()
            .and_then(|a| a.punch_in.as_ref().map(|p| p.at)),
    };
    let po_time = match kind {
        PunchKind::Out => Some(stamp_at),
        PunchKind::In => existing
            .as_ref()
            .and_then(|a| a.punch_out.as_ref().map(|p| p.at)),
    };

    if let (Some(pi), Some(po)) = (pi_time, po_time) {
        if po > pi {
            let mut duration = po.signed_duration_since(pi);
            if let Some(ref att) = existing {
                for brk in &att.breaks {
                    if let Some(bout) = brk.out {
                        if bout > brk.r#in {
                            duration = duration - bout.signed_duration_since(brk.r#in);
                        }
                    }
                }
            }
            let hours = duration.num_minutes() as f64 / 60.0;
            if hours > 0.0 {
                set.insert("totalHours", hours);
            }
        }
    }

    let docs = mongo.collection::<Document>(ATTENDANCE_COLL);
    docs.update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.punch.update_one"))
        })?;

    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_attendance.punch.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("attendance".to_owned()))?;

    Ok(Json(row))
}

/// `POST /v1/crm/attendance/punch-in` — stamp today's punch-in.
///
/// Mobile-app shorthand: caller sends an `employeeId` (plus optional
/// geo / selfie / `at` overrides) and the server upserts today's
/// attendance row with the `punchIn` field populated. Creates the row
/// with `status = present` and `source = mobile` if it doesn't exist.
#[instrument(skip_all, fields(user_id = %user.user_id, employee_id = %input.employee_id))]
pub async fn punch_in(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<PunchInput>,
) -> Result<Json<Attendance>> {
    punch_impl(user, mode, mongo, input, PunchKind::In).await
}

/// `POST /v1/crm/attendance/punch-out` — stamp today's punch-out.
///
/// Mirror of [`punch_in`]; identical upsert semantics. If no row
/// exists yet, the handler creates one with `punchOut` set but
/// `punchIn = None` — that's a real-world possibility (mobile app
/// crashed before the morning punch) and downstream payroll reports
/// will flag the missing `punchIn` rather than silently fabricating one.
#[instrument(skip_all, fields(user_id = %user.user_id, employee_id = %input.employee_id))]
pub async fn punch_out(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<PunchInput>,
) -> Result<Json<Attendance>> {
    punch_impl(user, mode, mongo, input, PunchKind::Out).await
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    // `Timelike` is only needed in the day-window assertion below; the
    // production helpers use `Datelike`/`TimeZone` (already in scope at
    // module top) so we don't pollute the production import list.
    use chrono::Timelike;

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
        set_opt_str(&mut d, "notes", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "wfh".to_owned();
        set_opt_str(&mut d, "notes", Some(&v));
        assert_eq!(d.get_str("notes").unwrap(), "wfh");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "approverId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn day_window_brackets_now() {
        let now = Utc.with_ymd_and_hms(2026, 5, 7, 14, 30, 0).unwrap();
        let (start, end) = day_window_utc(now);
        assert_eq!(start.hour(), 0);
        assert_eq!(start.minute(), 0);
        assert_eq!(start.day(), 7);
        assert_eq!(end.day(), 8);
        assert_eq!(end - start, chrono::Duration::days(1));
        assert!(start <= now && now < end);
    }

    #[test]
    fn to_bson_val_serializes_status_enum() {
        let v = to_bson_val("status", &AttendanceStatus::HalfDay).unwrap();
        // The enum is `#[serde(rename_all = "snake_case")]` so it
        // serializes to the BSON string "half_day".
        assert_eq!(v.as_str(), Some("half_day"));
    }
}
