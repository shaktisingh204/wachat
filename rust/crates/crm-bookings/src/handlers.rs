//! HTTP handlers for the §12.12 Booking + BookingResource entities.
//!
//! Ten handlers — five canonical CRUD per entity plus two dedicated
//! lifecycle helpers on Booking:
//!
//! ### `BookingResource`
//!
//! | Method  | Path                  | Function                |
//! |---------|-----------------------|-------------------------|
//! | `GET`   | `/resources`          | [`list_resources`]      |
//! | `GET`   | `/resources/:id`      | [`get_resource`]        |
//! | `POST`  | `/resources`          | [`create_resource`]     |
//! | `PATCH` | `/resources/:id`      | [`update_resource`]     |
//! | `DELETE`| `/resources/:id`      | [`delete_resource`]     |
//!
//! ### `Booking`
//!
//! | Method  | Path                      | Function              |
//! |---------|---------------------------|-----------------------|
//! | `GET`   | `/bookings`               | [`list_bookings`]     |
//! | `GET`   | `/bookings/:id`           | [`get_booking`]       |
//! | `POST`  | `/bookings`               | [`create_booking`]    |
//! | `PATCH` | `/bookings/:id`           | [`update_booking`]    |
//! | `DELETE`| `/bookings/:id`           | [`delete_booking`]    |
//! | `POST`  | `/bookings/:id/check-in`  | [`check_in_booking`]  |
//! | `POST`  | `/bookings/:id/cancel`    | [`cancel_booking`]    |
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
use crm_extras_types::booking::{
    Booking, BookingResource, BookingResourceKind, BookingStatus, PaymentStatus,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateBookingInput, CreateBookingResourceInput, DEFAULT_LIMIT, ListBookingsQuery,
    ListResourcesQuery, MAX_LIMIT, UpdateBookingInput, UpdateBookingResourceInput,
};

/// Mongo collection holding `BookingResource` documents.
const RESOURCES_COLL: &str = "crm_booking_resources";
/// Mongo collection holding `Booking` documents.
const BOOKINGS_COLL: &str = "crm_bookings";

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

/// Materialize the base ownership filter: `{ userId, archived: { $ne: true } }`.
/// Soft-deleted rows (`archived = true`) are excluded by default.
fn base_ownership_filter(user: ObjectId) -> Document {
    doc! {
        "userId": user,
        "archived": { "$ne": true },
    }
}

/// Optional-string update helper. When the input field is `Some`,
/// inserts the value at `key` in `$set`; when `None`, leaves the
/// document untouched (PATCH semantics — absent ≠ `null`).
fn set_opt_str(set: &mut Document, key: &str, val: Option<&String>) {
    if let Some(v) = val {
        set.insert(key, v.as_str());
    }
}

/// Serialize a `BookingResourceKind` to its on-the-wire string form.
fn resource_kind_str(k: BookingResourceKind) -> &'static str {
    match k {
        BookingResourceKind::Room => "room",
        BookingResourceKind::Equipment => "equipment",
        BookingResourceKind::Staff => "staff",
    }
}

/// Serialize a `BookingStatus` to its on-the-wire string form.
fn booking_status_str(s: BookingStatus) -> &'static str {
    match s {
        BookingStatus::Pending => "pending",
        BookingStatus::Confirmed => "confirmed",
        BookingStatus::Cancelled => "cancelled",
        BookingStatus::Completed => "completed",
        BookingStatus::NoShow => "no_show",
    }
}

/// Serialize a `PaymentStatus` to its on-the-wire string form.
fn payment_status_str(p: PaymentStatus) -> &'static str {
    match p {
        PaymentStatus::Unpaid => "unpaid",
        PaymentStatus::Partial => "partial",
        PaymentStatus::Paid => "paid",
        PaymentStatus::Refunded => "refunded",
    }
}

// =========================================================================
// BookingResource — GET / (list)
// =========================================================================

/// `GET /v1/crm/bookings/resources` — paginated list scoped to the
/// authenticated user. `kind` filters exactly; `q` does a
/// case-insensitive substring search on `name`. Sorted by `createdAt`
/// desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_resources(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListResourcesQuery>,
) -> Result<Json<Vec<BookingResource>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);

    if let Some(k) = q.kind {
        filter.insert("kind", resource_kind_str(k));
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![Bson::Document(doc! { "name": regex })]),
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

    let coll = mongo.collection::<BookingResource>(RESOURCES_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_booking_resources.find"))
    })?;
    let rows: Vec<BookingResource> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_booking_resources.collect"))
    })?;

    Ok(Json(rows))
}

// =========================================================================
// BookingResource — GET /:id
// =========================================================================

