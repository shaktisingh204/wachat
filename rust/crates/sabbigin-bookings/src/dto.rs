//! Request DTOs — what callers send IN.

use serde::{Deserialize, Serialize};

use crate::types::{AvailabilityWindow, BookingQuestion, SabbiginBookingPage};

/// `GET /v1/sabbigin/bookings?…`
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// `"active"` | `"archived"` | `"all"`. Defaults to `"active"`.
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/sabbigin/bookings` body.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSabbiginBookingPageInput {
    pub slug: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub duration_min: Option<u32>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub weekly_availability: Option<Vec<AvailabilityWindow>>,
    #[serde(default)]
    pub buffer_min: Option<u32>,
    #[serde(default)]
    pub date_range_days: Option<u32>,
    #[serde(default)]
    pub questions: Option<Vec<BookingQuestion>>,
    /// Hex `ObjectId` — CRM owner the resulting record is assigned to.
    #[serde(default)]
    pub owner_id: Option<String>,
    /// Hex `ObjectId` — pipeline new bookings drop a deal into.
    #[serde(default)]
    pub pipeline_id: Option<String>,
    #[serde(default)]
    pub confirmation_message: Option<String>,
}

/// `PATCH /v1/sabbigin/bookings/:id` body. Every field optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSabbiginBookingPageInput {
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub duration_min: Option<u32>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub weekly_availability: Option<Vec<AvailabilityWindow>>,
    #[serde(default)]
    pub buffer_min: Option<u32>,
    #[serde(default)]
    pub date_range_days: Option<u32>,
    #[serde(default)]
    pub questions: Option<Vec<BookingQuestion>>,
    /// Empty string clears the owner binding.
    #[serde(default)]
    pub owner_id: Option<String>,
    /// Empty string clears the pipeline binding.
    #[serde(default)]
    pub pipeline_id: Option<String>,
    #[serde(default)]
    pub confirmation_message: Option<String>,
    /// Allow `"active"` ↔ `"archived"` transitions via PATCH.
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/sabbigin/bookings` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSabbiginBookingPageResponse {
    pub id: String,
    pub entity: SabbiginBookingPage,
}

/// `DELETE /v1/sabbigin/bookings/:id` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSabbiginBookingPageResponse {
    pub deleted: bool,
}
