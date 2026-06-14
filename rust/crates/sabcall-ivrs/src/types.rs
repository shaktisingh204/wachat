//! On-disk shape of a `sabcall_ivrs` document.

use bson::{Bson, DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceIvr {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `"active"` | `"draft"` | `"archived"`.
    pub status: String,

    /// Free-form IVR tree. Each node has at minimum:
    ///   `{ type: "menu" | "playback" | "forward" | "voicemail" | "hangup" | "conditional",
    ///     ...node-specific keys, children: VoiceIvrNode[] }`
    /// Stored as opaque BSON so the Rust side doesn't have to know every
    /// node-key shape; the Next.js builder owns the schema.
    pub root_node: Bson,

    /// Optional SabFile reference for a default greeting audio file.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub greeting_file_id: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
