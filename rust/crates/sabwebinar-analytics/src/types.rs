//! Per-webinar analytics summary (computed at query time today).

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SourceBreakdown {
    pub source: String,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WebinarAnalytics {
    pub webinar_id: ObjectId,
    pub registered_count: u32,
    pub attended_count: u32,
    pub avg_watch_time_minutes: f64,
    pub peak_concurrent: u32,
    /// `attended / registered` as a 0..1 fraction.
    pub conversion_rate: f64,
    pub poll_engagement_count: u32,
    pub qna_count: u32,
    pub registrations_by_source: Vec<SourceBreakdown>,
}
