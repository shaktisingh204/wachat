//! DTOs for Request Instance.
//!
//! Canonical persisted shape is [`RequestInstance`]; wire inputs are
//! [`CreateRequestInput`] (POST), [`UpdateRequestInput`] (PATCH — only
//! requester-editable fields), and [`StageDecisionInput`] (POST
//! `/:id/decision` — the approver action endpoint that drives
//! `currentStageIdx` forward).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Audit, Identity};
use serde::{Deserialize, Serialize};

pub const DEFAULT_LIMIT: i64 = 20;
pub const MAX_LIMIT: i64 = 100;

fn is_false(b: &bool) -> bool {
    !*b
}

/// The four canonical request states. Default = `pending`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RequestStatus {
    #[default]
    Pending,
    Approved,
    Rejected,
    Cancelled,
}

/// Live snapshot of the *currently active* stage. Denormalized from the
/// blueprint so the UI can render without a join. Refreshed on every
/// stage advance.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentStageView {
    pub idx: u32,
    pub name: String,
    /// Resolved approver (user OID) for the current stage.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,
    /// What kind of resolver was used at instantiation time —
    /// `user` / `role` / `manager_of_requester` / `conditional`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sla_mins: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestInstance {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    pub blueprint_id: ObjectId,
    /// Denormalized blueprint name so list views don't have to join.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blueprint_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blueprint_category: Option<String>,

    /// Who submitted the request. Almost always equal to `userId`
    /// (the tenant root), but kept as a separate field so the API
    /// surface is symmetric with crm-tickets `requesterId`.
    pub requester_id: ObjectId,

    /// Submitted form values, validated against blueprint.formSchema in
    /// the TS layer.
    #[serde(default)]
    pub form_data: serde_json::Value,

    /// 0-indexed pointer into the blueprint's `stages[]`. Once the
    /// final stage is approved, this is set to `stages.len()` and
    /// `status` flips to `approved`.
    pub current_stage_idx: u32,

    /// Live snapshot of the active stage (denormalized).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_stage: Option<CurrentStageView>,

    pub status: RequestStatus,

    /// Wall-clock deadline for the current stage. Set from
    /// `stages[currentStageIdx].slaMins` whenever the stage advances.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sla_deadline_at: Option<DateTime<Utc>>,

    /// First time the sweep job observed the deadline pass without a
    /// decision. Kept on the row so analytics can count breaches
    /// without re-scanning the action log.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breached_at: Option<DateTime<Utc>>,

    /// Decision timestamp — set when status flips from `pending` to
    /// `approved` / `rejected` / `cancelled`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decided_at: Option<DateTime<Utc>>,

    /// SabFiles attachment manifests (file ids / names / sizes).
    /// Opaque JSON; the TS layer owns the shape.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<serde_json::Value>,

    /// Short human title for list views. Defaults to "<blueprint> by
    /// <requester>" at create time; PATCH-editable until the first
    /// stage decision.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    /// Free-form priority — `low` / `normal` / `high` / `urgent`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,

    /// Soft-delete marker (cancelled requests stay; archived is admin-only).
    #[serde(default, skip_serializing_if = "is_false")]
    pub archived: bool,
}

/* ──────────────────────────── wire inputs ──────────────────────────── */

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Substring search over `title` + `blueprintName`.
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub blueprint_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    /// When `Some(true)` returns only rows where the caller is the
    /// resolved approver of the *currently active* stage. Drives the
    /// "Requests I need to approve" inbox.
    #[serde(default)]
    pub awaiting_me: Option<bool>,
    /// When `Some(true)` returns only the caller's own submissions.
    #[serde(default)]
    pub mine: Option<bool>,
    /// When `Some(true)` returns only SLA-breached rows.
    #[serde(default)]
    pub breached: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRequestInput {
    #[serde(default)]
    pub project_id: Option<String>,

    pub blueprint_id: String,
    #[serde(default)]
    pub blueprint_name: Option<String>,
    #[serde(default)]
    pub blueprint_category: Option<String>,
    #[serde(default)]
    pub form_data: Option<serde_json::Value>,
    /// Pre-resolved current stage view (the TS layer evaluates routing
    /// rules + approver kind before POSTing). The Rust crate stores
    /// what's sent.
    ///
    /// **TODO:** once the Rust-side blueprint resolver lands, this
    /// becomes optional and the handler computes the initial stage
    /// server-side.
    #[serde(default)]
    pub current_stage: Option<CurrentStageView>,
    #[serde(default)]
    pub current_stage_idx: Option<u32>,
    #[serde(default)]
    pub sla_deadline_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub attachments: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRequestInput {
    /// Title is editable until the first decision.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    /// Requester may amend form data while still on stage 0 and pending.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub form_data: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<serde_json::Value>>,
    /// Requester can cancel their own pending request.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cancel: Option<bool>,
}

impl UpdateRequestInput {
    pub fn is_empty(&self) -> bool {
        self.title.is_none()
            && self.priority.is_none()
            && self.form_data.is_none()
            && self.attachments.is_none()
            && self.cancel.is_none()
    }
}

/// `POST /:id/decision` — approver action. The Rust handler logs the
/// action via the [`sabrequests-stage-actions`] crate's collection and
/// advances `currentStageIdx` accordingly.
///
/// `action` is one of:
/// - `approve` — bump stage idx; if it equals stages.len(), mark
///   approved.
/// - `reject` — flip status → rejected, decided_at = now.
/// - `reassign` — change `currentStage.approverId` to `reassignTo`.
/// - `comment` — no-op on the instance; only the action log gets a row.
///
/// `nextStage` carries the freshly resolved view for the new
/// `currentStageIdx` (post-approve only). The TS layer computes it from
/// the blueprint; the Rust handler stores it verbatim.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageDecisionInput {
    pub action: String,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub reassign_to: Option<String>,
    #[serde(default)]
    pub next_stage: Option<CurrentStageView>,
    #[serde(default)]
    pub next_stage_idx: Option<u32>,
    #[serde(default)]
    pub next_sla_deadline_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_inst() -> RequestInstance {
        RequestInstance {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            assignment: Default::default(),
            blueprint_id: ObjectId::new(),
            blueprint_name: Some("Travel".into()),
            blueprint_category: Some("custom".into()),
            requester_id: ObjectId::new(),
            form_data: serde_json::json!({ "amount": 500 }),
            current_stage_idx: 0,
            current_stage: Some(CurrentStageView {
                idx: 0,
                name: "Manager".into(),
                ..Default::default()
            }),
            status: RequestStatus::Pending,
            sla_deadline_at: None,
            breached_at: None,
            decided_at: None,
            attachments: vec![],
            title: Some("Travel by Jane".into()),
            priority: Some("normal".into()),
            archived: false,
        }
    }

    #[test]
    fn instance_round_trips_with_flattened_fragments() {
        let inst = make_inst();
        let json = serde_json::to_value(&inst).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert_eq!(json["status"], "pending");
        let _r: RequestInstance = serde_json::from_value(json).unwrap();
    }

    #[test]
    fn status_serializes_lowercase() {
        assert_eq!(
            serde_json::to_value(RequestStatus::Approved).unwrap(),
            serde_json::Value::String("approved".into())
        );
    }

    #[test]
    fn update_input_is_empty_detects_unset() {
        assert!(UpdateRequestInput::default().is_empty());
        assert!(!UpdateRequestInput {
            cancel: Some(true),
            ..Default::default()
        }.is_empty());
    }
}
