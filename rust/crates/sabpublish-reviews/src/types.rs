//! On-disk shape of a `sabpublish_reviews` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabpublishReview {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(rename = "locationId")]
    pub location_id: ObjectId,
    pub provider_id: String,

    /// Provider-issued id used to de-dupe.
    pub external_review_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewer_name: Option<String>,
    /// 1–5 stars.
    pub rating: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    pub posted_at: BsonDateTime,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reply_body: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replied_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
