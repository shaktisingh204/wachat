//! On-disk shape of a `sabvault_audit` document.
//!
//! Append-only — there is no PATCH/DELETE handler. Reads are tenant-scoped:
//! a user can only see audit rows where they were either the actor OR the
//! owner of the secret in question.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    #[default]
    View,
    Copy,
    Reveal,
    Edit,
    Share,
    Revoke,
    Create,
    Delete,
    /// Failed unlock attempt against the master password.
    UnlockFail,
    UnlockOk,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabvaultAuditEntry {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Owner of the secret — used to tenant-scope read queries.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_id: Option<ObjectId>,
    pub actor_user_id: ObjectId,
    pub action: AuditAction,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    /// Free-form metadata, e.g. `{ "permission": "read" }` for share events.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meta: Option<bson::Document>,

    pub ts: BsonDateTime,
}
