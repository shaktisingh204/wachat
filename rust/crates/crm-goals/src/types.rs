//! On-disk shape of a `crm_goals` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmGoal {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,

    /// Free-form period label (e.g. `"Q1 2026"`, `"H2 FY26"`, `"2026"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,

    /// Target value kept as a string so it can carry units (e.g. `"100k"`,
    /// `"95%"`, `"30 deals"`) — same shape the legacy form already accepted.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub achieved: Option<String>,

    /// Percentage `0.0 ..= 100.0`. Clamped on write.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progress: Option<f64>,
    /// Relative importance, used when rolling many goals into a single score.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kpi: Option<String>,

    /// `"draft"` | `"active"` | `"achieved"` | `"missed"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
