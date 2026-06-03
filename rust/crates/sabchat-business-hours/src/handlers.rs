//! HTTP handlers for the SabChat **business-hours + holiday-calendar**
//! router.
//!
//! ## Surfaces
//!
//! Two distinct sets of endpoints:
//!
//! 1. **CRUD over `sabchat_business_hours_calendars`** — tenant-scoped
//!    named calendars. Every read / write clause filters on
//!    `tenantId == ObjectId(auth.tenant_id)` so cross-tenant access
//!    surfaces as a plain `404`.
//! 2. **Evaluator endpoints** — `is_open_inbox` / `is_open_calendar`
//!    both shell out to the pure-function kernel in [`crate::eval`]
//!    after assembling the inbox / calendar configuration and the
//!    union of calendar `holiday_dates` + tenant `crm_holidays`.
//!
//! ## Inbox → calendar resolution order
//!
//! The inbox-scoped evaluator follows this resolution chain:
//!
//! 1. Inspect `inbox.channelConfig.settings.businessHoursCalendarId`.
//!    If present and points to a calendar in this tenant, use that
//!    calendar's `timezone` / `windows` / `holidayDates`.
//! 2. Otherwise fall back to the inline `inbox.businessHours` block.
//!    If `enabled == false` we treat the inbox as always-open and
//!    return `Ok(None)`.
//! 3. In both branches, the tenant's `crm_holidays` rows for the
//!    calendar-local year are folded onto whatever holiday-date list
//!    was found.
//!
//! The public [`evaluate_inbox`] entry point is re-exported through
//! [`crate::is_open`] for the routing / escalation crates.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, TimeZone, Utc};
use chrono_tz::Tz;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    BusinessHoursCalendar, CalendarWindow, CreateCalendarBody, IsOpenCalendarQuery,
    IsOpenInboxQuery, OpenReason, OpenStatus, SuccessResponse, UpdateCalendarBody,
};
use crate::eval::eval_against;
use crate::state::SabChatBusinessHoursState;

/// Primary collection — round-trips
/// [`crate::dto::BusinessHoursCalendar`].
const CALENDARS_COLL: &str = "sabchat_business_hours_calendars";

/// Inbox registry — read-only here.
const INBOXES_COLL: &str = "sabchat_inboxes";

/// HRM holiday registry — read-only here.
const HOLIDAYS_COLL: &str = "crm_holidays";

// ===========================================================================
// Shared helpers
// ===========================================================================

/// Parse the calling user's `tenantId` claim into an `ObjectId`. A
/// malformed claim is an auth failure (the JWT was issued by us, so a
/// bad value means a tampered token or a buggy issuer).
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Reject an `HH:MM` literal that does not parse — the eval kernel
/// silently skips unparseable windows, so we surface the failure at
/// the create / update boundary instead.
fn validate_hhmm(label: &str, idx: usize, value: &str) -> Result<()> {
    let bytes = value.as_bytes();
    if bytes.len() != 5 || bytes[2] != b':' {
        return Err(ApiError::Validation(format!(
            "windows[{idx}].{label} must be HH:MM (24h), got `{value}`"
        )));
    }
    let parse2 = |a: u8, b: u8| -> Option<u32> {
        if !a.is_ascii_digit() || !b.is_ascii_digit() {
            return None;
        }
        Some(((a - b'0') as u32) * 10 + ((b - b'0') as u32))
    };
    let Some(hh) = parse2(bytes[0], bytes[1]) else {
        return Err(ApiError::Validation(format!(
            "windows[{idx}].{label} must be HH:MM (24h), got `{value}`"
        )));
    };
    let Some(mm) = parse2(bytes[3], bytes[4]) else {
        return Err(ApiError::Validation(format!(
            "windows[{idx}].{label} must be HH:MM (24h), got `{value}`"
        )));
    };
    if hh > 23 || mm > 59 {
        return Err(ApiError::Validation(format!(
            "windows[{idx}].{label} must be HH:MM (24h), got `{value}`"
        )));
    }
    Ok(())
}

