//! On-disk shape of a `crm_leave_requests` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmLeaveRequest {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Employee whose leave this request belongs to.
    pub employee_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,

    /// Human label for the leave type (e.g. "Casual", "Sick").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub leave_type: Option<String>,
    /// Optional FK into `crm_leave_types` when the catalog id is known.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub leave_type_id: Option<ObjectId>,

    pub start_date: BsonDateTime,
    pub end_date: BsonDateTime,

    /// Number of leave days (fractional half-day support).
    pub days: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,

    /// `"Pending"` | `"Approved"` | `"Rejected"` | `"Cancelled"` | `"archived"`.
    pub status: String,

    /// Approving manager (when status flipped to Approved/Rejected).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_at: Option<BsonDateTime>,

    /// Approver / reviewer notes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comments: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
