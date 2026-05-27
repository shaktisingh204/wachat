//! On-disk shape of `sabpublish_posts`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabpublishPost {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(rename = "locationId")]
    pub location_id: ObjectId,

    /// `["gbp","yelp",...]` — providers this post should publish to.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub provider_ids: Vec<String>,

    pub body: String,
    /// SabFiles file ids — never raw URLs.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub media_file_ids: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schedule_at: Option<BsonDateTime>,

    /// `"draft"` | `"scheduled"` | `"published"` | `"failed"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub published_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
