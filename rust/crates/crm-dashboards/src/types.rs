//! On-disk shape of a `crm_dashboards` document.
//!
//! `layout` and `widgets` are flexible JSON blobs (positions, sizes,
//! component refs, settings) so we keep them as `bson::Document` and
//! `Vec<bson::Document>` instead of strongly typing every shape.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmDashboard {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant scope — owning user.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Free-form layout config (grid columns, breakpoints, gridLayout RGL, etc.).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout: Option<Document>,

    /// Widget list — each widget is a free-form JSON object.
    #[serde(default)]
    pub widgets: Vec<Document>,

    /// Is this the user's default dashboard?
    #[serde(default)]
    pub is_default: bool,

    /// Visibility: `"private"` (default) | `"shared"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,

    /// Optional explicit owner (mirrors `userId` for shared dashboards).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
