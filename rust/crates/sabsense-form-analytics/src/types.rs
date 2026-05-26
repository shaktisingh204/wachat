//! Form-analytics document shape.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldDropoff {
    /// `name` or `id` attribute of the input.
    pub field: String,
    /// How many sessions focused this field but did not move past it.
    pub dropoff_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormAnalytics {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(rename = "siteId")]
    pub site_id: ObjectId,

    /// CSS selector identifying the form (e.g. `#signup`, `form.newsletter`).
    pub form_selector: String,
    pub per_field_dropoff: Vec<FieldDropoff>,
    /// 0.0..=1.0
    pub completion_rate: f32,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
