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
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use crm_core::{Audit, Identity};
use futures::TryStreamExt;
use hrm_payroll_types::{Holiday, HolidayType};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{CreateHolidayInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdateHolidayInput};

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

/// Materialize the base ownership filter:
/// `{ userId, archived: { $ne: true } }`. Soft-deleted rows are excluded
/// by default.
fn base_ownership_filter(user: ObjectId) -> Document {
    doc! {
        "userId": user,
        "archived": { "$ne": true },
    }
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
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Holiday>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);
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
    State(mongo): State<MongoHandle>,
    Path(holiday_id): Path<String>,
) -> Result<Json<Holiday>> {
    let user_id = user_oid(&user)?;
    let holiday_oid = oid_from_str(&holiday_id)?;

    let mut filter = base_ownership_filter(user_id);
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
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateHolidayInput>,
) -> Result<Json<Holiday>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        None => ObjectId::new(),
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
    State(mongo): State<MongoHandle>,
    Path(holiday_id): Path<String>,
    Json(input): Json<UpdateHolidayInput>,
) -> Result<Json<Holiday>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

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

    let mut filter = base_ownership_filter(user_id);
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
    State(mongo): State<MongoHandle>,
    Path(holiday_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let holiday_oid = oid_from_str(&holiday_id)?;

    let filter = doc! { "_id": holiday_oid, "userId": user_id };

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

    #[test]
    fn base_filter_excludes_archived() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(oid);
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
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
