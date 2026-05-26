//! On-disk shape of an `agile_burndown` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgileBurndownSample {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub sprint_id: ObjectId,
    /// Zero-based day index within the sprint (0 = start day).
    pub day: u32,
    /// Calendar date of the sample (YYYY-MM-DD precision).
    pub sample_date: BsonDateTime,
    pub remaining_points: f64,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
