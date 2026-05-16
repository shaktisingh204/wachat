//! On-disk shape of a `crm_okrs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyResult {
    /// Stable client-generated identifier for this KR within the OKR.
    pub id: String,
    pub title: String,
    /// Optional measurement name (e.g. `"MRR"`, `"NPS"`, `"signups"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metric: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_value: Option<f64>,
    /// Free-form unit label (`"%"`, `"$"`, `"users"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    /// Relative weight used when rolling KRs into the objective's progress.
    /// Defaults to `1.0` when missing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
    /// `"on_track"` | `"at_risk"` | `"behind"` | `"completed"`.
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmOkr {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub objective: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Free-form period label (e.g. `"2026-Q1"`, `"H2 FY26"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<ObjectId>,

    /// Parent OKR (for company → team → individual rollups).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_okr_id: Option<ObjectId>,

    #[serde(default)]
    pub key_results: Vec<KeyResult>,

    /// Percentage `0.0 ..= 100.0`. Auto-computed from KR weights when KRs
    /// exist and the caller didn't supply an explicit value.
    pub progress: f64,
    /// Owner-reported confidence `0.0 ..= 100.0`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,

    /// `"draft"` | `"in_progress"` | `"on_track"` | `"at_risk"` |
    /// `"behind"` | `"completed"` | `"missed"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<BsonDateTime>,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
