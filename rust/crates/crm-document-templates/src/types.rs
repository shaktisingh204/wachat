//! On-disk shape of a `crm_document_templates` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// A single merge-variable slot in a template (e.g. `{{employee_name}}`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TemplateVariable {
    /// Machine name used in the body, e.g. `employee_name`.
    pub name: String,
    /// Human label rendered next to the merge field in the editor.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Optional default value when the field is left blank at render time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmDocumentTemplate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,

    /// `"Contract" | "Policy" | "Offer" | "Other"`. Stored as string so
    /// callers can introduce new kinds without a migration.
    pub kind: String,

    /// Free-form category label (orthogonal to `kind`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    /// Markdown body of the template, with `{{variable}}` placeholders.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,

    /// Declared merge variables.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variables: Vec<TemplateVariable>,

    /// SabFile URL pointing at a pre-rendered template file (PDF/DOCX).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_file_url: Option<String>,

    #[serde(default)]
    pub is_active: bool,

    /// `"draft" | "active" | "archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
