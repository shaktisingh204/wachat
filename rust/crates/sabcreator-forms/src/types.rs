//! On-disk shape of a `sabcreator_forms` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcreatorForm {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub app_id: ObjectId,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// SabTables table id that records flow into.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sabtables_table_id: Option<ObjectId>,

    /// Array of `{ tableFieldId, label, helpText, required, validations,
    /// defaultValue, hidden, conditional }`.
    pub fields_json: Value,

    /// Free-form layout blob (rows, columns, sections, widget positions).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout_json: Option<Value>,

    /// `createRecord` | `updateRecord` | `callWorkflow`.
    pub submit_action: String,

    /// Required when `submitAction = callWorkflow`. References a
    /// `sabcreator_workflows` document.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub submit_workflow_id: Option<ObjectId>,

    /// `draft` | `published` | `archived`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
