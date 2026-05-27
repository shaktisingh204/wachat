//! On-disk shape of a `sablens_sessions` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// AR remote-support session.
///
/// `customer_join_token` is an opaque 48-hex-char string the technician
/// hands the customer (URL: `/lens/<token>`). The customer-facing public
/// endpoints accept only that token — no JWT.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SablensSession {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Tenant root — technician who owns this session.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Acting technician (may be a teammate). Defaults to `user_id`.
    pub technician_user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_email: Option<String>,

    /// Opaque token the customer presents (`/lens/<token>`).
    pub customer_join_token: String,

    /// `"scheduled" | "waiting" | "active" | "ended"`.
    pub status: String,

    /// `"live_call" | "async_recorded"`.
    pub mode: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_secs: Option<u64>,

    /// SabFiles fileId of the recorded session video (if any).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recording_file_id: Option<String>,

    /// SabFiles fileIds of captured frame snapshots.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub snapshot_file_ids: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
