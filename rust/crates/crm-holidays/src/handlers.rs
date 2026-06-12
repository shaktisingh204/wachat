//! HTTP handlers for the §9.5 Holiday entity.
//!
//! Five handlers:
//!
//! | Method  | Path             | Function              |
//! |---------|------------------|-----------------------|
//! | `GET`   | `/`              | [`list_holidays`]     |
//! | `GET`   | `/:holidayId`    | [`get_holiday`]       |
//! | `POST`  | `/`              | [`create_holiday`]    |
//! | `PATCH` | `/:holidayId`    | [`update_holiday`]    |
//! | `DELETE`| `/:holidayId`    | [`delete_holiday`]    |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/hrm/holidays` (legacy) — `userId == AuthUser.user_id`, the
//!   CRM tenant root from `crm-core::Identity`. Unchanged behaviour.
//! - `/v1/sabcrm/people/holidays` (SabCRM People suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use crm_core::{Audit, Identity, ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use hrm_payroll_types::{Holiday, HolidayType};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateHolidayInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, ScopeQuery, UpdateHolidayInput,
};

/// Mongo collection name.
const HOLIDAYS_COLL: &str = "crm_holidays";

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

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`] (attached as an axum `Extension` by the router
/// constructor):
///
/// - `ScopeMode::User` (legacy mount) — scope by the verified JWT
///   subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/people/holidays`) — scope by the
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
/// are excluded by default.
fn base_ownership_filter(scope: &TenantScope) -> Document {
    let mut f = scope.filter();
    f.insert("archived", doc! { "$ne": true });
    f
}

/// Serialize a [`HolidayType`] to its on-the-wire (lowercase) string so
/// the Mongo `$eq` filter matches the persisted `holidayType` field.
fn holiday_type_str(t: HolidayType) -> &'static str {
    match t {
        HolidayType::National => "national",
        HolidayType::Regional => "regional",
        HolidayType::Religious => "religious",
        HolidayType::Optional => "optional",
        HolidayType::Restricted => "restricted",
    }
}

// =========================================================================
// GET / — list_holidays
// =========================================================================

/// `GET /v1/crm/holidays` — paginated list scoped to the authenticated
/// user's holidays. Optional filters: `year` (calendar year, UTC) and
/// `holidayType`. Sorted by `date` asc so the calendar reads in
/// chronological order.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_holidays(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Holiday>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);
    if let Some(year) = q.year {
        let start = Utc
            .with_ymd_and_hms(year, 1, 1, 0, 0, 0)
            .single()
            .ok_or_else(|| ApiError::BadRequest(format!("invalid year: {year}")))?;
        let end = Utc
            .with_ymd_and_hms(year + 1, 1, 1, 0, 0, 0)
            .single()
            .ok_or_else(|| ApiError::BadRequest(format!("invalid year: {year}")))?;
        filter.insert(
            "date",
            doc! {
                "$gte": bson::DateTime::from_chrono(start),
                "$lt": bson::DateTime::from_chrono(end),
            },
        );
    }
    if let Some(t) = q.holiday_type {
        filter.insert("holidayType", holiday_type_str(t));
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "date": 1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Holiday>(HOLIDAYS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_holidays.find")))?;
    let holidays: Vec<Holiday> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_holidays.collect")))?;

    Ok(Json(holidays))
}

// =========================================================================
// GET /:holidayId — get_holiday
// =========================================================================

/// `GET /v1/crm/holidays/:holidayId` — fetch a single holiday. Returns
/// 404 if it doesn't exist OR isn't owned by the caller (existence is
/// deliberately not leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, holiday_id = %holiday_id))]
pub async fn get_holiday(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(holiday_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<Holiday>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let holiday_oid = oid_from_str(&holiday_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", holiday_oid);

    let coll = mongo.collection::<Holiday>(HOLIDAYS_COLL);
    let holiday = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_holidays.find_one")))?
        .ok_or_else(|| ApiError::NotFound("holiday".to_owned()))?;

    Ok(Json(holiday))
}

// =========================================================================
// POST / — create_holiday
// =========================================================================

/// `POST /v1/crm/holidays` — insert a new holiday.
///
/// Builds a [`Holiday`] from the curated [`CreateHolidayInput`], stamps
/// `Identity` + `Audit`, persists it, and returns the full document.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_holiday(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateHolidayInput>,
) -> Result<Json<Holiday>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }

    let user_id = user_oid(&user)?;
    // In project mode the body's `projectId` IS the tenant scope and is
    // therefore mandatory (4xx when absent); legacy user-mode behaviour
    // is unchanged. The stamped `userId` is always `AuthUser.user_id`.
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => p,
        TenantScope::User(_) => match input.project_id.as_deref().filter(|s| !s.is_empty()) {
            Some(s) => oid_from_str(s)?,
            None => ObjectId::new(),
        },
    };

    let holiday = Holiday {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        date: input.date,
        name: input.name.trim().to_owned(),
        holiday_type: input.holiday_type.unwrap_or_default(),
        recurring: input.recurring.unwrap_or(false),
        applicable_locations: input.applicable_locations.unwrap_or_default(),
        notes: input.notes.clone(),
    };

    let coll = mongo.collection::<Holiday>(HOLIDAYS_COLL);
    coll.insert_one(&holiday).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_holidays.insert_one"))
    })?;

    Ok(Json(holiday))
}

