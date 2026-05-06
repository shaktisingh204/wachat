//! `notes[]` — structured timeline entry attached to an entity.
//! `body` is free-form (markdown allowed); `authorId` is `None` for
//! system / automation-emitted notes.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    #[serde(rename = "_id", default, skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    pub body: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_id: Option<ObjectId>,

    pub created_at: DateTime<Utc>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<DateTime<Utc>>,
}
