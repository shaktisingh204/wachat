//! On-disk shape of a `crm_roles` document.

use std::collections::BTreeMap;

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// Per-module CRUD flag block. The map key on `CrmRole::permissions` is the
/// module identifier from `src/lib/permission-modules.ts` (e.g. `crm_lead`,
/// `crm_invoice`).
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RolePermissionFlags {
    #[serde(default)]
    pub view: bool,
    #[serde(default)]
    pub create: bool,
    #[serde(default)]
    pub edit: bool,
    #[serde(default)]
    pub delete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmRole {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub slug: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub is_admin: bool,

    /// Map of `module_key -> { view, create, edit, delete }`. `BTreeMap`
    /// keeps the on-disk ordering deterministic, which keeps audit diffs
    /// readable.
    #[serde(default)]
    pub permissions: BTreeMap<String, RolePermissionFlags>,

    /// Optional lifecycle flag — `"active"` or `"archived"`. Soft-delete
    /// flips this to `"archived"` when present.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