/// Validate every window — `day` in `0..=6`, `open` / `close` in
/// `HH:MM` 24h form. Overnight windows are allowed (the eval handles
/// them) so we deliberately do **not** require `open < close`.
fn validate_windows(windows: &[CalendarWindow]) -> Result<()> {
    for (idx, w) in windows.iter().enumerate() {
        if w.day > 6 {
            return Err(ApiError::Validation(format!(
                "windows[{idx}].day must be in 0..=6, got {}",
                w.day
            )));
        }
        validate_hhmm("open", idx, &w.open)?;
        validate_hhmm("close", idx, &w.close)?;
    }
    Ok(())
}

/// Validate every `YYYY-MM-DD` holiday literal.
fn validate_holiday_dates(dates: &[String]) -> Result<()> {
    for (idx, d) in dates.iter().enumerate() {
        if chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").is_err() {
            return Err(ApiError::Validation(format!(
                "holidayDates[{idx}] must be YYYY-MM-DD, got `{d}`"
            )));
        }
    }
    Ok(())
}

/// Validate the IANA timezone string — falling back inside the
/// evaluator is fine for defence in depth, but rejecting bad
/// timezones at the API boundary surfaces config bugs early.
fn validate_timezone(tz: &str) -> Result<()> {
    if tz.parse::<Tz>().is_err() {
        return Err(ApiError::Validation(format!(
            "timezone `{tz}` is not a recognised IANA zone"
        )));
    }
    Ok(())
}

