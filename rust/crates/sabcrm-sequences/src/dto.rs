//! Wire-format DTOs for the SabCRM sequences (cadences) HTTP surface.
//!
//! Mirrors the persisted `sabcrm_sequences` / `sabcrm_sequence_enrollments`
//! document shapes (see the crate docs). List / single responses are typed as
//! `serde_json::Value` — the stored document is returned verbatim (cleaned via
//! `document_to_clean_json`, `_id` relabelled to `id`), matching the sibling
//! `sabcrm-approvals` wire convention.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ===========================================================================
// Typed sequence shape (validated on create / structural update)
// ===========================================================================

/// What one sequence step does.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SequenceStepKind {
    /// Send a templated email to the enrolled record's email address.
    Email,
    /// Create a TASK activity targeting the enrolled record.
    Task,
    /// Pause the cadence for `waitDays` before the next step.
    Wait,
}

/// Email payload of an `email` step. Either a stored `sabcrm-templates`
/// template (`templateId`) or an inline `subject` / `body` pair — both are
/// interpolated against the enrolled record's data through the
/// `sabcrm-templates` `{{variable}}` engine at execution time.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SequenceEmailConfig {
    /// Id of a stored `sabcrm_templates` template to render.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<String>,
    /// Inline subject template (used when no `templateId`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    /// Inline body template (used when no `templateId`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
}

/// Task payload of a `task` step.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SequenceTaskConfig {
    /// Task title (may carry `{{variable}}` placeholders).
    pub title: String,
    /// Days from execution until the task is due (omitted = no due date).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_in_days: Option<u32>,
}

/// One ordered step in a sequence.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SequenceStep {
    /// Stable per-step id (the builder mints `step_<uuid>`).
    pub id: String,
    /// What the step does — `email` / `task` / `wait`.
    pub kind: SequenceStepKind,
    /// Email config — required when `kind == email`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<SequenceEmailConfig>,
    /// Task config — required when `kind == task`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task: Option<SequenceTaskConfig>,
    /// Pause length in days — required (>0) when `kind == wait`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wait_days: Option<u32>,
}

/// Sequence-level behaviour switches.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SequenceSettings {
    /// Auto-unenroll a record when it replies to a sequence email.
    /// Defaults to `true`.
    #[serde(default = "default_true")]
    pub unenroll_on_reply: bool,
    /// Auto-unenroll when the record's stage changes. Semantics:
    /// absent → never; `[]` → ANY stage change unenrolls; non-empty → only
    /// when the new stage id is in the list.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unenroll_on_stage_change: Option<Vec<String>>,
}

impl Default for SequenceSettings {
    fn default() -> Self {
        Self {
            unenroll_on_reply: true,
            unenroll_on_stage_change: None,
        }
    }
}

fn default_true() -> bool {
    true
}

// ===========================================================================
// Sequence CRUD inputs
// ===========================================================================

/// `GET /` query params — list the sequences for one project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Narrow to one lifecycle status (`active` / `paused`).
    #[serde(default)]
    pub status: Option<String>,
    /// 1-based page number for offset pagination. Defaults to 1.
    #[serde(default)]
    pub page: Option<u64>,
    /// Page size. Defaults to 50, capped at 200.
    #[serde(default)]
    pub limit: Option<i64>,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a sequence. Steps are validated against
