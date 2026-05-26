//! On-disk shape of a `sabbi_schedules` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BiSchedule {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(rename = "workbookId")]
    pub workbook_id: ObjectId,

    /// Cron expression — interpreted in the scheduler worker.
    pub cron: String,
    /// Recipient email addresses.
    #[serde(default)]
    pub recipients: Vec<String>,
    /// `"pdf"` | `"csv"` | `"inline"` (inline-HTML body).
    pub format: String,

    #[serde(default, skip_serializing_if = "Option::is_none", rename = "lastRunAt")]
    pub last_run_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "nextRunAt")]
    pub next_run_at: Option<BsonDateTime>,

    /// `"active"` | `"paused"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
