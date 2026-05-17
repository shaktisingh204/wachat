//! On-disk shape of a `crm_professional_tax_records` document.
//!
//! Mirrors `src/app/actions/crm-professional-tax.actions.ts`. `month` is
//! a `YYYY-MM` string. `slabApplied` is a human-readable slab descriptor
//! stamped at save time to make historical rows immune to later slab edits.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmProfessionalTaxRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<String>,
    pub employee_name: String,

    /// e.g. `"Karnataka"`.
    pub state: String,
    /// `YYYY-MM`.
    pub month: String,

    #[serde(default)]
    pub gross_salary: f64,
    #[serde(default)]
    pub pt_amount: f64,

    /// Stamped descriptor of the slab in force at save time, e.g.
    /// `"KA: ₹15,000–₹24,999 → ₹200/mo"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slab_applied: Option<String>,

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
