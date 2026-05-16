//! On-disk shape of a `crm_candidates` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmCandidate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub first_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,

    /// Unique per tenant — stored lowercased.
    pub email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_company: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,

    /// `"linkedin"` | `"referral"` | `"website"` | `"agency"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<ObjectId>,

    /// SabFile reference (CDN URL or SabFile id).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resume_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_letter: Option<String>,

    #[serde(default)]
    pub skills: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub experience_years: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_salary: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    /// `"applied"` | `"screening"` | `"interview"` | `"offer"` | `"hired"` | `"rejected"` | `"archived"`.
    pub stage: String,

    /// 1..5 inclusive.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rating: Option<i32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
