//! Funnel run snapshot shape.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepResult {
    pub name: String,
    /// How many distinct sessions reached this step.
    pub count: u64,
    /// Fraction (0.0..=1.0) of sessions that dropped off between the
    /// previous step and this one. `0.0` for the first step.
    pub dropoff_rate: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunnelRun {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(rename = "funnelId")]
    pub funnel_id: ObjectId,
    #[serde(rename = "siteId")]
    pub site_id: ObjectId,

    pub period_from: BsonDateTime,
    pub period_to: BsonDateTime,

    pub steps: Vec<StepResult>,
    /// Total distinct sessions observed in the window (denominator for
    /// step 0).
    pub total_sessions: u64,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