/// `GET /v1/crm/bookings/resources/:id` — fetch one resource. Returns
/// 404 if the document doesn't exist OR isn't owned by the caller (we
/// collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, resource_id = %res_id))]
pub async fn get_resource(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(res_id): Path<String>,
) -> Result<Json<BookingResource>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&res_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let coll = mongo.collection::<BookingResource>(RESOURCES_COLL);
    let row = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_booking_resources.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("bookingResource".to_owned()))?;

    Ok(Json(row))
}

// =========================================================================
// BookingResource — POST /
// =========================================================================

/// `POST /v1/crm/bookings/resources` — insert a new resource.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_resource(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBookingResourceInput>,
) -> Result<Json<BookingResource>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }
    if input.capacity == 0 {
        return Err(ApiError::Validation("capacity must be >= 1.".to_owned()));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        None => ObjectId::new(),
    };

    let resource = BookingResource {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        kind: input.kind,
        name: input.name.trim().to_owned(),
        capacity: input.capacity,
        hourly_rate: input.hourly_rate,
        currency: input.currency.clone(),
        active: input.active.unwrap_or(true),
    };

    let coll = mongo.collection::<BookingResource>(RESOURCES_COLL);
    coll.insert_one(&resource).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_booking_resources.insert_one"))
    })?;

    Ok(Json(resource))
}

// =========================================================================
// BookingResource — PATCH /:id
// =========================================================================

/// `PATCH /v1/crm/bookings/resources/:id` — partial update.
#[instrument(skip_all, fields(user_id = %user.user_id, resource_id = %res_id))]
pub async fn update_resource(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(res_id): Path<String>,
    Json(input): Json<UpdateBookingResourceInput>,
) -> Result<Json<BookingResource>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&res_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    if let Some(k) = input.kind {
        set.insert("kind", resource_kind_str(k));
    }
    set_opt_str(&mut set, "name", input.name.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    if let Some(cap) = input.capacity {
        set.insert("capacity", cap as i64);
    }
    if let Some(rate) = input.hourly_rate {
        set.insert("hourlyRate", rate);
    }
    if let Some(active) = input.active {
        set.insert("active", active);
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Document>(RESOURCES_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_booking_resources.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("bookingResource".to_owned()));
    }

    let typed = mongo.collection::<BookingResource>(RESOURCES_COLL);
    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_booking_resources.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("bookingResource".to_owned()))?;

    Ok(Json(row))
}

// =========================================================================
// BookingResource — DELETE /:id (soft)
// =========================================================================

/// `DELETE /v1/crm/bookings/resources/:id` — soft delete.
#[instrument(skip_all, fields(user_id = %user.user_id, resource_id = %res_id))]
pub async fn delete_resource(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(res_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&res_id)?;

    let now = bson::DateTime::from_chrono(Utc::now());
    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let update = doc! {
        "$set": {
            "archived": true,
            "deletedAt": now,
            "updatedAt": now,
            "updatedBy": user_id,
        },
    };

    let coll = mongo.collection::<Document>(RESOURCES_COLL);
    let res = coll.update_one(filter, update).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_booking_resources.soft_delete"))
    })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("bookingResource".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "archived": true })))
}

// =========================================================================
// Booking — GET / (list)
// =========================================================================

/// `GET /v1/crm/bookings/bookings` — paginated list scoped to the
/// authenticated user. `resourceId`, `customerId`, and `status` filter
/// exactly; `dateFrom` / `dateTo` bracket `slotStart` (inclusive lower,
/// exclusive upper). Sorted by `slotStart` ascending so the upcoming
/// page is the natural "today" view.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_bookings(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListBookingsQuery>,
) -> Result<Json<Vec<Booking>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);

    if let Some(rid) = q.resource_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("resourceId", oid_from_str(rid)?);
    }
    if let Some(cid) = q.customer_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("customerId", oid_from_str(cid)?);
    }
    if let Some(s) = q.status {
        filter.insert("status", booking_status_str(s));
    }

    let mut slot_range = Document::new();
    if let Some(from) = q.date_from {
        slot_range.insert("$gte", bson::DateTime::from_chrono(from));
    }
    if let Some(to) = q.date_to {
        slot_range.insert("$lt", bson::DateTime::from_chrono(to));
    }
    if !slot_range.is_empty() {
        filter.insert("slotStart", slot_range);
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "slotStart": 1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Booking>(BOOKINGS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.find")))?;
    let rows: Vec<Booking> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.collect")))?;

    Ok(Json(rows))
}

// =========================================================================
// Booking — GET /:id
// =========================================================================

/// `GET /v1/crm/bookings/bookings/:id` — fetch one booking.
#[instrument(skip_all, fields(user_id = %user.user_id, booking_id = %booking_id))]
pub async fn get_booking(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(booking_id): Path<String>,
) -> Result<Json<Booking>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&booking_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Booking>(BOOKINGS_COLL);
    let row = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.find_one")))?
        .ok_or_else(|| ApiError::NotFound("booking".to_owned()))?;

    Ok(Json(row))
}

