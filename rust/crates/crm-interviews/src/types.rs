//! On-disk shape of a `crm_interviews` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_round() -> i32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmInterview {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub candidate_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidate_name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<ObjectId>,

    #[serde(default = "default_round")]
    pub round: i32,
    /// e.g. `"Phone Screen"` | `"Technical"` | `"HR"` | `"Final"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub round_name: Option<String>,

    /// `"phone"` | `"video"` | `"onsite"` | `"async_assessment"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interview_type: Option<String>,

    pub scheduled_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_minutes: Option<i32>,
    /// Physical location or meeting URL.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,

    #[serde(default)]
    pub interviewers: Vec<ObjectId>,
    #[serde(default)]
    pub interviewer_names: Vec<String>,

    /// `"scheduled"` | `"rescheduled"` | `"completed"` | `"no_show"` |
    /// `"cancelled"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub feedback: Option<String>,
    /// 1..5 rating.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rating: Option<i32>,
    /// `"strong_hire"` | `"hire"` | `"no_hire"` | `"strong_no_hire"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recommendation: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
