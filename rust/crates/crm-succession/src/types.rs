//! On-disk shape of a `crm_succession_plans` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SuccessionCandidate {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<String>,
    /// `"ready_now"` | `"1_year"` | `"2_3_years"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub readiness: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmSuccessionPlan {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub role_title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_incumbent: Option<String>,

    #[serde(default)]
    pub successors: Vec<SuccessionCandidate>,

    /// `"ready_now"` | `"1_year"` | `"2_3_years"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub readiness_overall: Option<String>,

    #[serde(default)]
    pub critical_role: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"draft"` | `"approved"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
