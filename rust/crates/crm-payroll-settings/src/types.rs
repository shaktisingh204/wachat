//! On-disk shape of a `crm_payroll_settings` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// A single income-tax bracket. Stored as a free-form sub-document so
/// we can evolve the shape (regime, currency-scoped slabs, etc.)
/// without a schema migration. The TS layer reads/writes the canonical
/// `{ min, max, rate }` triple.
pub type TaxSlab = Document;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPayrollSetting {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM tenant scope. Stamped on rows created through the
    /// project-scoped mount (`/v1/sabcrm/people/payroll-settings`);
    /// absent on legacy user-scoped rows — which are therefore
    /// invisible on the project mount (accepted clean-start per
    /// people-suite §2.1.7; no `userId` fallback, that would
    /// cross-tenant-leak).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_name: Option<String>,

    /// Employee PF deduction rate (percent, e.g. `12.0`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pf_rate: Option<f64>,
    /// Employee ESI deduction rate (percent, e.g. `0.75`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub esi_rate: Option<f64>,

    /// `"monthly"` | `"weekly"` | `"biweekly"`.
    pub pay_cycle: String,

    /// Income-tax slab table; arbitrary `{ min, max, rate, ... }` docs.
    #[serde(default)]
    pub tax_slabs: Vec<TaxSlab>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_currency: Option<String>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
