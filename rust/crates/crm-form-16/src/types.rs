//! On-disk shape of a `crm_form_16` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmForm16 {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<String>,
    pub employee_name: String,
    pub financial_year: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tan_of_employer: Option<String>,

    #[serde(default)]
    pub total_income: f64,
    #[serde(default)]
    pub tax_deducted: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_url: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub generated_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub generated_by: Option<String>,

    /// `"draft"` | `"generated"` | `"issued"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
