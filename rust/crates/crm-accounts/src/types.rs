//! On-disk shape of a `crm_accounts` document.
//!
//! Mirrors the TS `CrmAccount` interface in `src/lib/definitions.ts`. Keep
//! the two in lock-step: field name additions/removals MUST land in both
//! places in the same change.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmAccount {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub name: String,

    /* ----- optional identifying fields ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,

    /* ----- tax / commerce ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shipping_address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub annual_revenue: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    /// Free-form to accept legacy values ('Net 30', etc.).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_terms: Option<String>,
    /// Free-form to accept legacy values ('strategic', 'key', …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    /* ----- relationships ----- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub contact_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub deal_ids: Vec<ObjectId>,

    /* ----- presentation ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    /// SabFiles refs (per project policy).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<AccountNote>,

    /* ----- audit ----- */
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
    /// `"active"` | `"archived"`. Free-form string to keep parity with TS.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AccountNote {
    pub content: String,
    pub created_at: BsonDateTime,
    pub author: String,
}
