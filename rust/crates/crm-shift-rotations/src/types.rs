//! On-disk shape of a `crm_shift_rotations` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// One entry in a rotation pattern. `day_offset` is a 0-based offset within
/// the cycle, e.g. for a 7-day weekly cycle valid offsets are 0..=6.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RotationDay {
    pub day_offset: i32,
    pub shift_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shift_name: Option<String>,
    #[serde(default)]
    pub is_off: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmShiftRotation {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM tenant scope. Stamped on rows created through the
    /// project-scoped mount (`/v1/sabcrm/people/shift-rotations`);
    /// absent on legacy user-scoped rows — which are therefore invisible
    /// on the project mount (accepted clean-start per people-suite
    /// §2.1.7; no `userId` fallback, that would cross-tenant-leak).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_id: Option<ObjectId>,

    /// Recurring pattern of shifts within one cycle.
    #[serde(default)]
    pub pattern: Vec<RotationDay>,

    /// Total length of the pattern, e.g. 7 for a weekly rotation.
    pub cycle_days: i32,

    pub start_date: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<BsonDateTime>,

    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"paused"` | `"completed"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_true() -> bool {
    true
}
