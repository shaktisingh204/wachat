//! On-disk shape of a `sabpublish_providers` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabpublishProvider {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(rename = "locationId")]
    pub location_id: ObjectId,

    /// `"gbp"` | `"yelp"` | `"bing"` | `"apple"` | `"facebook"`.
    pub provider_id: String,

    /// `"not_connected"` | `"connected"` | `"error"`.
    pub connection_status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub external_listing_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_sync_at: Option<BsonDateTime>,
    /// Reference into the (future) encrypted-token vault. Never stores
    /// the actual access token — that lives in the OAuth backend.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credentials_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
