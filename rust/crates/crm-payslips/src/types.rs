//! On-disk shape of a `crm_payslips` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPayslip {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM tenant scope. Stamped on rows created through the
    /// project-scoped mount (`/v1/sabcrm/people/payslips`); absent on
    /// legacy user-scoped rows — which are therefore invisible on the
    /// project mount (accepted clean-start per people-suite §2.1.7; no
    /// `userId` fallback, that would cross-tenant-leak).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    pub employee_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,

    pub pay_period: BsonDateTime,

    pub basic: f64,
    pub hra: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allowances: Option<f64>,
    pub deductions: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pf: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub esi: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax: Option<f64>,

    pub gross: f64,
    pub net: f64,

    /// `"draft"` | `"issued"` | `"paid"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
