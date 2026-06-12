//! On-disk shape of a `crm_form_submissions` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// A single lead-capture form submission.
///
/// `data` is intentionally a flexible BSON document — form schemas vary per
/// tenant, and the field-name → value mapping is whatever the form was
/// configured with at submission time.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmFormSubmission {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM workspace scope. Present on submissions captured through the
    /// project-scoped `/v1/sabcrm/*` mounts (inherited from the parent
    /// form's `projectId`); absent on legacy docs.
    #[serde(rename = "projectId", default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    /// Reference to the parent `crm_forms` document.
    #[serde(rename = "formId")]
    pub form_id: ObjectId,

    /// Raw submitted field-name → value blob.
    #[serde(default)]
    pub data: Document,

    /// Page URL the form was submitted from.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub referrer: Option<String>,

    /// `"new"` | `"processed"` | `"spam"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub processed_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
