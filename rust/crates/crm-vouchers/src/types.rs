//! On-disk shape of a `crm_voucher_books` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmVoucherBook {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM tenancy scope — stamped on documents created through the
    /// project (`/v1/sabcrm/finance/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub name: String,
    /// `"payment"` | `"receipt"` | `"contra"` | `"journal"` | `"purchase"` | `"sales"` etc.
    pub r#type: String,

    #[serde(default)]
    pub is_default: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prefix: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suffix: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub starting_number: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub padding: Option<i32>,

    /// `"none"` | `"yearly"` | `"monthly"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reset_frequency: Option<String>,

    #[serde(default)]
    pub approval_required: bool,
    #[serde(default = "default_active")]
    pub is_active: bool,

    /// `"active"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_active() -> bool {
    true
}
