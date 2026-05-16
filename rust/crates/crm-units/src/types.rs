//! On-disk shape of a `crm_units` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmUnit {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Human-readable unit name (e.g. "Kilogram", "Pieces").
    pub name: String,
    /// Short symbol/code shown next to quantities (e.g. "kg", "pcs", "box").
    pub code: String,

    /// `"weight"` | `"length"` | `"volume"` | `"count"` | `"time"` | other.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit_type: Option<String>,

    /// Pointer to a base unit in the same collection. When set, this unit
    /// is a derived unit and `conversion_factor` describes the relation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_unit_id: Option<ObjectId>,
    /// Multiplier to convert one of this unit into its base unit (e.g.
    /// `1000.0` for "kg" if base is "g").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversion_factor: Option<f64>,

    /// Default unit-of-measure flag for the tenant.
    #[serde(default)]
    pub is_default: bool,
    /// Soft-active flag. New units default to active.
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_true() -> bool {
    true
}
