//! On-disk shape of a `sabwebinar_registrations` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Registration {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub webinar_id: ObjectId,

    pub name: String,
    pub email: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company: Option<String>,

    /// Arbitrary custom-field map captured by the landing form.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_fields: Option<serde_json::Value>,

    /// Optional attribution source ("organic", "email", "linkedin", utm_*).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,

    pub registered_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub joined_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_at: Option<BsonDateTime>,

    /// Stable opaque token returned to the attendee — used by `/live`
    /// to bind a session without auth.
    pub join_token: String,
}
