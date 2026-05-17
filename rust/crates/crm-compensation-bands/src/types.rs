//! On-disk shape of a `crm_compensation_bands` document.
//!
//! Field names are snake_case to match the TS source-of-truth in
//! `src/app/actions/crm-compensation-bands.actions.ts`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CrmCompensationBand {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_salary: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_salary: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mid_salary: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role_title: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub perks: Vec<String>,

    #[serde(default)]
    pub is_active: bool,

    /// `"draft"` | `"active"` | `"inactive"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
