//! On-disk shape of a `sabassist_sessions` document.
//!
//! A SabAssist session represents a remote-screen-share between a SabNode
//! technician (`technician_user_id`, also the tenant `userId` for scoping)
//! and a customer. Sessions can be linked to an existing SabVoice call
//! (`call_id` → `sabvoice_calls._id`) so the technician can see the live
//! call context.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabassistSession {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant id — the SabNode user owning the session.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Technician driving the session (usually = `user_id`, but kept
    /// separate so multi-agent tenants can attribute the seat).
    pub technician_user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_email: Option<String>,

    /// Optional ref to `sabvoice_calls._id` so the session is anchored to
    /// the call that prompted it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub call_id: Option<ObjectId>,

    /// `"scheduled"` | `"active"` | `"ended"`.
    pub status: String,

    /// `"attended"` (PIN-gated, customer must click allow) |
    /// `"unattended"` (pre-registered device with cached consent).
    pub mode: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_secs: Option<u32>,

    /// SabFile reference for the optional session recording (mp4 / webm).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recording_file_id: Option<String>,

    /// Optional pointer to the registered device (`sabassist_devices._id`)
    /// when `mode == "unattended"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
