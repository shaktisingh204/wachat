//! On-disk shape of an `esign_audit` event.

use bson::{Bson, DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EsignAuditEvent {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub envelope_id: ObjectId,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signer_id: Option<String>,
    pub event_type: String,
    pub ts: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<Bson>,
    pub hash: String,
}
