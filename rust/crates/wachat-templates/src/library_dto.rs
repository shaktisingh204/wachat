//! DTO for the `library_templates` Mongo collection.
//!
//! Mirrors the TS `LibraryTemplate` type from `src/lib/definitions.ts`
//! (line ~2337):
//!
//! ```ts
//! export type LibraryTemplate = Omit<
//!     Template,
//!     '_id' | 'projectId' | 'metaId' | 'status' | 'qualityScore'
//! > & {
//!     _id?: ObjectId;
//!     isCustom?: boolean;
//!     createdAt?: Date;
//! };
//! ```
//!
//! In other words: a template **without** the per-project runtime state
//! fields, plus an optional `_id` (because `premadeTemplates` items have no
//! id) and an optional `isCustom` marker the admin UI uses to distinguish
//! Mongo-backed entries from the bundled premade list.
//!
//! We only use this struct for documents pulled out of Mongo, so all
//! optional fields are honoured but the typical row will have `_id` set and
//! `isCustom: true`.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use wachat_types::template::TemplateCategory;

/// One entry from the shared `library_templates` collection.
///
/// Field set is the TS `Template` minus `projectId / metaId / status /
/// qualityScore`, plus the optional `isCustom` and `createdAt` fields the TS
/// type adds back.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryTemplate {
    /// Mongo document id. Optional because the bundled `premadeTemplates`
    /// list (not handled by this reader) carries no `_id`. Rows pulled from
    /// `library_templates` always have one.
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Template name. Globally unique within `(name, language)` for the
    /// library — the TS sorts by this field on read.
    pub name: String,

    /// Meta category (`MARKETING`, `UTILITY`, `AUTHENTICATION`).
    pub category: TemplateCategory,

    /// Body text. The TS schema carries this denormalized alongside
    /// `components` for legacy reasons; we keep it.
    pub body: String,

    /// BCP-47-ish language code (`en_US`, `hi`, `pt_BR`).
    pub language: String,

    /// Raw template components in Meta's wire shape. Kept opaque — decoding
    /// is the job of `wachat-meta-dto` at send time.
    pub components: serde_json::Value,

    /// Optional sample header media URL (image / video / document preview).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header_sample_url: Option<String>,

    /// Optional template kind (`STANDARD`, `CATALOG_MESSAGE`,
    /// `MARKETING_CAROUSEL`, `LIMITED_TIME_OFFER`). Stored as a free string
    /// to match the TS `type?: ...` union without locking the enum here —
    /// the engine slice that actually dispatches will narrow this.
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,

    /// Optional inline data URI for the header media (used by the editor
    /// before the sample is uploaded).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header_media_data_uri: Option<String>,

    /// Distinguishes user-added library templates from bundled premade
    /// ones. Always `Some(true)` for rows the admin UI inserts.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_custom: Option<bool>,

    /// Created-at — optional because legacy rows pre-date the field.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub created_at: Option<DateTime<Utc>>,
}
