//! On-disk shape of a `crm_jobs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmJob {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub title: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub responsibilities: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requirements: Option<String>,

    /// `"full_time"` | `"part_time"` | `"contract"` | `"intern"` | `"temporary"`.
    pub employment_type: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub experience_min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub experience_max: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salary_min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salary_max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    /// `"onsite"` | `"remote"` | `"hybrid"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote_policy: Option<String>,

    pub openings: i32,
    pub filled: i32,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hiring_manager_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub publish_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub publish_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub close_at: Option<BsonDateTime>,

    /// `"draft"` | `"open"` | `"on_hold"` | `"filled"` | `"closed"` | `"archived"`.
    pub status: String,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
