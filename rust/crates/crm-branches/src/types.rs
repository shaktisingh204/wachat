//! On-disk shape of a `crm_branches` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmBranch {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub name: String,

    /// Short alphanumeric tag (e.g. "BLR", "DEL"). Optional.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub postal_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_id: Option<ObjectId>,
    /// `"hq"` | `"sales"` | `"warehouse"` | `"factory"` | `"branch"` etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
    /// `true` if this branch is the tenant's head office. At most one
    /// branch per tenant should carry this flag — enforcement lives at
    /// the action layer (Mongo unique partial index recommended).
    #[serde(
        rename = "isHeadOffice",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub is_head_office: Option<bool>,
    /// Tenant-toggleable activation flag — independent of `status`
    /// soft-delete. Lets a tenant disable a branch from being picked
    /// without archiving it.
    #[serde(rename = "isActive", default, skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}
