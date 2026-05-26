//! Wire-format DTOs for the SabChat business-hours endpoints.
//!
//! Mirrors the legacy TS shape (`businessHours: { enabled, timezone,
//! windows: [...] }`) but adds the new "named calendar" surface backed
//! by `sabchat_business_hours_calendars`.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` so the
//! JSON the Next.js shim sends round-trips unchanged.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Persisted document — `sabchat_business_hours_calendars`
// ---------------------------------------------------------------------------

/// One weekly window inside a calendar. Sunday-indexed (`day=0`).
///
/// `open` / `close` are `HH:MM` 24-hour strings. We do **not** enforce
/// `open < close` — overnight windows (`22:00`..`02:00`) are a
/// legitimate cross-midnight shape that the evaluator handles
/// explicitly.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CalendarWindow {
    /// 0..=6, Sunday-indexed (matches `chrono::Weekday::num_days_from_sunday()`).
    pub day: u8,
    /// HH:MM 24h, inclusive lower bound.
    pub open: String,
    /// HH:MM 24h, exclusive upper bound.
    pub close: String,
}

/// A named business-hours calendar. Mongo collection:
/// `sabchat_business_hours_calendars`.
///
/// `holiday_dates` is a free-form list of `YYYY-MM-DD` strings that
/// are treated as full-day closures regardless of the weekly windows.
/// The evaluator additionally consults the tenant's `crm_holidays`
/// collection so HRM-managed holidays propagate without duplication.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BusinessHoursCalendar {
    #[serde(rename = "_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,

    #[schema(value_type = String)]
    pub tenant_id: ObjectId,

    pub name: String,

    /// IANA timezone string, e.g. `"Asia/Kolkata"`.
    pub timezone: String,

    #[serde(default)]
    pub windows: Vec<CalendarWindow>,

    /// Full-day closures in `YYYY-MM-DD` (calendar-local) form.
    #[serde(default)]
    pub holiday_dates: Vec<String>,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// POST /calendars — create
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/business-hours/calendars`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateCalendarBody {
    pub name: String,
    pub timezone: String,
    #[serde(default)]
    pub windows: Vec<CalendarWindow>,
    #[serde(default)]
    pub holiday_dates: Vec<String>,
}

// ---------------------------------------------------------------------------
// PATCH /calendars/:id — update
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/sabchat/business-hours/calendars/:id`. Any
/// field left `None` is preserved; `Some` replaces the persisted value
/// (windows / holiday_dates replace wholesale — there is no
/// patch-merge semantics for the arrays).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCalendarBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub windows: Option<Vec<CalendarWindow>>,
    #[serde(default)]
    pub holiday_dates: Option<Vec<String>>,
}

// ---------------------------------------------------------------------------
// GET /is-open?inboxId= — inbox-scoped evaluator
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/business-hours/is-open`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IsOpenInboxQuery {
    /// Hex `ObjectId` string identifying the inbox to evaluate.
    pub inbox_id: String,
}

// ---------------------------------------------------------------------------
// GET /is-open-now?calendarId= — calendar-scoped evaluator
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/business-hours/is-open-now`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IsOpenCalendarQuery {
    /// Hex `ObjectId` string identifying the calendar to evaluate.
    pub calendar_id: String,
}

// ---------------------------------------------------------------------------
// OpenStatus — evaluator response
// ---------------------------------------------------------------------------

/// Why an [`OpenStatus`] decided open / closed. Stable wire enum so the
/// caller UI can render a distinct message per reason.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum OpenReason {
    /// `now` falls inside one of the configured weekly windows.
    InsideWindow,
    /// `now` falls outside every configured window.
    OutsideWindow,
    /// `now` lands on a calendar `holiday_dates` entry or a tenant
    /// `crm_holidays` row.
    Holiday,
}

/// Result of the "are we open right now?" evaluator.
///
/// `next_open_at` is populated whenever `open == false`. It points to
/// the next instant (in UTC, RFC3339) at which a weekly window opens,
/// looking ahead up to seven days. Returns `None` only when the
/// calendar has zero windows configured (always-closed).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct OpenStatus {
    pub open: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_open_at: Option<DateTime<Utc>>,
    pub reason: OpenReason,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by mutating endpoints that
/// don't have a meaningful body to echo (delete).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
