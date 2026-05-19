//! Segment filter tree — JSON-serialisable predicate against subscriber docs.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailFilterOp {
    Eq, Ne, In, Nin,
    Gt, Gte, Lt, Lte,
    Contains, StartsWith, EndsWith, Matches,
    Exists, NotExists,
    WithinDays, Before, After,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailFilterLeaf {
    pub field: String,
    pub op: EmailFilterOp,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailFilterGroup {
    pub combinator: FilterCombinator,
    pub filters: Vec<EmailFilterNode>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum FilterCombinator {
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum EmailFilterNode {
    Group(EmailFilterGroup),
    Leaf(EmailFilterLeaf),
}

pub type EmailFilterTree = EmailFilterGroup;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailSegment {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub list_id: Option<ObjectId>,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub filter: EmailFilterTree,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cached_count: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cached_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
