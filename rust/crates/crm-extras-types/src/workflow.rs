//! §12.22 Workflow & Approvals.
//!
//! Mongo collections: `crm_workflows` (definitions) + `crm_workflow_runs`
//! (live execution state).
//!
//! A `Workflow` is a versioned, named definition tied to an entity
//! (`"leave"`, `"invoice"`, `"po"`, ...) and a JSON `trigger_condition`
//! (e.g. `{ "amount": { "$gt": 50000 } }`). Each `WorkflowStep` names
//! an approver — which can be a concrete user, a role label, the
//! requester's manager, or a dynamic resolver (a server-side function
//! / rule id that produces the approver at runtime).
//!
//! A `WorkflowRun` is the execution envelope: it tracks the current
//! step pointer, per-step decisions (with comments and per-step
//! attachments), and the global `state`.
//!
//! Spec verbatim: Definition: name, entity, trigger condition, steps[]
//! (approver = user/role/manager/dynamic, parallel?, SLA, on-reject,
//! on-timeout), version, active, audit. Run: state (pending/approved/
//! rejected/escalated), comments per step, attachments per step.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Attachment, Audit, Identity};
use serde::{Deserialize, Serialize};

/// Who approves a step. Tagged with a `kind` discriminator so the JSON
/// is self-describing — the `User` and `Role` variants both carry a
/// payload, the `Manager` variant is a marker, and `Dynamic` carries a
/// resolver name.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ApproverKind {
    /// A specific user id. Internally-tagged enums require struct
    /// variants (or unit variants) — tuple variants holding primitives
    /// can't be serialized through `#[serde(tag = "...")]`. The id
    /// lands in a sibling `id` field.
    User { id: ObjectId },
    /// A role label (e.g. `"finance.manager"`); resolved at runtime
    /// against the workspace's RBAC store.
    Role { name: String },
    /// The requester's manager, resolved from the HR org tree at
    /// runtime.
    Manager,
    /// Custom resolver — `resolver` names a server-side function or a
    /// stored rule id that returns the approver(s).
    Dynamic { resolver: String },
}

/// What happens when an approver rejects the step.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OnRejectAction {
    #[default]
    Stop,
    Reroute,
    NotifyOwner,
}

/// What happens when the step's SLA expires before a decision.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OnTimeoutAction {
    #[default]
    Escalate,
    Approve,
    Reject,
    Notify,
}

/// One step in a workflow definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStep {
    pub name: String,
    pub approver: ApproverKind,
    /// `true` if this step runs in parallel with the next step (any
    /// approval clears them together). `false` is the default
    /// sequential mode.
    #[serde(default)]
    pub parallel: bool,
    /// Service-level deadline in minutes from when the step becomes
    /// active. `None` = no SLA.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sla_minutes: Option<u32>,
    #[serde(default)]
    pub on_reject: OnRejectAction,
    #[serde(default)]
    pub on_timeout: OnTimeoutAction,
}

/// Workflow definition — a versioned, reusable approval template.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- definition body --------------------------------------- */
    pub name: String,
    /// Entity kind this workflow gates (e.g. `"leave"`, `"invoice"`,
    /// `"po"`).
    pub entity: String,
    /// JSON predicate evaluated against the target entity to decide
    /// whether the workflow should fire (e.g. amount thresholds, type
    /// matchers). Stored as raw JSON so the engine can evolve.
    pub trigger_condition: serde_json::Value,
    pub steps: Vec<WorkflowStep>,

    /* ----- versioning + lifecycle -------------------------------- */
    pub version: u32,
    #[serde(default = "default_true")]
    pub active: bool,
}

fn default_true() -> bool {
    true
}

/// Top-level state of a `WorkflowRun`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkflowRunState {
    #[default]
    Pending,
    Approved,
    Rejected,
    Escalated,
    Cancelled,
}

/// One step's runtime record inside a `WorkflowRun`. `decision` is a
/// free-form string (`"pending"` / `"approved"` / `"rejected"`) so
/// extension states (e.g. `"recused"`) don't require a schema bump.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepRun {
    /// Index back into `Workflow.steps` (so step run docs survive a
    /// definition rename).
    pub step_index: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decided_by: Option<ObjectId>,
    /// Decision verb. Free-form to accept extension states.
    pub decision: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub decided_at: Option<DateTime<Utc>>,
}

