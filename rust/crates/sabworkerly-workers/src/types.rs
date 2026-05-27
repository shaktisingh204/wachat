//! On-disk shape of a `sabworkerly_workers` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabworkerlyWorker {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub email: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub skills: Vec<String>,

    /// Free-form availability JSON, e.g.
    /// `{ "mon": "9-17", "tue": "9-17", … }` — UI shape only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub availability_json: Option<JsonValue>,

    /// `active | inactive | on_assignment`.
    pub status: String,

    /// Pay rate per hour in minor units (e.g. cents).
    pub hourly_rate_minor: i64,
    pub currency: String,

    /// Free-form address JSON.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address_json: Option<JsonValue>,

    /// SabFiles document IDs (ID, visa, certs).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub document_ids: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
