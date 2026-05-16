//! On-disk shape of a `crm_exits` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmExit {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<String>,

    /// `"resignation"` | `"termination"` | `"retirement"` | `"end_of_contract"` | `"other"`.
    pub r#type: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notice_start: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_day: Option<BsonDateTime>,

    /// `"pending"` | `"in_progress"` | `"complete"` | `"waived"`.
    pub fnf_status: String,
    pub noc_status: String,
    pub asset_return_status: String,
    pub knowledge_transfer_status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_interview_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"open"` | `"complete"` | `"cancelled"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default)]
    pub archived: bool,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