/// A live execution of a `Workflow` against a concrete target entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRun {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- bindings ---------------------------------------------- */
    pub workflow_id: ObjectId,
    pub target_kind: String,
    pub target_id: ObjectId,

    /* ----- live state -------------------------------------------- */
    #[serde(default)]
    pub state: WorkflowRunState,
    pub current_step_index: u32,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub step_runs: Vec<StepRun>,

    /* ----- timestamps -------------------------------------------- */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub started_at: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub completed_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use serde_json::json;

    fn id() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn workflow_round_trips_with_flattened_fragments() {
        let w = Workflow {
            identity: id(),
            audit: Audit::new(None),
            name: "PO above 50k".into(),
            entity: "po".into(),
            trigger_condition: json!({ "amount": { "$gt": 50000 } }),
            steps: vec![
                WorkflowStep {
                    name: "Manager approval".into(),
                    approver: ApproverKind::Manager,
                    parallel: false,
                    sla_minutes: Some(60 * 24),
                    on_reject: OnRejectAction::NotifyOwner,
                    on_timeout: OnTimeoutAction::Escalate,
                },
                WorkflowStep {
                    name: "Finance review".into(),
                    approver: ApproverKind::Role {
                        name: "finance.manager".into(),
                    },
                    parallel: false,
                    sla_minutes: Some(60 * 48),
                    on_reject: OnRejectAction::Stop,
                    on_timeout: OnTimeoutAction::Notify,
                },
                WorkflowStep {
                    name: "CFO sign-off".into(),
                    approver: ApproverKind::Dynamic {
                        resolver: "rule:cfo-of-region".into(),
                    },
                    parallel: false,
                    sla_minutes: None,
                    on_reject: OnRejectAction::Reroute,
                    on_timeout: OnTimeoutAction::Reject,
                },
            ],
            version: 3,
            active: true,
        };

        let json_v = serde_json::to_value(&w).unwrap();
        // Flattened fragments at root.
        assert!(json_v.get("identity").is_none());
        assert!(json_v.get("audit").is_none());
        assert!(json_v.get("_id").is_some());
        assert!(json_v.get("projectId").is_some());
        assert!(json_v.get("createdAt").is_some());
        // camelCase fields.
        assert!(json_v.get("triggerCondition").is_some());
        // ApproverKind tagged enum: kind=manager (snake_case marker).
        let step0 = json_v
            .get("steps")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .unwrap();
        let approver0 = step0.get("approver").unwrap();
        assert_eq!(
            approver0.get("kind").and_then(|v| v.as_str()),
            Some("manager")
        );
        // Role variant: kind=role + value payload.
        let step1 = &json_v.get("steps").and_then(|v| v.as_array()).unwrap()[1];
        let approver1 = step1.get("approver").unwrap();
        assert_eq!(approver1.get("kind").and_then(|v| v.as_str()), Some("role"));
        // Dynamic variant: kind=dynamic + resolver.
        let step2 = &json_v.get("steps").and_then(|v| v.as_array()).unwrap()[2];
        let approver2 = step2.get("approver").unwrap();
        assert_eq!(
            approver2.get("kind").and_then(|v| v.as_str()),
            Some("dynamic")
        );
        assert_eq!(
            approver2.get("resolver").and_then(|v| v.as_str()),
            Some("rule:cfo-of-region")
        );
        // OnReject snake_case.
        assert_eq!(
            step0.get("onReject").and_then(|v| v.as_str()),
            Some("notify_owner")
        );
        // OnTimeout snake_case.
        assert_eq!(
            step0.get("onTimeout").and_then(|v| v.as_str()),
            Some("escalate")
        );

        let back: Workflow = serde_json::from_value(json_v).unwrap();
        assert_eq!(back.entity, "po");
        assert_eq!(back.steps.len(), 3);
        assert!(matches!(back.steps[0].approver, ApproverKind::Manager));
        assert!(matches!(
            back.steps[0].on_reject,
            OnRejectAction::NotifyOwner
        ));
        assert!(matches!(
            back.steps[2].approver,
            ApproverKind::Dynamic { .. }
        ));
        assert_eq!(back.version, 3);
    }

    #[test]
    fn workflow_run_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let r = WorkflowRun {
            identity: id(),
            audit: Audit::new(None),
            workflow_id: ObjectId::new(),
            target_kind: "po".into(),
            target_id: ObjectId::new(),
            state: WorkflowRunState::Pending,
            current_step_index: 1,
            step_runs: vec![
                StepRun {
                    step_index: 0,
                    decided_by: Some(ObjectId::new()),
                    decision: "approved".into(),
                    comment: Some("LGTM".into()),
                    attachments: vec![],
                    decided_at: Some(now),
                },
                StepRun {
                    step_index: 1,
                    decided_by: None,
                    decision: "pending".into(),
                    comment: None,
                    attachments: vec![Attachment {
                        file_id: ObjectId::new(),
                        name: Some("supporting.pdf".into()),
                        mime_type: Some("application/pdf".into()),
                        size: Some(1024),
                    }],
                    decided_at: None,
                },
            ],
            started_at: now,
            completed_at: None,
        };

        let json_v = serde_json::to_value(&r).unwrap();
        assert!(json_v.get("identity").is_none());
        assert!(json_v.get("audit").is_none());
        assert!(json_v.get("_id").is_some());
        assert!(json_v.get("projectId").is_some());
        assert!(json_v.get("createdAt").is_some());
        assert!(json_v.get("workflowId").is_some());
        assert!(json_v.get("targetKind").is_some());
        assert!(json_v.get("targetId").is_some());
        assert!(json_v.get("currentStepIndex").is_some());
        assert!(json_v.get("startedAt").is_some());
        assert!(json_v.get("completedAt").is_none(), "None should skip");
        // State lowercase.
        assert_eq!(
            json_v.get("state").and_then(|v| v.as_str()),
            Some("pending")
        );
        // StepRun camelCase.
        let sr0 = json_v
            .get("stepRuns")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .unwrap();
        assert!(sr0.get("stepIndex").is_some());
        assert!(sr0.get("decidedBy").is_some());
        assert!(sr0.get("decidedAt").is_some());

        let back: WorkflowRun = serde_json::from_value(json_v).unwrap();
        assert!(matches!(back.state, WorkflowRunState::Pending));
        assert_eq!(back.step_runs.len(), 2);
        assert_eq!(back.step_runs[0].decision, "approved");
        assert_eq!(back.step_runs[1].attachments.len(), 1);
    }
}