// =========================================================================
// Booking — POST /
// =========================================================================

/// `POST /v1/crm/bookings/bookings` — insert a new booking.
///
/// Builds a [`Booking`] from the curated [`CreateBookingInput`], stamps
/// `Identity` + `Audit`, and seeds server-managed fields:
///
/// - `status` defaults to [`BookingStatus::Pending`] — the lifecycle
///   helpers (`/check-in`, `/cancel`) are the canonical transitions.
/// - `reminders[]` starts empty; the reminder scheduler populates it
///   out-of-band.
/// - `noShow` starts false.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_booking(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBookingInput>,
) -> Result<Json<Booking>> {
    if input.resource_id.trim().is_empty() {
        return Err(ApiError::Validation("resourceId is required.".to_owned()));
    }
    if input.customer_id.trim().is_empty() {
        return Err(ApiError::Validation("customerId is required.".to_owned()));
    }
    if input.slot_end <= input.slot_start {
        return Err(ApiError::Validation(
            "slotEnd must be strictly after slotStart.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        None => ObjectId::new(),
    };
    let resource_oid = oid_from_str(&input.resource_id)?;
    let customer_oid = oid_from_str(&input.customer_id)?;

    let booking = Booking {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        resource_id: resource_oid,
        service: input.service.clone(),
        customer_id: customer_oid,
        slot_start: input.slot_start,
        slot_end: input.slot_end,
        recurring_rule: input.recurring_rule.clone(),
        capacity_used: input.capacity_used.unwrap_or(1),
        payment_status: input.payment_status.unwrap_or_default(),
        reminders: Vec::new(),
        cancellation_policy: input.cancellation_policy.clone(),
        no_show: false,
        status: BookingStatus::Pending,
        notes: input.notes.clone(),
    };

    let coll = mongo.collection::<Booking>(BOOKINGS_COLL);
    coll.insert_one(&booking).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.insert_one"))
    })?;

    Ok(Json(booking))
}

// =========================================================================
// Booking — PATCH /:id
// =========================================================================

/// `PATCH /v1/crm/bookings/bookings/:id` — partial update.
///
/// Lifecycle transitions (`status`, `noShow`) are NOT editable here —
/// they belong to dedicated endpoints (`POST /:id/check-in`,
/// `POST /:id/cancel`). `reminders[]` overwrite is permitted because
/// the scheduler may need to re-seed the array out-of-band.
#[instrument(skip_all, fields(user_id = %user.user_id, booking_id = %booking_id))]
pub async fn update_booking(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(booking_id): Path<String>,
    Json(input): Json<UpdateBookingInput>,
) -> Result<Json<Booking>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }
    if let (Some(start), Some(end)) = (input.slot_start, input.slot_end) {
        if end <= start {
            return Err(ApiError::Validation(
                "slotEnd must be strictly after slotStart.".to_owned(),
            ));
        }
    }

    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&booking_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    if let Some(rid) = input.resource_id.as_deref().filter(|s| !s.is_empty()) {
        set.insert("resourceId", oid_from_str(rid)?);
    }
    if let Some(cid) = input.customer_id.as_deref().filter(|s| !s.is_empty()) {
        set.insert("customerId", oid_from_str(cid)?);
    }
    set_opt_str(&mut set, "service", input.service.as_ref());
    set_opt_str(&mut set, "recurringRule", input.recurring_rule.as_ref());
    set_opt_str(
        &mut set,
        "cancellationPolicy",
        input.cancellation_policy.as_ref(),
    );
    set_opt_str(&mut set, "notes", input.notes.as_ref());
    if let Some(when) = input.slot_start {
        set.insert("slotStart", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.slot_end {
        set.insert("slotEnd", bson::DateTime::from_chrono(when));
    }
    if let Some(cap) = input.capacity_used {
        set.insert("capacityUsed", cap as i64);
    }
    if let Some(p) = input.payment_status {
        set.insert("paymentStatus", payment_status_str(p));
    }
    if let Some(reminders) = input.reminders.as_ref() {
        let arr: Vec<Bson> = reminders
            .iter()
            .map(|r| {
                Bson::Document(doc! {
                    "at": bson::DateTime::from_chrono(r.at),
                    "channel": &r.channel,
                    "sent": r.sent,
                })
            })
            .collect();
        set.insert("reminders", Bson::Array(arr));
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Document>(BOOKINGS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("booking".to_owned()));
    }

    let typed = mongo.collection::<Booking>(BOOKINGS_COLL);
    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.find_one(after-update)"))
        })?
        .ok_or_else(|| ApiError::NotFound("booking".to_owned()))?;

    Ok(Json(row))
}

