use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PolicyTargetSelector {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub os: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub endpoint_ids: Vec<ObjectId>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PolicySchedule {
    /// `"cron" | "maintenance_window"`.
    pub kind: String,
    /// Free-form, depends on `kind`. For `cron`: `{ "expr": "0 2 * * *" }`.
    /// For `maintenance_window`: `{ "dayOfWeek": "sat", "startUtc": "02:00", "durationMinutes": 120 }`.
    pub config: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabopsPatchPolicy {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub target_selector: PolicyTargetSelector,
    pub schedule: PolicySchedule,
    /// `"auto_install" | "notify" | "defer"`.
    pub action: String,
    /// `"critical" | "high" | "medium" | "low"` — minimum severity matched.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity_filter: Option<String>,

    #[serde(default)]
    pub enabled: bool,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
