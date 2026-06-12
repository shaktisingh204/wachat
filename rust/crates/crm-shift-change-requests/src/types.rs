//! On-disk shape of a `crm_shift_change_requests` document.
//!
//! Field names are intentionally `snake_case` (no `rename_all`) to match
//! the existing TS server-action shape (`employee_id`, `current_shift_id`,
//! `requested_shift_id`, `effective_date`, `approver_id`, `approved_at`,
//! `response_notes`).

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CrmShiftChangeRequest {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM tenant scope. Stamped on rows created through the
    /// project-scoped mount (`/v1/sabcrm/people/shift-change-requests`);
    /// absent on legacy user-scoped rows — invisible on the project
    /// mount by design (people-suite §2.1.7; no `userId` fallback).
    /// Explicitly renamed because this struct intentionally has no
    /// `rename_all` (snake_case wire), but the tenant key is camelCase
    /// across the suite.
    #[serde(rename = "projectId", default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    pub employee_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,

    pub current_shift_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_shift_name: Option<String>,

    pub requested_shift_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requested_shift_name: Option<String>,

    pub effective_date: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,

    /// `"pending"` | `"approved"` | `"rejected"` | `"cancelled"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
