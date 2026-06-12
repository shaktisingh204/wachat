//! On-disk shape of a `crm_tds_records` document.
//!
//! Mirrors `src/app/actions/crm-tds.actions.ts`. `employeeId` is stored
//! as a string (the TS action does not coerce it to ObjectId — payroll
//! employees can be cross-imported with non-Mongo ids).

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTdsRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM tenancy scope — stamped on documents created through the
    /// project (`/v1/sabcrm/finance/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<String>,
    pub employee_name: String,

    /// e.g. `"2025-26"`.
    pub financial_year: String,
    /// `"Q1"` | `"Q2"` | `"Q3"` | `"Q4"`.
    pub quarter: String,

    #[serde(default)]
    pub tds_amount: f64,
    #[serde(default)]
    pub gross_amount: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub certificate_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deposit_challan_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deposit_date: Option<BsonDateTime>,

    /// `"pending"` | `"deposited"` | `"filed"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt")]
    pub updated_at: BsonDateTime,
}
