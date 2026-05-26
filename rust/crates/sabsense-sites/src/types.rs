//! On-disk shape of a `pagesense_sites` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PagesenseSite {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Human-friendly name shown in the dashboard.
    pub name: String,
    /// Apex domain (or subdomain) the snippet is allowed to run on.
    pub domain: String,
    /// Random opaque key embedded in the snippet's `data-snippet-key`
    /// attribute. Validated server-side on every ingest call.
    pub snippet_key: String,

    /// Optional screenshot URL used by the heatmap overlay until a
    /// proper screenshot worker is wired in. Pointed at a SabFiles asset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub screenshot_url: Option<String>,

    /// Site-wide tracking toggle. Lets a tenant pause ingestion without
    /// uninstalling the snippet.
    #[serde(rename = "isActive", default, skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
    /// `"active"` | `"archived"`. Soft-delete flag.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}
