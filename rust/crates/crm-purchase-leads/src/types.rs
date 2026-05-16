//! On-disk shape of a `crm_purchase_leads` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPurchaseLead {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_candidate: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required_by: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quantity: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub estimated_budget: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub specs: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner: Option<String>,

    /// `"sourcing"` | `"shortlisted"` | `"negotiation"` | `"awarded"` | `"closed"`.
    pub stage: String,
    /// `"open"` | `"won"` | `"lost"` | `"cancelled"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
