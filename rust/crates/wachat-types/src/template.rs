//! Mirrors `Template` from `src/lib/definitions.ts` (line ~1487).
//!
//! Stored in the `templates` Mongo collection.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Serialize `Option<ObjectId>` as a plain hex string (or `null`) so the
/// JSON shape matches what the TS clients expect. The default Serialize
/// for `Option<ObjectId>` produces `{"$oid": "..."}`, which the TS code
/// reads as `[object Object]` and breaks key/value comparisons.
fn serialize_optional_object_id_as_hex_string<S>(
    v: &Option<ObjectId>,
    s: S,
) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match v {
        Some(oid) => bson::serde_helpers::serialize_object_id_as_hex_string(oid, s),
        None => s.serialize_none(),
    }
}

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
///
/// All fields beyond `_id` are `Option` for resilience against legacy
/// documents that pre-date the current schema or were written by code paths
/// that omitted optional fields. A brittle struct rejects the entire row
/// for one missing field — handlers that need a specific field should
/// surface a `BadRequest` instead.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    // Serialize as a plain hex string so the TS callers can use it as a
    // value/key directly. The default bson ObjectId Serialize impl emits
    // `{"$oid": "..."}`, which collapses to "[object Object]" on the JS
    // side and breaks any `t._id === ...` / `key={t._id.toString()}`
    // comparison (every item ends up sharing the same value).
    #[serde(
        rename = "_id",
        serialize_with = "bson::serde_helpers::serialize_object_id_as_hex_string"
    )]
    pub id: ObjectId,

    /// Owning project. Optional only because some very old rows imported
    /// from legacy backups may have lost it.
    #[serde(default, serialize_with = "serialize_optional_object_id_as_hex_string")]
    pub project_id: Option<ObjectId>,

    /// Template name. Globally unique within a (project, language) tuple.
    #[serde(default)]
    pub name: Option<String>,

    /// BCP-47-ish language code as Meta uses them (`en_US`, `hi`, `pt_BR`).
    #[serde(default)]
    pub language: Option<String>,

    /// Approval state. See [`TemplateStatus`]. Stored as a free string so a
    /// rare legacy `INTERACTIVE` value (a SabNode extension) doesn't crash
    /// deserialization for the whole document.
    #[serde(default)]
    pub status: Option<String>,

    /// Category. See [`TemplateCategory`]. Stored as a free string for the
    /// same reason as `status`.
    #[serde(default)]
    pub category: Option<String>,

    /// Raw template components in Meta's wire shape (header / body / footer /
    /// buttons). Kept as opaque JSON because the structure is variable and
    /// is best decoded by the `wachat-meta-dto` crate when actually sending.
    #[serde(default)]
    pub components: serde_json::Value,

    /// Meta-assigned template id. `Option` because templates can be drafted
    /// locally before being submitted to Meta. The TS calls this `metaId`.
    #[serde(default, rename = "metaId")]
    pub meta_template_id: Option<String>,

    /// Created-at timestamp. Optional in the TS schema (`createdAt?: Date`)
    /// because some legacy rows pre-date the field — we honor that here.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub created_at: Option<DateTime<Utc>>,
}
