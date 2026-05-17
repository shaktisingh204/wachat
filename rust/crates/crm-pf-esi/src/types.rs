//! On-disk shape of a `crm_pf_esi_records` document.
//!
//! Mirrors `src/app/actions/crm-pf-esi.actions.ts`. `month` is a string
//! in `YYYY-MM` format. `employeeId` is stored as a string (the TS action
//! does not coerce it to ObjectId).

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPfEsiRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<String>,
    pub employee_name: String,

    /// Period, `YYYY-MM`.
    pub month: String,

    #[serde(default)]
    pub pf_employer: f64,
    #[serde(default)]
    pub pf_employee: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pf_uan: Option<String>,

    #[serde(default)]
    pub esi_employer: f64,
    #[serde(default)]
    pub esi_employee: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub esi_ic_number: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub challan_number: Option<String>,
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
