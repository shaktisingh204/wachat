//! On-disk shape of a `crm_gift_cards` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmGiftCard {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,
    pub code: String,
    pub value: f64,
    pub balance: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_to: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_to_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expiry_date: Option<BsonDateTime>,
    #[serde(default)]
    pub transferable: bool,
    /// `"active"` | `"redeemed"` | `"expired"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
