//! On-disk shape of a `sabworkerly_timesheets` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabworkerlyTimesheet {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub placement_id: ObjectId,
    pub worker_id: ObjectId,

    /// Monday of the timesheet week (00:00 UTC).
    pub week_start: BsonDateTime,

    /// Free-form JSON, e.g. `{ "mon": 8, "tue": 7.5, … }`.
    pub daily_hours_json: JsonValue,

    pub total_hours: f64,

    /// `draft | submitted | approved | invoiced | rejected`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub submitted_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rejection_reason: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
