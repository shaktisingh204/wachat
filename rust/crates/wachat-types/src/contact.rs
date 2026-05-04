//! Mirrors `Contact` from `src/lib/definitions.ts` (line ~2241).
//!
//! Stored in the `contacts` Mongo collection. The TS type is dual-purpose
//! (used by both wachat conversation views and CRM-adjacent code paths).
//! We model the **wachat subset** here: identity, ownership, custom
//! variables, timestamps. Active-flow / kanban-status / agent-assignment
//! state can be modeled separately in the flow-engine and CRM crates if/when
//! they're ported.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A WhatsApp contact tied to a project. The phone identity is `wa_id`
/// (Meta's E.164-without-`+` form); we expose it as `phone` here because
/// every wachat handler reasons in terms of "the contact's phone".
///
/// Mongo collection: `contacts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaContact {
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Owning project. FK into `projects`.
    pub project_id: ObjectId,

    /// Contact phone in Meta's `wa_id` form (digits only, no `+`).
    /// In the TS this lives under the `waId` field — we surface it as
    /// `phone` in Rust, but serde keeps the wire-name `phone` so callers
    /// reading older docs that used `waId` will need to project the field
    /// at query time. For new writes, prefer `phone`.
    pub phone: String,

    /// Display name. WhatsApp may not always provide one for new contacts.
    pub name: Option<String>,

    /// Email, if collected (e.g. via a flow input or imported CSV).
    pub email: Option<String>,

    /// Free-form tag list. Tags themselves live in the project's `tags`
    /// catalog; this is a denormalized pointer list of tag names/ids the
    /// contact is currently tagged with. Stored as strings for simplicity —
    /// callers can model richer tag references in their own DTOs.
    #[serde(default)]
    pub tags: Vec<String>,

    /// Per-contact dynamic variables used by templates and flows. The TS
    /// schema is `Record<string, string>` but the runtime tolerates richer
    /// values, so we keep it as a `serde_json::Value` here. Callers should
    /// treat it as opaque key/value bag.
    #[serde(default)]
    pub variables: serde_json::Value,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
