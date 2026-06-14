//! On-disk shape of a `sabcall_trunks` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SipTrunk {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Friendly name for the trunk.
    pub name: String,

    /// Upstream provider — one of the known carriers, or `"custom"`.
    pub provider: String,

    /// The carrier SIP host (e.g. `sip.carrier.com`).
    pub sip_server: String,

    /// SIP signalling port (defaults to 5060).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub port: Option<i32>,

    /// SIP transport — `"udp"` | `"tcp"` | `"tls"`.
    pub transport: String,

    /// Username for SIP digest auth.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth_username: Option<String>,

    /// Reference to a stored secret holding the SIP password — never the raw value.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth_password_ref: Option<String>,

    /// Domain to present in the From header.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_domain: Option<String>,

    /// User part to present in the From header.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_user: Option<String>,

    /// Whether to send a SIP REGISTER to the carrier.
    #[serde(default)]
    pub register: bool,

    /// Whether inbound calls over this trunk are accepted.
    #[serde(default)]
    pub inbound_enabled: bool,

    /// Whether outbound calls over this trunk are allowed.
    #[serde(default)]
    pub outbound_enabled: bool,

    /// Negotiated codecs, in preference order.
    #[serde(default)]
    pub codecs: Vec<String>,

    /// Maximum concurrent channels (None = unlimited / carrier-defined).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_channels: Option<i32>,

    /// `"active"` | `"disabled"`.
    pub status: String,

    /// Freeform operator notes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
