//! On-disk shape of a `crm_salary_structures` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmSalaryStructure {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// FK into `crm_employees`.
    pub employee_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,

    /// When this structure takes effect.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_from: Option<BsonDateTime>,

    /// Mandatory monthly basic pay.
    pub basic: f64,
    /// House Rent Allowance.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hra: Option<f64>,
    /// Dearness Allowance.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub da: Option<f64>,
    /// Catch-all earnings bucket.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub other_allowances: Option<f64>,

    /// Employer's Provident Fund contribution.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pf_employer: Option<f64>,
    /// Employee's Provident Fund contribution.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pf_employee: Option<f64>,
    /// Employee State Insurance.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub esi: Option<f64>,
    /// Professional Tax.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub professional_tax: Option<f64>,

    /// Optional precomputed totals — when supplied they are persisted as-is.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gross: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub net: Option<f64>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
