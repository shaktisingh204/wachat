//! On-disk shape of a `crm_time_logs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// A single time-tracking log entry.
///
/// Fields use camelCase wire form. Either the dedicated foreign keys
/// (`projectId` / `taskId` / `issueId`) OR the polymorphic
/// `(entityKind, entityId)` pair can be populated — both are optional so
/// ad-hoc "what am I doing right now" entries are allowed.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTimeLog {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Tenant root — owner of this row.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM tenant scope — **crate-local exception** (people-suite
    /// WI-13): on this entity `projectId` already means the WORK
    /// project FK (the CRM project entity the time was logged against),
    /// so the tenant scope lands as `tenantProjectId` instead. Stamped
    /// on rows created through the project-scoped mount
    /// (`/v1/sabcrm/people/time-logs`); absent on legacy rows — which
    /// are therefore invisible on the project mount (accepted
    /// clean-start; no `userId` fallback).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_project_id: Option<ObjectId>,

    /// Employee logging the time (separate from the tenant owner — an
    /// HR/admin may log on behalf of staff).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_log_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issue_id: Option<ObjectId>,

    /// Polymorphic link kind: `"task"` | `"project_task"` | `"issue"` |
    /// `"ticket"`. Pair with [`entity_id`] when used.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entity_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entity_id: Option<ObjectId>,

    pub started_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,

    /// Wall-clock duration in minutes. May be `0.0` while a timer is
    /// still `running`; once stopped it must be `> 0`.
    pub duration_minutes: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default)]
    pub is_billable: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hourly_rate: Option<f64>,

    /// `"running"` | `"stopped"` | `"approved"` | `"rejected"` |
    /// `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
