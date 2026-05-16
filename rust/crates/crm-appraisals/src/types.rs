//! On-disk shape of a `crm_appraisal_reviews` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppraisalKpi {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kpi_id: Option<ObjectId>,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub achieved: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmAppraisalReview {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub employee_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,

    #[serde(default)]
    pub kpis: Vec<AppraisalKpi>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overall_rating: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comments: Option<String>,

    /// `"draft"` | `"submitted"` | `"finalized"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finalized_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