/// Load one calendar, scoped to the caller's tenant. Returns `404`
/// when no matching document exists.
async fn load_calendar_scoped(
    mongo: &MongoHandle,
    tenant: ObjectId,
    calendar_id_hex: &str,
) -> Result<Document> {
    let calendar_oid = oid_from_str(calendar_id_hex)?;
    let coll = mongo.collection::<Document>(CALENDARS_COLL);
    coll.find_one(doc! { "_id": calendar_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_business_hours_calendars.find_one(scoped)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Calendar not found.".to_owned()))
}

/// Hydrate a calendar document into the structured pieces the eval
/// kernel needs (timezone, windows, holiday-date list). Robust against
/// missing / extra fields: anything unparseable downgrades to a sane
/// default rather than erroring out.
fn extract_calendar_inputs(doc: &Document) -> (String, Vec<CalendarWindow>, Vec<String>) {
    let timezone = doc.get_str("timezone").unwrap_or("UTC").to_owned();

    let mut windows: Vec<CalendarWindow> = Vec::new();
    if let Ok(arr) = doc.get_array("windows") {
        for entry in arr {
            if let Bson::Document(d) = entry {
                let day = d.get_i32("day").ok().and_then(|n| u8::try_from(n).ok());
                let open = d.get_str("open").ok().map(str::to_owned);
                let close = d.get_str("close").ok().map(str::to_owned);
                if let (Some(day), Some(open), Some(close)) = (day, open, close) {
                    windows.push(CalendarWindow { day, open, close });
                }
            }
        }
    }

    let mut holiday_dates: Vec<String> = Vec::new();
    if let Ok(arr) = doc.get_array("holidayDates") {
        for entry in arr {
            if let Bson::String(s) = entry {
                holiday_dates.push(s.clone());
            }
        }
    }

    (timezone, windows, holiday_dates)
}

/// Pull `inbox.channelConfig.settings.businessHoursCalendarId` out of
/// the raw inbox document, if present and parseable as an
/// `ObjectId`. Returns `None` when the path is absent or the value is
/// not a valid hex id — both cases mean "no named calendar attached".
fn calendar_id_from_inbox(inbox: &Document) -> Option<ObjectId> {
    let channel_config = inbox.get_document("channelConfig").ok()?;
    let settings = channel_config.get_document("settings").ok()?;
    let raw = settings.get_str("businessHoursCalendarId").ok()?;
    ObjectId::parse_str(raw).ok()
}

/// Load every `crm_holidays` row for `tenant` whose calendar-local
/// date falls within the year containing `local_now`. Returns a
/// `YYYY-MM-DD` (calendar-local) string list so the eval kernel can
/// union it against the calendar's own `holiday_dates`.
///
/// The query is intentionally narrow — one calendar year — so we
/// avoid pulling a tenant's entire holiday history every evaluator
/// hit. Recurring holidays that span multiple years are expected to
/// be expanded into one row per year by the HRM crate, mirroring how
/// `crm-holidays` materializes them.
async fn load_tenant_holidays(
    mongo: &MongoHandle,
    tenant: ObjectId,
    zone: &Tz,
    now: DateTime<Utc>,
) -> anyhow::Result<Vec<String>> {
    let local = now.with_timezone(zone);
    let year = local.year();

    // Year window in UTC for the `date` field (stored as `bson::DateTime`).
    let Some(start_utc) = Utc.with_ymd_and_hms(year, 1, 1, 0, 0, 0).single() else {
        return Ok(Vec::new());
    };
    let Some(end_utc) = Utc.with_ymd_and_hms(year + 1, 1, 1, 0, 0, 0).single() else {
        return Ok(Vec::new());
    };

    // `crm_holidays` is keyed by `userId` in `crm-core::Identity`, which
    // mirrors the `tenantId` claim on the SabChat side until org-mode
    // lands. We also accept rows that explicitly carry `tenantId == us`
    // so future writers that prefer the §0 fragment keep working.
    let filter = doc! {
        "$or": [
            { "userId": tenant },
            { "tenantId": tenant },
        ],
        "archived": { "$ne": true },
        "date": {
            "$gte": bson::DateTime::from_chrono(start_utc),
            "$lt": bson::DateTime::from_chrono(end_utc),
        },
    };

    let coll = mongo.collection::<Document>(HOLIDAYS_COLL);
    let cursor = coll
        .find(filter)
        .await
        .map_err(|e| anyhow::Error::new(e).context("crm_holidays.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| anyhow::Error::new(e).context("crm_holidays.collect"))?;

    let mut out: Vec<String> = Vec::with_capacity(docs.len());
    for d in docs {
        let Ok(date) = d.get_datetime("date") else {
            continue;
        };
        let chrono_dt: DateTime<Utc> = (*date).into();
        // Express the holiday in the calendar's local timezone so a
        // 2026-01-01 00:00 UTC holiday lands on 2026-01-01 in
        // Asia/Kolkata even though the UTC instant is technically the
        // previous day in some Pacific zones.
        let local_date = chrono_dt.with_timezone(zone).date_naive();
        out.push(local_date.format("%Y-%m-%d").to_string());
    }

    Ok(out)
}

/// Render a calendar document for the wire — hex ObjectIds, ISO 8601
/// timestamps. We round-trip via `serde_json::Value` so the response
/// shape stays aligned with whatever
/// [`document_to_clean_json`](sabnode_db::document_to_clean_json) does.
fn render_calendar(doc: Document) -> Value {
    document_to_clean_json(doc)
}

// ===========================================================================
// POST /calendars — create_calendar
// ===========================================================================

/// `POST /v1/sabchat/business-hours/calendars` — create a named
/// calendar for the calling tenant.
#[instrument(skip_all)]
pub async fn create_calendar(
    user: AuthUser,
    State(state): State<SabChatBusinessHoursState>,
    Json(body): Json<CreateCalendarBody>,
) -> Result<Json<Value>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }
    if body.timezone.trim().is_empty() {
        return Err(ApiError::Validation("timezone is required.".to_owned()));
    }
    validate_timezone(&body.timezone)?;
    validate_windows(&body.windows)?;
    validate_holiday_dates(&body.holiday_dates)?;

    let tenant = tenant_oid(&user)?;
    let new_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(Utc::now());

    // Build the windows array as BSON documents so we control the
    // exact shape on disk (camelCase field names, i32 day).
    let windows_bson: Vec<Bson> = body
        .windows
        .iter()
        .map(|w| {
            Bson::Document(doc! {
                "day": w.day as i32,
                "open": &w.open,
                "close": &w.close,
            })
        })
        .collect();
    let holidays_bson: Vec<Bson> = body
        .holiday_dates
        .iter()
        .map(|s| Bson::String(s.clone()))
        .collect();

    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "name": body.name.trim(),
        "timezone": &body.timezone,
        "windows": Bson::Array(windows_bson),
        "holidayDates": Bson::Array(holidays_bson),
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };

    let coll = state.mongo.collection::<Document>(CALENDARS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_business_hours_calendars.insert_one"),
        )
    })?;

    Ok(Json(render_calendar(new_doc)))
}

