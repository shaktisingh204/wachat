//! On-disk shape of a `sablens_annotations` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// A single spatial annotation overlaid on the customer's view.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SablensAnnotation {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Tenant root — owner technician.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub session_id: ObjectId,

    /// Slide id (for `async_recorded` mode) or frame id (live).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slide_or_frame_id: Option<String>,

    pub ts: BsonDateTime,

    /// Author — technician's userId. `None` if the customer drew (rare).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_user_id: Option<ObjectId>,

    /// `"arrow" | "circle" | "rect" | "freehand" | "text"`.
    pub kind: String,

    /// Free-form JSON: `{ points: [[x, y], ...] }`, all values in `0..1`.
    /// For `text` annotations: `{ points: [[x, y]], text: "...", size: n }`.
    pub geometry_json: serde_json::Value,

    pub color: String,
    pub stroke_width: f32,

    #[serde(default)]
    pub persistent: bool,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