// =========================================================================
// PATCH /:holidayId — update_holiday
// =========================================================================

/// `PATCH /v1/crm/holidays/:holidayId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt` and
/// `updatedBy` are always refreshed. Fails with 404 if the holiday
/// doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, holiday_id = %holiday_id))]
pub async fn update_holiday(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(holiday_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdateHolidayInput>,
) -> Result<Json<Holiday>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let holiday_oid = oid_from_str(&holiday_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    if let Some(when) = input.date {
        set.insert("date", bson::DateTime::from_chrono(when));
    }
    if let Some(name) = input.name.as_ref() {
        set.insert("name", name.as_str());
    }
    if let Some(t) = input.holiday_type {
        set.insert("holidayType", holiday_type_str(t));
    }
    if let Some(r) = input.recurring {
        set.insert("recurring", r);
    }
    if let Some(locs) = input.applicable_locations.as_ref() {
        set.insert(
            "applicableLocations",
            bson::to_bson(locs).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("serialize applicable_locations"))
            })?,
        );
    }
    if let Some(notes) = input.notes.as_ref() {
        set.insert("notes", notes.as_str());
    }

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", holiday_oid);

    let coll = mongo.collection::<Document>(HOLIDAYS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_holidays.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("holiday".to_owned()));
    }

    let typed = mongo.collection::<Holiday>(HOLIDAYS_COLL);
    let holiday = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_holidays.find_one(after-update)"))
        })?
        .ok_or_else(|| ApiError::NotFound("holiday".to_owned()))?;

    Ok(Json(holiday))
}

// =========================================================================
// DELETE /:holidayId — delete_holiday (hard)
// =========================================================================

/// `DELETE /v1/crm/holidays/:holidayId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the holiday doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, holiday_id = %holiday_id))]
pub async fn delete_holiday(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(holiday_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let holiday_oid = oid_from_str(&holiday_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", holiday_oid);

    let coll = mongo.collection::<Document>(HOLIDAYS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_holidays.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("holiday".to_owned()));
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
    fn holiday_type_str_matches_serde_lowercase() {
        // The persisted shape MUST equal the serde rename_all = "lowercase"
        // form so list filters round-trip with the canonical Holiday DTO.
        assert_eq!(holiday_type_str(HolidayType::National), "national");
        assert_eq!(holiday_type_str(HolidayType::Regional), "regional");
        assert_eq!(holiday_type_str(HolidayType::Religious), "religious");
        assert_eq!(holiday_type_str(HolidayType::Optional), "optional");
        assert_eq!(holiday_type_str(HolidayType::Restricted), "restricted");

        // Sanity-check that the serde form really is lowercase — if a
        // future change to HolidayType breaks this, the test catches it.
        let serialized = serde_json::to_value(HolidayType::Regional).unwrap();
        assert_eq!(serialized.as_str(), Some("regional"));
    }
}
