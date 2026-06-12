//! On-disk shape of a `crm_forms` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// Single field definition on a form. The legacy TS shape is loose
/// (`fields: any[]`), so optional metadata fields are tolerated.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmFormField {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// `"text"` | `"email"` | `"phone"` | `"textarea"` | `"select"` | etc.
    #[serde(rename = "type", default, skip_serializing_if = "Option::is_none")]
    pub field_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    /// Options for `select` / `radio` fields.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    /// CRM contact/deal field this form field maps to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mapping: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmForm {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM workspace scope. Present on documents created through the
    /// project-scoped `/v1/sabcrm/forms` mount; absent on legacy docs.
    #[serde(rename = "projectId", default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    pub name: String,

    /// Public slug for embedding / public URL. Optional in legacy docs.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,

    #[serde(default)]
    pub fields: Vec<CrmFormField>,

    /// Free-form settings blob (redirectUrl, successMessage, captcha,
    /// mappings, theme, etc.). Mirrors legacy `settings: any`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<JsonValue>,

    #[serde(rename = "submissionCount", default)]
    pub submission_count: i64,

    /// `"draft"` | `"published"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