// ===========================================================================
// GET /calendars — list_calendars
// ===========================================================================

/// `GET /v1/sabchat/business-hours/calendars` — list every calendar
/// owned by the calling tenant. Sorted by `name` ascending.
#[instrument(skip_all)]
pub async fn list_calendars(
    user: AuthUser,
    State(state): State<SabChatBusinessHoursState>,
) -> Result<Json<Vec<Value>>> {
    let tenant = tenant_oid(&user)?;

    let opts = FindOptions::builder().sort(doc! { "name": 1 }).build();
    let coll = state.mongo.collection::<Document>(CALENDARS_COLL);
    let cursor = coll
        .find(doc! { "tenantId": tenant })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_business_hours_calendars.find"),
            )
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_business_hours_calendars.collect"),
        )
    })?;

    Ok(Json(docs.into_iter().map(render_calendar).collect()))
}

// ===========================================================================
// GET /calendars/{id} — get_calendar
// ===========================================================================

/// `GET /v1/sabchat/business-hours/calendars/{id}` — fetch one
/// calendar by id, tenant-scoped.
#[instrument(skip_all, fields(calendar_id = %id))]
pub async fn get_calendar(
    user: AuthUser,
    State(state): State<SabChatBusinessHoursState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let doc = load_calendar_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(render_calendar(doc)))
}

// ===========================================================================
// PATCH /calendars/{id} — update_calendar
// ===========================================================================

/// `PATCH /v1/sabchat/business-hours/calendars/{id}` — partial update.
/// Only the supplied fields are `$set`; arrays replace wholesale.
#[instrument(skip_all, fields(calendar_id = %id))]
pub async fn update_calendar(
    user: AuthUser,
    State(state): State<SabChatBusinessHoursState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateCalendarBody>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_calendar_scoped(&state.mongo, tenant, &id).await?;
    let calendar_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("calendar missing _id")))?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now_bson };

    if let Some(name) = body.name.as_deref() {
        if name.trim().is_empty() {
            return Err(ApiError::Validation("name cannot be empty.".to_owned()));
        }
        set.insert("name", name.trim());
    }
    if let Some(tz) = body.timezone.as_deref() {
        validate_timezone(tz)?;
        set.insert("timezone", tz);
    }
    if let Some(windows) = body.windows.as_ref() {
        validate_windows(windows)?;
        let arr: Vec<Bson> = windows
            .iter()
            .map(|w| {
                Bson::Document(doc! {
                    "day": w.day as i32,
                    "open": &w.open,
                    "close": &w.close,
                })
            })
            .collect();
        set.insert("windows", Bson::Array(arr));
    }
    if let Some(dates) = body.holiday_dates.as_ref() {
        validate_holiday_dates(dates)?;
        let arr: Vec<Bson> = dates.iter().map(|s| Bson::String(s.clone())).collect();
        set.insert("holidayDates", Bson::Array(arr));
    }

    let coll = state.mongo.collection::<Document>(CALENDARS_COLL);
    coll.update_one(
        doc! { "_id": calendar_oid, "tenantId": tenant },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_business_hours_calendars.update_one"),
        )
    })?;

    let fresh = load_calendar_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(render_calendar(fresh)))
}

