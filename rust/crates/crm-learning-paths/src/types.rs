//! On-disk shape of a `crm_learning_paths` document.
//!
//! The legacy TS writer uses `snake_case` for several keys
//! (`target_audience`, `duration_weeks`, `is_mandatory`). Rust mirrors the
//! wire format with `serde(rename)` so the BFF can read existing rows
//! without a backfill.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CrmLearningPath {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `"all"` | `"department"` | `"role"`.
    #[serde(rename = "target_audience")]
    pub target_audience: String,

    /// References to `crm_trainings` documents (string ids). The legacy
    /// writer stores these as a flat `string[]` — we keep that shape so we
    /// don't have to migrate existing rows. If we ever want richer nested
    /// metadata (e.g. ordered steps with completion criteria), a follow-up
    /// crate can co-evolve a `steps` field alongside.
    #[serde(default)]
    pub trainings: Vec<String>,

    #[serde(
        rename = "duration_weeks",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub duration_weeks: Option<i32>,
    #[serde(rename = "is_mandatory", default)]
    pub is_mandatory: bool,

    /// `"draft"` | `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
