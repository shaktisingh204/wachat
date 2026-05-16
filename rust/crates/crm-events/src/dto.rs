//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmEvent;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub event_type: Option<String>,
    #[serde(default)]
    pub organizer_id: Option<String>,
    /// ISO-8601 (RFC 3339) — inclusive lower bound on `startsAt`.
    #[serde(default)]
    pub date_from: Option<String>,
    /// ISO-8601 (RFC 3339) — inclusive upper bound on `startsAt`.
    #[serde(default)]
    pub date_to: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEventInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub event_type: Option<String>,
    pub starts_at: String,
    #[serde(default)]
    pub ends_at: Option<String>,
    #[serde(default)]
    pub is_all_day: Option<bool>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub is_online: Option<bool>,
    #[serde(default)]
    pub meeting_url: Option<String>,
    #[serde(default)]
    pub organizer_id: Option<String>,
    #[serde(default)]
    pub organizer_name: Option<String>,
    #[serde(default)]
    pub attendee_ids: Option<Vec<String>>,
    #[serde(default)]
    pub max_attendees: Option<i32>,
    #[serde(default)]
    pub is_recurring: Option<bool>,
    #[serde(default)]
    pub recurrence_rule: Option<String>,
    #[serde(default)]
    pub parent_event_id: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub banner_url: Option<String>,
    #[serde(default)]
    pub reminder_minutes: Option<i32>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEventInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub event_type: Option<String>,
    #[serde(default)]
    pub starts_at: Option<String>,
    #[serde(default)]
    pub ends_at: Option<String>,
    #[serde(default)]
    pub is_all_day: Option<bool>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub is_online: Option<bool>,
    #[serde(default)]
    pub meeting_url: Option<String>,
    #[serde(default)]
    pub organizer_id: Option<String>,
    #[serde(default)]
    pub organizer_name: Option<String>,
    #[serde(default)]
    pub attendee_ids: Option<Vec<String>>,
    #[serde(default)]
    pub max_attendees: Option<i32>,
    #[serde(default)]
    pub rsvp_count: Option<i64>,
    #[serde(default)]
    pub is_recurring: Option<bool>,
    #[serde(default)]
    pub recurrence_rule: Option<String>,
    #[serde(default)]
    pub parent_event_id: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub banner_url: Option<String>,
    #[serde(default)]
    pub reminder_minutes: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEventResponse {
    pub id: String,
    pub entity: CrmEvent,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEventResponse {
    pub deleted: bool,
}
