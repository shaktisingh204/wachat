//! On-disk shape of a `crm_onboardings` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingTask {
    /// Stable client-side identifier (uuid / slug). Required so updates
    /// can target a specific row without relying on array index.
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Bucket label, e.g. `"paperwork"`, `"it"`, `"training"`, `"compliance"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<BsonDateTime>,
    /// `"todo"` | `"in_progress"` | `"done"` | `"blocked"`.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmOnboarding {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,
    /// Source candidate (recruitment) if onboarding was promoted from a hire.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidate_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub joining_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buddy_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<ObjectId>,

    #[serde(default)]
    pub checklist: Vec<OnboardingTask>,
    /// 0.0..=100.0
    #[serde(default)]
    pub progress: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"pending"` | `"in_progress"` | `"completed"` | `"cancelled"` | `"archived"`.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