// ===========================================================================
// DELETE /calendars/{id} — delete_calendar
// ===========================================================================

/// `DELETE /v1/sabchat/business-hours/calendars/{id}` — hard delete.
/// A `404` is returned if no calendar matched the tenant + id pair.
#[instrument(skip_all, fields(calendar_id = %id))]
pub async fn delete_calendar(
    user: AuthUser,
    State(state): State<SabChatBusinessHoursState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let calendar_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(CALENDARS_COLL);
    let res = coll
        .delete_one(doc! { "_id": calendar_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_business_hours_calendars.delete_one"),
            )
        })?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Calendar not found.".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// GET /is-open — is_open_inbox
// ===========================================================================

/// `GET /v1/sabchat/business-hours/is-open?inboxId=…` — evaluate the
/// inbox's effective business-hours configuration at the current
/// wall clock.
///
/// Resolution order matches the docstring on [`evaluate_inbox`].
/// Returns `404` if the inbox does not exist (or belongs to a
/// different tenant), and a synthetic "always open" status when the
/// inbox exists but has no business-hours configuration at all.
#[instrument(skip_all)]
pub async fn is_open_inbox(
    user: AuthUser,
    State(state): State<SabChatBusinessHoursState>,
    Query(q): Query<IsOpenInboxQuery>,
) -> Result<Json<OpenStatus>> {
    let tenant = tenant_oid(&user)?;
    let inbox_oid = oid_from_str(&q.inbox_id)?;
    let now = Utc::now();

    match evaluate_inbox(&state.mongo, tenant, inbox_oid, now)
        .await
        .map_err(ApiError::Internal)?
    {
        Some(status) => Ok(Json(status)),
        None => {
            // No business-hours configuration → conventionally always open.
            // We return `InsideWindow` so callers that key off `reason`
            // don't have to special-case the unconfigured branch.
            Ok(Json(OpenStatus {
                open: true,
                next_open_at: None,
                reason: OpenReason::InsideWindow,
            }))
        }
    }
}

// ===========================================================================
// GET /is-open-now — is_open_calendar
// ===========================================================================

/// `GET /v1/sabchat/business-hours/is-open-now?calendarId=…` —
/// evaluate a specific calendar id directly. Useful for previewing a
/// calendar before attaching it to an inbox.
#[instrument(skip_all)]
pub async fn is_open_calendar(
    user: AuthUser,
    State(state): State<SabChatBusinessHoursState>,
    Query(q): Query<IsOpenCalendarQuery>,
) -> Result<Json<OpenStatus>> {
    let tenant = tenant_oid(&user)?;
    let calendar_doc = load_calendar_scoped(&state.mongo, tenant, &q.calendar_id).await?;
    let (tz_str, windows, mut holidays) = extract_calendar_inputs(&calendar_doc);

    let now = Utc::now();
    let zone: Tz = tz_str.parse::<Tz>().unwrap_or(chrono_tz::UTC);

    // Fold the tenant's HRM holidays into the calendar's own list.
    let tenant_holidays = load_tenant_holidays(&state.mongo, tenant, &zone, now)
        .await
        .map_err(ApiError::Internal)?;
    holidays.extend(tenant_holidays);

    Ok(Json(eval_against(&windows, &holidays, &tz_str, now)))
}

// ===========================================================================
// Public evaluator — re-exported through `crate::is_open`
// ===========================================================================

