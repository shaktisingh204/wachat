//! On-disk shape of a `crm_contracts` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmContract {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub contract_no: String,
    pub title: String,
    pub party_name: String,

    /// `"nda"` | `"msa"` | `"sow"` | `"service"` | `"other"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub party_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub party_phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signatory_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signatory_email: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deliverables: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_proposal_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_proposal_number: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expiry_date: Option<BsonDateTime>,

    #[serde(default)]
    pub auto_renew: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub renewal_notice_days: Option<i32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,

    /// `"none"` | `"docusign"` | `"adobesign"` etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub esign_provider: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<String>,

    /// `"draft"` | `"active"` | `"expired"` | `"cancelled"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
