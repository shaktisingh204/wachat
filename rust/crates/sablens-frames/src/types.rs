//! On-disk shape of a `sablens_frames` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SablensFrame {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub session_id: ObjectId,

    pub ts: BsonDateTime,

    /// SabFiles fileId for the JPEG bytes.
    pub file_id: String,

    /// 0|90|180|270 — device orientation when captured, if reported.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_orientation: Option<i32>,

    /// Free-form sensor metadata: focal length, accelerometer, etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sensor_info_json: Option<serde_json::Value>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
