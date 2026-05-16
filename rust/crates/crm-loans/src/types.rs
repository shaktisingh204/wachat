//! On-disk shape of a `crm_loans` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmLoan {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub party_name: String,
    /// `"taken"` (we owe) | `"given"` (we lent).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    pub principal: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interest_rate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenure_months: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emi: Option<f64>,
    #[serde(default)]
    pub outstanding: f64,
    #[serde(default)]
    pub paid: f64,

    /// `"active"` | `"closed"` | `"defaulted"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