/// [`SequenceStep`]; `status` defaults to `active`, `settings` to
/// `{ unenrollOnReply: true }`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSequenceInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Human label — required, non-empty.
    pub name: String,
    /// Ordered step list. Defaults to `[]`.
    #[serde(default)]
    pub steps: Option<Vec<SequenceStep>>,
    /// Behaviour switches. Defaults to `{ unenrollOnReply: true }`.
    #[serde(default)]
    pub settings: Option<SequenceSettings>,
    /// Lifecycle status — `active` (default) / `paused`.
    #[serde(default)]
    pub status: Option<String>,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId` / `_id`) is `$set` verbatim; `updatedAt` is always
/// bumped. `steps` / `settings` / `status` are validated when present.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSequenceInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

// ===========================================================================
// Enrollment inputs
// ===========================================================================

/// `POST /{id}/enroll` body — enroll one or more records into the sequence.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnrollInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Funnel object slug the records belong to (e.g. `"leads"`).
    pub object_slug: String,
    /// Hex `_id`s of the records to enroll (in `sabcrm_records`).
    pub record_ids: Vec<String>,
}

/// `POST /enrollments/{id}/unenroll` body — manually stop one enrollment.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UnenrollInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional free-text reason recorded on the enrollment history.
    #[serde(default)]
    pub reason: Option<String>,
}

/// `GET /enrollments` query params — list enrollments for one project,
/// optionally narrowed by sequence / record / status, paginated.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnrollmentListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Narrow to one sequence (hex id, as stored).
    #[serde(default)]
    pub sequence_id: Option<String>,
    /// Narrow to one funnel object slug (e.g. `"leads"`).
    #[serde(default)]
    pub object_slug: Option<String>,
    /// Narrow to one record (hex id, as stored).
    #[serde(default)]
    pub record_id: Option<String>,
    /// Narrow to one lifecycle status
    /// (`active` / `completed` / `unenrolled` / `failed`).
    #[serde(default)]
    pub status: Option<String>,
    /// 1-based page number for offset pagination. Defaults to 1.
    #[serde(default)]
    pub page: Option<u64>,
    /// Page size. Defaults to 50, capped at 200.
    #[serde(default)]
    pub limit: Option<i64>,
}

// ===========================================================================
// Responses
// ===========================================================================

/// Response body for `GET /` — one page of raw sequence documents plus the
/// pagination envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub sequences: Vec<Value>,
    /// Total sequences matching the filter across all pages.
    pub total: u64,
    /// Resolved 1-based page number for this response.
    pub page: u64,
    /// Resolved page size (after default + cap clamping).
    pub limit: u64,
}

/// Response body for `GET /{id}` / `POST /` / `PATCH /{id}` — a single raw
/// sequence document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SequenceResponse {
    #[schema(value_type = Object)]
    pub sequence: Value,
}

/// Response body for `POST /{id}/enroll` — the enrollments created plus
/// created / skipped counters (records already actively enrolled are skipped,
/// not duplicated).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnrollResponse {
    #[schema(value_type = Vec<Object>)]
    pub enrollments: Vec<Value>,
    /// Records newly enrolled by this call.
    pub created: u64,
    /// Records skipped because an active enrollment already existed.
    pub skipped: u64,
}

/// Response body for `GET /enrollments` — one page of raw enrollment
/// documents plus the pagination envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnrollmentListResponse {
    #[schema(value_type = Vec<Object>)]
    pub enrollments: Vec<Value>,
    /// Total enrollments matching the filter across all pages.
    pub total: u64,
    /// Resolved 1-based page number for this response.
    pub page: u64,
    /// Resolved page size (after default + cap clamping).
    pub limit: u64,
}

/// Response body for `POST /enrollments/{id}/unenroll` — the updated raw
/// enrollment document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnrollmentResponse {
    #[schema(value_type = Object)]
    pub enrollment: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

// ===========================================================================
// tests — serde defaults stay stable (the scheduler depends on them)
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// `settings` omitted entirely → `unenrollOnReply` defaults TRUE and no
    /// stage-change list is implied.
    #[test]
    fn settings_default_unenroll_on_reply_true() {
        let s: SequenceSettings = serde_json::from_value(json!({})).expect("parse");
        assert!(s.unenroll_on_reply, "unenrollOnReply must default to true");
        assert!(s.unenroll_on_stage_change.is_none());
        assert_eq!(s, SequenceSettings::default());
    }

    /// An explicit `false` is honoured (the default never overrides it).
    #[test]
    fn settings_explicit_false_round_trips() {
        let s: SequenceSettings =
            serde_json::from_value(json!({ "unenrollOnReply": false })).expect("parse");
        assert!(!s.unenroll_on_reply);
        let back = serde_json::to_value(&s).expect("ser");
        assert_eq!(back.get("unenrollOnReply"), Some(&json!(false)));
    }

    /// `unenrollOnStageChange` round-trips camelCase with its stage ids.
    #[test]
    fn settings_stage_change_list_round_trips() {
        let s: SequenceSettings = serde_json::from_value(json!({
            "unenrollOnStageChange": ["won", "lost"]
        }))
        .expect("parse");
        assert_eq!(
            s.unenroll_on_stage_change.as_deref(),
            Some(["won".to_owned(), "lost".to_owned()].as_slice())
        );
        let back = serde_json::to_value(&s).expect("ser");
        assert_eq!(back.get("unenrollOnStageChange"), Some(&json!(["won", "lost"])));
    }

    /// Each step kind parses with its camelCase payload keys.
    #[test]
    fn steps_parse_all_kinds() {
        let steps: Vec<SequenceStep> = serde_json::from_value(json!([
            { "id": "s1", "kind": "email", "email": { "templateId": "tpl1" } },
            { "id": "s2", "kind": "wait", "waitDays": 3 },
            { "id": "s3", "kind": "task", "task": { "title": "Call {{name}}", "dueInDays": 2 } }
        ]))
        .expect("parse");
        assert_eq!(steps.len(), 3);
        assert_eq!(steps[0].kind, SequenceStepKind::Email);
        assert_eq!(
            steps[0].email.as_ref().and_then(|e| e.template_id.as_deref()),
            Some("tpl1")
        );
        assert_eq!(steps[1].kind, SequenceStepKind::Wait);
        assert_eq!(steps[1].wait_days, Some(3));
        assert_eq!(steps[2].kind, SequenceStepKind::Task);
        assert_eq!(steps[2].task.as_ref().map(|t| t.due_in_days), Some(Some(2)));
    }

    /// An unknown step kind is a hard parse error (sequences must be runnable).
    #[test]
    fn unknown_step_kind_rejected() {
        let res: std::result::Result<SequenceStep, _> =
            serde_json::from_value(json!({ "id": "s1", "kind": "carrier_pigeon" }));
        assert!(res.is_err());
    }

    /// Wire serialization stays camelCase (`waitDays`, `dueInDays`, ...).
    #[test]
    fn step_serializes_camel_case() {
        let step = SequenceStep {
            id: "s1".to_owned(),
            kind: SequenceStepKind::Wait,
            email: None,
            task: None,
            wait_days: Some(2),
        };
        let v = serde_json::to_value(&step).expect("ser");
        assert_eq!(v, json!({ "id": "s1", "kind": "wait", "waitDays": 2 }));
    }
}
