//! On-disk shape of a `sablens_devices` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SablensDevice {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Tenant root.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Human label ("Mrs. Patel's iPad", "Field tech kit #4").
    pub label: String,

    /// Opaque per-device fingerprint (hash of device props or installed
    /// app's bundle id). Unique within `userId`.
    pub device_fingerprint: String,

    /// Optional pointer to a CRM contact this device belongs to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<BsonDateTime>,

    #[serde(default)]
    pub online: bool,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
