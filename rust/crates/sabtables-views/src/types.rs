//! On-disk shape of a `sabtables_views` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SabtablesViewKind {
    #[default]
    Grid,
    Kanban,
    Gallery,
    Calendar,
    Gantt,
    Form,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabtablesView {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub table_id: ObjectId,

    pub name: String,

    pub kind: SabtablesViewKind,

    /// Free-form per-kind config. Examples:
    /// - grid: `{ visibleFields, columnWidths, filters, sort, groupBy }`
    /// - kanban: `{ stackByFieldId, color }`
    /// - calendar: `{ dateFieldId }`
    /// - form: `{ formToken, title, fields: [{fieldId, required, helpText}] }`
    #[serde(default)]
    pub config_json: Document,

    /// Optional public form-share token (only set when `kind=form`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub form_token: Option<String>,

    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
