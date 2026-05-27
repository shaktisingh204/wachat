//! On-disk shape of a `sabassist_access_tokens` document.
//!
//! An access token grants a customer browser session permission to redeem
//! a SabAssist session — it carries the session id, the issuing tenant
//! `user_id`, an expiry, a used flag, and (for attended sessions) a
//! one-time PIN the customer must enter on the landing page.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabassistAccessToken {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant id — the SabNode user owning the session this token redeems.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Session this token grants access to.
    pub session_id: ObjectId,

    /// Opaque high-entropy token (URL-safe). Indexed unique.
    pub token: String,

    pub expires_at: BsonDateTime,
    #[serde(default)]
    pub used: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub used_at: Option<BsonDateTime>,

    /// 6-digit PIN customers must enter for attended sessions; null for
    /// unattended (the device's stored fingerprint is the proof instead).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub one_time_pin: Option<String>,

    /// Optional device fingerprint binding — when set, the token only
    /// redeems from that specific device (unattended mode).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_fingerprint: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
