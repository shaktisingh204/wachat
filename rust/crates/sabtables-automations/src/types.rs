//! On-disk shape of a `sabtables_automations` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SabtablesTriggerKind {
    #[default]
    RecordCreated,
    RecordUpdated,
    Cron,
    Webhook,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabtablesAutomationTrigger {
    pub kind: SabtablesTriggerKind,
    /// Free-form per-kind config — e.g. `{ cron: "0 9 * * *" }` for cron,
    /// `{ fieldId: "fld_abc" }` for record_updated.
    #[serde(default)]
    pub config: Document,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabtablesAutomationAction {
    /// Stable id for ordering / referencing previous-step outputs.
    pub id: String,
    /// Action handler key — e.g. `"send_email"`, `"create_record"`,
    /// `"update_record"`, `"webhook"`, `"slack"`, …
    pub kind: String,
    #[serde(default)]
    pub config: Document,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabtablesAutomation {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub table_id: ObjectId,

    pub name: String,

    pub trigger: SabtablesAutomationTrigger,

    pub actions: Vec<SabtablesAutomationAction>,

    #[serde(default)]
    pub is_enabled: bool,

    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
