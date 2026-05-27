//! On-disk shape of a `sabpractice_deadlines` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabPracticeDeadline {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub client_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engagement_id: Option<ObjectId>,

    pub name: String,

    /// `tax_filing` | `payroll` | `gst` | `audit` | `custom`. Free-form.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,

    pub due_date: BsonDateTime,

    /// Recurrence string (cron-ish or human, e.g. `monthly`, `quarterly`,
    /// `yearly:04-15`). Optional.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurrence: Option<String>,

    /// `upcoming` | `in_progress` | `filed` | `overdue`. Free-form.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_user_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,

    /// SabFiles ids for filed receipts / acknowledgements.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachment_file_ids: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
