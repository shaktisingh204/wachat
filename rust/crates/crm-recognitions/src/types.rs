//! On-disk shape of a `crm_recognitions` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmRecognition {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_employee_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_employee_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_employee_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_employee_name: Option<String>,

    /// `"achievement"` | `"teamwork"` | `"leadership"` | `"innovation"`
    /// | `"customer_service"` | `"other"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub badge_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub points: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_public: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub award_program_id: Option<String>,

    /// `"draft"` | `"pending"` | `"approved"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
