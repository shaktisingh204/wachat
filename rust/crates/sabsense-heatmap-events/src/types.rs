//! Stored shape of a single heatmap event.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// `click` | `move` | `scroll`. Kept as a string newtype so the
/// ingestion path can accept future event kinds without an enum
/// migration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HeatmapEventType {
    Click,
    Move,
    Scroll,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatmapEvent {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(rename = "siteId")]
    pub site_id: ObjectId,

    pub url: String,
    pub event_type: HeatmapEventType,

    /// Page-relative pixel coordinate of the point.
    pub x: f32,
    pub y: f32,

    /// Viewport at the time of capture so the aggregator can normalize
    /// across responsive layouts.
    pub viewport_w: u32,
    pub viewport_h: u32,

    /// Client-generated session id from the snippet (used to stitch
    /// recordings together; not an auth identifier).
    pub session_id: String,

    /// Optional A/B variant the visitor saw — joined into the heatmap
    /// snapshot key downstream.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,

    /// Event timestamp (ingestion-time, not page-time).
    pub ts: BsonDateTime,
}
