//! On-disk shape of `sabmail_rules`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RuleCondition {
    /// `from` | `to` | `subject` | `body` | `hasAttachment`.
    pub field: String,
    /// `equals` | `contains` | `startsWith` | `endsWith` | `regex` | `isTrue` | `isFalse`.
    pub op: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RuleAction {
    /// `move` | `label` | `forward` | `delete` | `markRead` | `star`.
    #[serde(rename = "type")]
    pub action_type: String,
    /// Folder id (move), label string, forward target — context-dependent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmailRule {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub account_id: ObjectId,

    pub name: String,

    /// Display priority — lower = runs first.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<i32>,

    /// `all` (AND) | `any` (OR). Defaults to `all`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub match_mode: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub conditions: Vec<RuleCondition>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub actions: Vec<RuleAction>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,

    /// `active` | `archived`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