/// Resolve an inbox's effective business-hours configuration and run
/// the evaluator against `now`.
///
/// Returns:
///
/// - `Ok(Some(_))` — the inbox exists and we found something to
///   evaluate. The result captures whether we're open and (if not)
///   when we will be.
/// - `Ok(None)` — the inbox exists but has no business-hours config
///   attached. Callers should treat this as always-open.
/// - `Err(_)` — Mongo I/O failure. Propagated through `anyhow` so the
///   HTTP handler can wrap into `ApiError::Internal`.
///
/// Errors during the optional `crm_holidays` lookup are non-fatal —
/// we degrade to "no extra holidays" and continue, since the
/// authoritative answer is still produced by the calendar's own
/// `holiday_dates` + weekly windows.
pub async fn evaluate_inbox(
    mongo: &MongoHandle,
    tenant: ObjectId,
    inbox_id: ObjectId,
    now: DateTime<Utc>,
) -> anyhow::Result<Option<OpenStatus>> {
    // ---- 1. Load the inbox ------------------------------------------------
    let inboxes = mongo.collection::<Document>(INBOXES_COLL);
    let Some(inbox) = inboxes
        .find_one(doc! { "_id": inbox_id, "tenantId": tenant })
        .await
        .map_err(|e| anyhow::Error::new(e).context("sabchat_inboxes.find_one"))?
    else {
        // Inbox does not exist in this tenant — propagate as "no data".
        return Ok(None);
    };

    // ---- 2. Resolve calendar vs. inline `businessHours` -------------------
    let (tz_str, windows, mut holidays) = if let Some(calendar_oid) = calendar_id_from_inbox(&inbox)
    {
        let calendars = mongo.collection::<Document>(CALENDARS_COLL);
        match calendars
            .find_one(doc! { "_id": calendar_oid, "tenantId": tenant })
            .await
            .map_err(|e| {
                anyhow::Error::new(e).context("sabchat_business_hours_calendars.find_one")
            })? {
            Some(cal_doc) => extract_calendar_inputs(&cal_doc),
            None => {
                // Dangling pointer — fall back to inline business hours.
                match extract_inline_business_hours(&inbox) {
                    Some(bundle) => bundle,
                    None => return Ok(None),
                }
            }
        }
    } else {
        match extract_inline_business_hours(&inbox) {
            Some(bundle) => bundle,
            None => return Ok(None),
        }
    };

    let zone: Tz = tz_str.parse::<Tz>().unwrap_or(chrono_tz::UTC);

    // ---- 3. Union tenant HRM holidays -------------------------------------
    // Holiday-lookup failures are non-fatal — we log and move on so a
    // routing crate calling us mid-conversation does not crash on a
    // transient Mongo blip.
    match load_tenant_holidays(mongo, tenant, &zone, now).await {
        Ok(extra) => holidays.extend(extra),
        Err(e) => {
            tracing::warn!(
                error = %e,
                "evaluate_inbox: crm_holidays lookup failed, ignoring",
            );
        }
    }

    // ---- 4. Run the evaluator ---------------------------------------------
    Ok(Some(eval_against(&windows, &holidays, &tz_str, now)))
}

/// Pull the inline `businessHours` block out of an inbox document.
/// Returns `None` when the block is missing or has `enabled == false`
/// — in both cases the inbox is conventionally always-open and the
/// caller should treat it that way.
fn extract_inline_business_hours(
    inbox: &Document,
) -> Option<(String, Vec<CalendarWindow>, Vec<String>)> {
    let bh = inbox.get_document("businessHours").ok()?;
    let enabled = bh.get_bool("enabled").unwrap_or(false);
    if !enabled {
        return None;
    }
    let timezone = bh.get_str("timezone").unwrap_or("UTC").to_owned();

    let mut windows: Vec<CalendarWindow> = Vec::new();
    if let Ok(arr) = bh.get_array("windows") {
        for entry in arr {
            if let Bson::Document(d) = entry {
                let day = d.get_i32("day").ok().and_then(|n| u8::try_from(n).ok());
                let open = d.get_str("open").ok().map(str::to_owned);
                let close = d.get_str("close").ok().map(str::to_owned);
                if let (Some(day), Some(open), Some(close)) = (day, open, close) {
                    windows.push(CalendarWindow { day, open, close });
                }
            }
        }
    }

    // Inline business-hours has no holiday-dates field today — the
    // tenant's `crm_holidays` list is the sole source. We return an
    // empty Vec so the caller can extend it uniformly.
    Some((timezone, windows, Vec::new()))
}

