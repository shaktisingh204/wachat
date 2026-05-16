//! On-disk shape of a `crm_events` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmEvent {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `"meeting"` | `"workshop"` | `"social"` | `"holiday"` |
    /// `"celebration"` | `"training"` | `"conference"` | `"other"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_type: Option<String>,

    pub starts_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ends_at: Option<BsonDateTime>,

    #[serde(default)]
    pub is_all_day: bool,

    /// Physical address or URL.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(default)]
    pub is_online: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meeting_url: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organizer_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organizer_name: Option<String>,

    #[serde(default)]
    pub attendee_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_attendees: Option<i32>,
    #[serde(default)]
    pub rsvp_count: i64,

    #[serde(default)]
    pub is_recurring: bool,
    /// iCalendar RRULE format string (e.g. `FREQ=WEEKLY;BYDAY=MO`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurrence_rule: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_event_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub banner_url: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reminder_minutes: Option<i32>,

    /// `"draft"` | `"scheduled"` | `"in_progress"` | `"completed"` |
    /// `"cancelled"` | `"archived"`.
    pub status: String,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
