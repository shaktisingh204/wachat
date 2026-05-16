//! On-disk shape of a `crm_saved_views` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmSavedView {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Display name of the saved view.
    pub name: String,

    /// Which list entity this view belongs to (e.g. `"leads"`, `"deals"`,
    /// `"invoices"`). Mirrors the legacy `entityKey` field.
    pub entity: String,

    /// Free-form filter blob — Mongo find filter, raw passthrough.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filters: Option<Document>,

    /// Ordered list of visible column ids.
    #[serde(default)]
    pub columns: Vec<String>,

    /// Free-form sort blob — typically `{ field: 1|-1 }` or array form
    /// serialised as a doc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort: Option<Document>,

    /// `"private"` (owner-only) | `"shared"` (whole tenant).
    #[serde(default = "default_scope")]
    pub scope: String,

    #[serde(default)]
    pub is_default: bool,

    /// Owner of the view inside the tenant. May differ from `user_id`
    /// for legacy docs but typically matches.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,

    /// `"active"` | `"archived"`.
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_scope() -> String {
    "private".to_owned()
}

fn default_status() -> String {
    "active".to_owned()
}
