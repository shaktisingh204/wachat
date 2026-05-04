//! Mirrors `Template` from `src/lib/definitions.ts` (line ~1487).
//!
//! Stored in the `templates` Mongo collection.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Approval lifecycle of a Meta-side message template.
///
/// The TS field `status` is typed as `string`, but the values it actually
/// holds are the Meta enum: `APPROVED | PENDING | REJECTED | DISABLED |
/// PAUSED`. We model that explicitly. Serialization uses
/// `SCREAMING_SNAKE_CASE` so the stored value matches Meta's exact strings
/// (and our existing Mongo documents).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TemplateStatus {
    Approved,
    Pending,
    Rejected,
    Disabled,
    Paused,
}

/// Template category as Meta classifies it.
///
/// The TS union also includes `INTERACTIVE`, but that's a SabNode extension
/// rather than a Meta-blessed category and only a handful of legacy rows
/// carry it — we keep this enum to the three official Meta categories and
/// recommend callers that encounter `INTERACTIVE` migrate them to one of
/// these.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TemplateCategory {
    Marketing,
    Utility,
    Authentication,
}

/// A WhatsApp message template under a project.
///
/// Mongo collection: `templates`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Owning project.
    pub project_id: ObjectId,

    /// Template name. Globally unique within a (project, language) tuple.
    pub name: String,

    /// BCP-47-ish language code as Meta uses them (`en_US`, `hi`, `pt_BR`).
    pub language: String,

    /// Approval state. See [`TemplateStatus`].
    pub status: TemplateStatus,

    /// Category. See [`TemplateCategory`].
    pub category: TemplateCategory,

    /// Raw template components in Meta's wire shape (header / body / footer /
    /// buttons). Kept as opaque JSON because the structure is variable and
    /// is best decoded by the `wachat-meta-dto` crate when actually sending.
    pub components: serde_json::Value,

    /// Meta-assigned template id. `Option` because templates can be drafted
    /// locally before being submitted to Meta. The TS calls this `metaId`.
    #[serde(rename = "metaId")]
    pub meta_template_id: Option<String>,

    /// Created-at timestamp. Optional in the TS schema (`createdAt?: Date`)
    /// because some legacy rows pre-date the field — we honor that here.
    pub created_at: Option<DateTime<Utc>>,
}
