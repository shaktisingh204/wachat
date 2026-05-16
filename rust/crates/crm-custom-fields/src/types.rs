//! On-disk shape of a `crm_custom_fields` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmCustomField {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Which entity this custom field attaches to.
    /// e.g. `"contact"` | `"deal"` | `"lead"` | `"account"` | `"ticket"` | `"employee"`.
    pub entity_kind: String,

    /// Internal key. e.g. `"passport_number"`.
    pub name: String,
    /// Display label. e.g. `"Passport Number"`.
    pub label: String,

    /// `"text"` | `"textarea"` | `"number"` | `"currency"` | `"date"` |
    /// `"datetime"` | `"boolean"` | `"select"` | `"multiselect"` |
    /// `"url"` | `"email"` | `"phone"` | `"file"`.
    pub field_type: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub help_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_value: Option<Document>,

    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub unique: bool,

    /// For select/multiselect: `[{value, label, color?}]`.
    #[serde(default)]
    pub options: Vec<Document>,
    /// `{min, max, pattern, ...}`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub validation: Option<Document>,

    #[serde(default)]
    pub display_order: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section: Option<String>,

    #[serde(default)]
    pub visible_in_list: bool,
    #[serde(default = "default_true")]
    pub visible_in_form: bool,
    #[serde(default = "default_true")]
    pub editable_in_form: bool,
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_true() -> bool {
    true
}
