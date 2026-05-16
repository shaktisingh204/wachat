//! On-disk shape of a `crm_pt_slabs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPtSlab {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Indian state name (e.g. `"Maharashtra"`, `"Karnataka"`).
    pub state: String,

    /// `"male"` | `"female"` | `"any"`. `None` means applies to any gender
    /// (slabs imported from legacy data may omit this field).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gender: Option<String>,

    /// Lower bound of monthly salary that this slab applies to.
    pub min_amount: f64,

    /// Upper bound of monthly salary; `None` means "and above".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_amount: Option<f64>,

    /// Monthly professional tax due for incomes in `[min_amount, max_amount]`.
    pub tax_amount: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_from: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
