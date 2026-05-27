//! On-disk shape of a `sabcreator_workflows` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Trigger envelope. `kind` is one of `form_submit | record_change | cron |
/// button_click` and `config` is a free-form blob whose shape depends on
/// `kind` (e.g. cron expression, form id, record-change filters).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowTrigger {
    pub kind: String,
    #[serde(default)]
    pub config: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcreatorWorkflow {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub app_id: ObjectId,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    pub trigger: WorkflowTrigger,

    /// Reference into the SabFlow service. When set, the workflow delegates
    /// execution to SabFlow via `runSabflowExecution(sabflowRefId, ...)`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sabflow_ref_id: Option<ObjectId>,

    /// Alternative: inline step graph evaluated by SabCreator itself.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inline_steps_json: Option<Value>,

    /// `active` | `paused` | `archived`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