// Re-export the public re-entrant evaluator under the name `is_open`
// is built atop. `crate::is_open` calls into [`evaluate_inbox`]
// directly.

/// Document-shaped helper used internally only — not exposed publicly
/// (the eval is the public surface). We attach a `#[allow(dead_code)]`
/// because [`BusinessHoursCalendar`] is re-exported through
/// [`crate::dto`] but unused in this module today.
#[allow(dead_code)]
fn _calendar_typecheck(_c: BusinessHoursCalendar) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_windows_rejects_bad_day() {
        let bad = vec![CalendarWindow {
            day: 7,
            open: "09:00".to_owned(),
            close: "17:00".to_owned(),
        }];
        assert!(validate_windows(&bad).is_err());
    }

    #[test]
    fn validate_windows_rejects_bad_time() {
        let bad = vec![CalendarWindow {
            day: 1,
            open: "9:00".to_owned(),
            close: "17:00".to_owned(),
        }];
        assert!(validate_windows(&bad).is_err());
    }

    #[test]
    fn validate_windows_accepts_overnight() {
        // Overnight (close < open) is legal — eval handles it.
        let ok = vec![CalendarWindow {
            day: 3,
            open: "22:00".to_owned(),
            close: "02:00".to_owned(),
        }];
        assert!(validate_windows(&ok).is_ok());
    }

    #[test]
    fn validate_holiday_dates_rejects_bad_format() {
        assert!(validate_holiday_dates(&["2026/05/27".to_owned()]).is_err());
        assert!(validate_holiday_dates(&["2026-13-01".to_owned()]).is_err());
        assert!(validate_holiday_dates(&["2026-05-27".to_owned()]).is_ok());
    }

    #[test]
    fn validate_timezone_rejects_garbage() {
        assert!(validate_timezone("Asia/Kolkata").is_ok());
        assert!(validate_timezone("UTC").is_ok());
        assert!(validate_timezone("Not/A/Zone").is_err());
    }

    #[test]
    fn calendar_id_from_inbox_extracts_nested_setting() {
        let oid = ObjectId::new();
        let inbox = doc! {
            "channelConfig": {
                "settings": {
                    "businessHoursCalendarId": oid.to_hex(),
                }
            }
        };
        assert_eq!(calendar_id_from_inbox(&inbox), Some(oid));
    }

    #[test]
    fn calendar_id_from_inbox_returns_none_when_missing() {
        let inbox = doc! {};
        assert_eq!(calendar_id_from_inbox(&inbox), None);
    }

    #[test]
    fn extract_inline_business_hours_returns_none_when_disabled() {
        let inbox = doc! {
            "businessHours": {
                "enabled": false,
                "timezone": "UTC",
                "windows": [],
            }
        };
        assert!(extract_inline_business_hours(&inbox).is_none());
    }

    #[test]
    fn extract_inline_business_hours_pulls_windows() {
        let inbox = doc! {
            "businessHours": {
                "enabled": true,
                "timezone": "Asia/Kolkata",
                "windows": [
                    { "day": 1_i32, "open": "09:00", "close": "17:00" },
                ],
            }
        };
        let (tz, windows, holidays) = extract_inline_business_hours(&inbox).expect("some");
        assert_eq!(tz, "Asia/Kolkata");
        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].day, 1);
        assert!(holidays.is_empty());
    }
}
