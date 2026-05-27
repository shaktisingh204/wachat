//! On-disk shape of a `sabcreator_roles` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Row-level rule for one CRUD verb. `rule` is `own` | `all` |
/// `conditional`. When `conditional`, `condition` is a free-form
/// predicate evaluated against the record (e.g. JsonLogic blob).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RowLevelRule {
    #[serde(default = "default_rule_all")]
    pub rule: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub condition: Option<Value>,
}

fn default_rule_all() -> String {
    "all".to_owned()
}

impl Default for RowLevelRule {
    fn default() -> Self {
        Self {
            rule: default_rule_all(),
            condition: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcreatorRole {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub app_id: ObjectId,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,

    #[serde(default)]
    pub records_can_read: RowLevelRule,
    #[serde(default)]
    pub records_can_edit: RowLevelRule,
    #[serde(default)]
    pub records_can_delete: RowLevelRule,

    /// Form ids this role may submit.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub forms_can_submit: Vec<ObjectId>,

    /// Page ids this role may view.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub pages_can_view: Vec<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
