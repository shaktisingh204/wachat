//! On-disk shape of a `crm_purchase_leads` (a.k.a. hire requisition) document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmHire {
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

    /// `"sourcing"` | `"shortlisted"` | `"negotiating"` | `"closed"`
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
    /// `"open"` | `"won"` | `"lost"` | `"archived"`
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
