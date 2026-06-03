//! On-disk shape of a `crm_asset_assignments` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// Lifecycle of an assignment.
///
/// `Active` ↔ `assigned`  (asset is in employee's possession)
/// `Returned`             (employee returned the asset)
/// `lost` / `damaged`     (recorded for audit; remains non-archived)
/// `archived`             (soft-deleted)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmAssetAssignment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Reference to a `crm_assets` document — stored as a string because
    /// assets use string `_id`s in the existing crate.
    #[serde(rename = "asset_id")]
    pub asset_id: String,
    #[serde(
        rename = "asset_name",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub asset_name: Option<String>,

    /// Reference to an employee — also a string for symmetry with TS.
    #[serde(rename = "employee_id")]
    pub employee_id: String,
    #[serde(
        rename = "employee_name",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub employee_name: Option<String>,

    #[serde(
        rename = "assigned_at",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub assigned_at: Option<BsonDateTime>,
    #[serde(
        rename = "returned_at",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub returned_at: Option<BsonDateTime>,

    /// `"new" | "good" | "fair" | "poor" | "damaged"`.
    #[serde(
        rename = "condition_at_assign",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub condition_at_assign: Option<String>,
    #[serde(
        rename = "condition_at_return",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub condition_at_return: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"assigned" | "returned" | "lost" | "damaged" | "archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
