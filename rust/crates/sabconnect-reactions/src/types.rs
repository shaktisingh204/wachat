//! On-disk shape of an `sabconnect_reactions` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabConnectReaction {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Target feed item id.
    pub item_id: ObjectId,
    /// Author (employee id within tenant).
    pub reactor_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reactor_name: Option<String>,

    /// Emoji shortcode or unicode (e.g. "👍" or ":thumbsup:").
    pub emoji: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
