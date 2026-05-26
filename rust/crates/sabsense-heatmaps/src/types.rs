//! Snapshot shape for `pagesense_heatmaps`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatmapSnapshot {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(rename = "siteId")]
    pub site_id: ObjectId,

    pub url: String,
    /// Optional A/B variant identifier so the same URL can carry one
    /// snapshot per variant.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,

    /// Aggregation window (inclusive).
    pub period_from: BsonDateTime,
    pub period_to: BsonDateTime,

    /// Click density grid serialized as JSON. Shape is
    /// `{ cols, rows, cells: number[] }`. Stored as opaque JSON so the
    /// resolution can evolve without a schema migration. Kept in a
    /// string field to avoid BSON's int-vector limits at large sizes.
    pub click_grid_json: String,

    /// Ten decile buckets: percent of visitors who scrolled past each
    /// decile. `scroll_depth_buckets[0]` = % who reached >= 10%.
    pub scroll_depth_buckets: Vec<f32>,

    /// Total raw events that fed this snapshot — handy for thresholding
    /// "not enough data".
    pub sample_size: u64,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
