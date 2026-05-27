//! On-disk shape of a `sabassist_devices` document.
//!
//! Represents a long-lived registered endpoint that the SabAssist agent
//! runs on (a customer's office PC, a kiosk, etc.). Used to drive
//! unattended-mode sessions where no live PIN approval is required.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabassistDevice {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant id — same as the owning user.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub label: String,
    pub owner_user_id: ObjectId,

    /// Stable per-install identifier emitted by the SabAssist agent.
    pub device_fingerprint: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<BsonDateTime>,
    #[serde(default)]
    pub online: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_version: Option<String>,

    /// Free-form OS info (`platform`, `version`, `arch`, …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub os_info_json: Option<bson::Bson>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