// =========================================================================
// Booking — DELETE /:id (hard)
// =========================================================================

/// `DELETE /v1/crm/bookings/bookings/:id` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the booking doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, booking_id = %booking_id))]
pub async fn delete_booking(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(booking_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&booking_id)?;

    let filter = doc! { "_id": oid, "userId": user_id };

    let coll = mongo.collection::<Document>(BOOKINGS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("booking".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

// =========================================================================
// Booking — POST /:id/check-in
// =========================================================================

/// `POST /v1/crm/bookings/bookings/:id/check-in` — mark the slot as
/// consumed.
///
/// Flips `status` to [`BookingStatus::Completed`] and refreshes
/// `updatedAt` / `updatedBy`. Used when the customer actually shows up;
/// the resource's effective utilisation reports filter on
/// `status == "completed"` so the check-in moment is what flips the row
/// from "scheduled" to "consumed".
///
/// The handler does NOT guard against re-checking-in an already-
/// completed booking — that's an idempotent no-op from the caller's
/// perspective and `updatedAt` is naturally refreshed each time.
///
/// Fails with 404 if the booking doesn't exist OR isn't owned by the
/// caller.
#[instrument(skip_all, fields(user_id = %user.user_id, booking_id = %booking_id))]
pub async fn check_in_booking(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(booking_id): Path<String>,
) -> Result<Json<Booking>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&booking_id)?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let update = doc! {
        "$set": {
            "status": booking_status_str(BookingStatus::Completed),
            "noShow": false,
            "updatedAt": now_bson,
            "updatedBy": user_id,
        },
    };

    let coll = mongo.collection::<Document>(BOOKINGS_COLL);
    let res = coll
        .update_one(filter.clone(), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.check_in")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("booking".to_owned()));
    }

    let typed = mongo.collection::<Booking>(BOOKINGS_COLL);
    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_bookings.find_one(after-check-in)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("booking".to_owned()))?;

    Ok(Json(row))
}

// =========================================================================
// Booking — POST /:id/cancel
// =========================================================================

/// `POST /v1/crm/bookings/bookings/:id/cancel` — release the slot.
///
/// Flips `status` to [`BookingStatus::Cancelled`] and refreshes
/// `updatedAt` / `updatedBy`. The slot is freed for re-booking; the
/// row stays in the collection so the cancellation policy / dunning
/// audits remain accurate.
///
/// Idempotent — re-cancelling an already-cancelled booking is a no-op
/// from the caller's perspective.
///
/// Fails with 404 if the booking doesn't exist OR isn't owned by the
/// caller.
#[instrument(skip_all, fields(user_id = %user.user_id, booking_id = %booking_id))]
pub async fn cancel_booking(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(booking_id): Path<String>,
) -> Result<Json<Booking>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&booking_id)?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let update = doc! {
        "$set": {
            "status": booking_status_str(BookingStatus::Cancelled),
            "updatedAt": now_bson,
            "updatedBy": user_id,
        },
    };

    let coll = mongo.collection::<Document>(BOOKINGS_COLL);
    let res = coll
        .update_one(filter.clone(), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.cancel")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("booking".to_owned()));
    }

    let typed = mongo.collection::<Booking>(BOOKINGS_COLL);
    let row = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.find_one(after-cancel)"))
        })?
        .ok_or_else(|| ApiError::NotFound("booking".to_owned()))?;

    Ok(Json(row))
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
    fn resource_kind_serializes_lowercase() {
        assert_eq!(resource_kind_str(BookingResourceKind::Room), "room");
        assert_eq!(
            resource_kind_str(BookingResourceKind::Equipment),
            "equipment"
        );
        assert_eq!(resource_kind_str(BookingResourceKind::Staff), "staff");
    }

    #[test]
    fn booking_status_serializes_with_snake_case_for_multi_word() {
        assert_eq!(booking_status_str(BookingStatus::Pending), "pending");
        assert_eq!(booking_status_str(BookingStatus::Completed), "completed");
        assert_eq!(booking_status_str(BookingStatus::Cancelled), "cancelled");
        assert_eq!(booking_status_str(BookingStatus::NoShow), "no_show");
    }

    #[test]
    fn payment_status_serializes_lowercase() {
        assert_eq!(payment_status_str(PaymentStatus::Unpaid), "unpaid");
        assert_eq!(payment_status_str(PaymentStatus::Partial), "partial");
        assert_eq!(payment_status_str(PaymentStatus::Paid), "paid");
        assert_eq!(payment_status_str(PaymentStatus::Refunded), "refunded");
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
        let v = "Conference Room A".to_owned();
        set_opt_str(&mut d, "name", Some(&v));
        assert_eq!(d.get_str("name").unwrap(), "Conference Room A");
    }
}
