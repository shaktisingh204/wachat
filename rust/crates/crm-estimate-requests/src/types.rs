//! On-disk shape of a `crm_estimate_requests` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmEstimateRequest {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub customer_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_email: Option<String>,

    pub requirements: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub budget_range: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deadline: Option<BsonDateTime>,

    /// `"web"` | `"email"` | `"phone"` | `"referral"` | `"other"`.
    pub source: String,
    /// `"pending"` | `"in_review"` | `"quoted"` | `"declined"` | `"archived"`.
    pub status: String,

    /// Stored as a free-form string in the source-of-truth TS action.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_to_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
