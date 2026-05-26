//! On-disk shape of a `meet_rooms` document. (Collection name preserved for backward compat.)

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn is_false(b: &bool) -> bool {
    !*b
}

/// Recurrence rule (RFC 5545-flavored — frequency, optional interval/count/until).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecurringRule {
    /// `"daily"` | `"weekly"` | `"monthly"`.
    pub frequency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interval: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub until: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub by_weekday: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub host_user_id: ObjectId,

    /// Co-hosts that share host privileges (mute, admit, end).
    #[serde(default)]
    pub cohost_user_ids: Vec<ObjectId>,

    /// Optional invitees pre-listed; guests join via `joinCode` regardless.
    #[serde(default)]
    pub invitee_user_ids: Vec<ObjectId>,
    #[serde(default)]
    pub invitee_emails: Vec<String>,

    /// `null` = instant meeting (no schedule).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scheduled_start: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scheduled_end: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring_rule: Option<RecurringRule>,

    /// Short shareable code (e.g. `abc-defg-hij`). Required.
    pub join_code: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passcode: Option<String>,

    #[serde(default, skip_serializing_if = "is_false")]
    pub lobby_enabled: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub recording_enabled: bool,
    /// If `true` only authenticated users may join (no guests).
    #[serde(default, skip_serializing_if = "is_false")]
    pub require_auth: bool,

    /// SFU integration handle — pluggable. Defaults to `null` until a
    /// transport binds the room to a live SFU session.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sfu_room_id: Option<String>,

    /// Lifecycle status: `"scheduled"` | `"live"` | `"ended"` | `"canceled"`.
    pub status: String,

    /// Optional description shown on the lobby card.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Optional agenda items rendered in the lobby.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub agenda: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
