//! Wire DTOs for the Facebook Events router.
//!
//! Most endpoints return free-form Graph API JSON because the TS callers
//! already understand the Meta Graph shapes. We use `serde_json::Value`
//! generously rather than re-typing every Graph object.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  Generic envelopes (mirroring the TS `{ success?, error? }` shapes)
// ---------------------------------------------------------------------------

/// Mirrors `handleCreateFacebookEvent` -> `{ message?, error? }`.
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct CreateEventResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Mirrors `handleUpdateFacebookEvent` / `deleteFacebookEvent`
/// -> `{ success, error? }`.
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getFacebookEvents
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct EventsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub events: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getEventDetails
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct EventDetailsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub event: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  handleCreateFacebookEvent
// ---------------------------------------------------------------------------

/// Body for `POST /v1/facebook/events/{project_id}`.
///
/// The TS legacy version reads from a `FormData` (`startDate`+`startTime`,
/// `endDate`+`endTime`, plus a checkbox-style `isOnline === 'on'`). The Rust
/// shim accepts the same fields as JSON; the TS shim is responsible for
/// translating `FormData` into this shape before forwarding.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateEventBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// `YYYY-MM-DD` (must combine with `startTime` to form a valid datetime).
    #[serde(rename = "startDate")]
    pub start_date: String,
    /// `HH:MM` (24h).
    #[serde(rename = "startTime")]
    pub start_time: String,
    #[serde(default, rename = "endDate")]
    pub end_date: Option<String>,
    #[serde(default, rename = "endTime")]
    pub end_time: Option<String>,
    #[serde(default, rename = "placeName")]
    pub place_name: Option<String>,
    #[serde(default, rename = "isOnline")]
    pub is_online: bool,
    #[serde(default, rename = "ticketUri")]
    pub ticket_uri: Option<String>,
}

// ---------------------------------------------------------------------------
//  handleUpdateFacebookEvent
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateEventBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "eventId")]
    pub event_id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "startDate")]
    pub start_date: Option<String>,
    #[serde(default, rename = "startTime")]
    pub start_time: Option<String>,
    #[serde(default, rename = "endDate")]
    pub end_date: Option<String>,
    #[serde(default, rename = "endTime")]
    pub end_time: Option<String>,
}

// ---------------------------------------------------------------------------
//  getEventAttendees
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AttendeesResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub attendees: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Path parameter for `GET /events/{project_id}/{event_id}/attendees/{rsvp}`.
/// Mirrors the legacy TS literal union `'attending' | 'maybe' | 'declined'`.
#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RsvpStatus {
    #[default]
    Attending,
    Maybe,
    Declined,
}

impl RsvpStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Attending => "attending",
            Self::Maybe => "maybe",
            Self::Declined => "declined",
        }
    }
}

/// Query string for `GET /events/{project_id}/{event_id}/attendees`.
/// Provides a fallback when callers prefer query-style RSVP filtering.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct AttendeesQuery {
    #[serde(default)]
    pub rsvp_status: Option<String>,
}
