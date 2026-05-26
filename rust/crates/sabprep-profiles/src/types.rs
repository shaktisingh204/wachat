//! Profile snapshot DTOs.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabprepProfile {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Dataset this profile was computed for. `None` for ad-hoc profiles.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dataset_id: Option<ObjectId>,

    /// Total rows considered.
    pub rows_total: u32,
    /// Per-column stats.
    pub per_column: Vec<ColumnProfile>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnProfile {
    pub name: String,
    /// Guessed type: `string` | `number` | `bool` | `null` | `mixed`.
    #[serde(rename = "type")]
    pub kind: String,
    pub null_count: u32,
    pub distinct_count: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mean: Option<f64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub top_values: Vec<TopValue>,
    /// Cleansing chips — UI shows them as one-tap step builders.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub suggested_cleansing: Vec<CleansingSuggestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopValue {
    pub value: Value,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleansingSuggestion {
    /// Stable id — `trim`, `lowercase`, `uppercase`, `standardize_phone`,
    /// `fill_null_with_zero`, `cast_to_number`, etc.
    pub kind: String,
    pub label: String,
    /// Reason for the suggestion — surfaced on hover in the UI.
    pub reason: String,
}
