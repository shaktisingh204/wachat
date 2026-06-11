//! On-disk shape of a `sabbigin_booking_pages` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_duration_min() -> u32 {
    30
}

fn default_timezone() -> String {
    "Asia/Kolkata".to_owned()
}

fn default_date_range_days() -> u32 {
    30
}

/// A single weekly availability window. `dow` is `0 = Sunday … 6 = Saturday`;
/// `start`/`end` are `"HH:MM"` 24-hour local-time strings.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AvailabilityWindow {
    /// `0 = Sunday … 6 = Saturday`.
    pub dow: u8,
    /// `"HH:MM"`, e.g. `"09:00"`.
    pub start: String,
    /// `"HH:MM"`, e.g. `"17:00"`.
    pub end: String,
}

/// An intake question shown on the booking page before confirmation.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BookingQuestion {
    /// Stable machine key, e.g. `"company"`.
    pub key: String,
    /// Human-facing label.
    pub label: String,
    /// Must the booker answer this question?
    #[serde(default)]
    pub required: bool,
}

/// A tenant-owned, publicly-bookable scheduling page.
///
/// One row per page. The collection allows multiple rows so the
/// `status: "archived"` soft-delete pattern works the same way as every other
/// CRM entity.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabbiginBookingPage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant scope — owning user.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// URL-safe slug, unique per tenant.
    pub slug: String,
    /// Page title shown to bookers.
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Meeting length in minutes.
    #[serde(default = "default_duration_min")]
    pub duration_min: u32,
    /// IANA timezone the availability windows are expressed in.
    #[serde(default = "default_timezone")]
    pub timezone: String,

    /// Recurring weekly availability windows.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub weekly_availability: Vec<AvailabilityWindow>,

    /// Padding (minutes) inserted between back-to-back bookings.
    #[serde(default)]
    pub buffer_min: u32,
    /// How many days into the future the page accepts bookings.
    #[serde(default = "default_date_range_days")]
    pub date_range_days: u32,

    /// Intake questions shown before confirmation.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub questions: Vec<BookingQuestion>,

    /// Optional CRM owner the resulting record is assigned to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
    /// Optional pipeline new bookings drop a deal into.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pipeline_id: Option<ObjectId>,
    /// Message shown to the booker after confirming.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confirmation_message: Option<String>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
