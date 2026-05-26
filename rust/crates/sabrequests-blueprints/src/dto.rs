//! DTOs for the Request Blueprint entity.
//!
//! The canonical persisted shape is [`Blueprint`]; it flattens
//! `Identity` / `Audit` / `Assignment` from `crm-core` so the Mongo
//! document root carries `_id`, `userId`, `projectId`, `createdAt`, …
//! directly (per CRM §0 conventions).
//!
//! Wire inputs ([`CreateBlueprintInput`] / [`UpdateBlueprintInput`])
//! are curated subsets — they describe only what the form-builder UI
//! sends in.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Audit, Identity};
use serde::{Deserialize, Serialize};

pub const DEFAULT_LIMIT: i64 = 20;
pub const MAX_LIMIT: i64 = 100;

/// A single approval stage on a blueprint.
///
/// - `approverKind` resolves the approver at request-create time. One
///   of:
///   - `user` — `approverId` is a static user OID.
///   - `role` — `approverRole` names a role (RBAC role key); the
///     instance handler picks the first user in that role on the
///     owning team.
///   - `manager_of_requester` — pull the requester's manager from the
///     `requests_orgcharts` collection.
///   - `conditional` — `conditionalExpr` is evaluated against
///     `formData` to pick a user. (Today we store the expression
///     verbatim; evaluator lands in a follow-up.)
/// - `slaMins` is the per-stage SLA (minutes). 0 / unset = no SLA.
/// - `escalateToUserId` (optional) is who picks up the stage when the
///   SLA breaches and `escalateOnBreach` is true.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlueprintStage {
    pub name: String,
    pub approver_kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conditional_expr: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sla_mins: Option<u32>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub escalate_on_breach: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub escalate_to_user_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// One branch in a `routingRules` array. If the boolean `match` on
/// `formData` is true, the request starts at `startStageIdx` (skipping
/// any earlier stages).
///
/// We deliberately store the expression as an opaque string today; the
/// evaluator (and the test surface that proves it safe) is deferred to
/// a follow-up alongside `conditionalExpr` above.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlueprintRoutingRule {
    /// Human label shown in the admin UI ("Amount > 10k → CFO branch").
    pub label: String,
    /// Opaque expression evaluated against the submitted `formData`.
    pub expr: String,
    /// Index into the blueprint's `stages[]` where this branch starts.
    pub start_stage_idx: u32,
}

fn is_false(b: &bool) -> bool {
    !*b
}

/// Canonical persisted Blueprint. Flattens §0 identity / audit /
/// assignment so the Mongo document root has them at top level.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Blueprint {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /// Human-readable name shown in the picker on `/dashboard/requests/new`.
    pub name: String,
    /// Long description / help text.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Category bucket — `procurement` / `time_off` / `it_access` /
    /// `custom`. Free-form so callers can extend.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// Optional emoji / icon name for the picker tile.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Form-builder JSON. Opaque to the Rust crate; the TS UI owns the
    /// schema shape.
    #[serde(default)]
    pub form_schema: serde_json::Value,
    /// Ordered list of approval stages.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub stages: Vec<BlueprintStage>,
    /// Optional routing decision branches.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub routing_rules: Vec<BlueprintRoutingRule>,
    /// Owning team (used by RBAC + analytics filters).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_team_id: Option<ObjectId>,
    /// Default overall SLA in minutes (sum across stages if unset).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sla_mins: Option<u32>,
    /// When `true`, requesters can submit; when `false` the blueprint is
    /// a draft only admins see.
    #[serde(default, skip_serializing_if = "is_false")]
    pub published: bool,
    /// Soft-delete marker.
    #[serde(default, skip_serializing_if = "is_false")]
    pub archived: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

/* ──────────────────────────── wire inputs ──────────────────────────── */

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Substring search over `name` + `category`.
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub owner_team_id: Option<String>,
    /// When `Some(true)` returns only published blueprints. The
    /// requester-facing `/new` page sends `true`; the admin
    /// `/blueprints` page sends `None` to see drafts as well.
    #[serde(default)]
    pub published: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBlueprintInput {
    #[serde(default)]
    pub project_id: Option<String>,

    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub form_schema: Option<serde_json::Value>,
    #[serde(default)]
    pub stages: Option<Vec<BlueprintStage>>,
    #[serde(default)]
    pub routing_rules: Option<Vec<BlueprintRoutingRule>>,
    #[serde(default)]
    pub owner_team_id: Option<String>,
    #[serde(default)]
    pub sla_mins: Option<u32>,
    #[serde(default)]
    pub published: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBlueprintInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub form_schema: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stages: Option<Vec<BlueprintStage>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub routing_rules: Option<Vec<BlueprintRoutingRule>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_team_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sla_mins: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub published: Option<bool>,
}

impl UpdateBlueprintInput {
    pub fn is_empty(&self) -> bool {
        self.name.is_none()
            && self.description.is_none()
            && self.category.is_none()
            && self.icon.is_none()
            && self.form_schema.is_none()
            && self.stages.is_none()
            && self.routing_rules.is_none()
            && self.owner_team_id.is_none()
            && self.sla_mins.is_none()
            && self.published.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crm_core::{Audit, Identity};

    fn make_bp() -> Blueprint {
        Blueprint {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            assignment: Default::default(),
            name: "Travel approval".into(),
            description: None,
            category: Some("custom".into()),
            icon: None,
            form_schema: serde_json::json!({ "fields": [] }),
            stages: vec![BlueprintStage {
                name: "Manager".into(),
                approver_kind: "manager_of_requester".into(),
                sla_mins: Some(60),
                ..Default::default()
            }],
            routing_rules: vec![],
            owner_team_id: None,
            sla_mins: Some(60),
            published: true,
            archived: false,
            deleted_at: None,
        }
    }

    #[test]
    fn blueprint_round_trips_with_flattened_fragments() {
        let bp = make_bp();
        let json = serde_json::to_value(&bp).unwrap();
        assert!(json.get("_id").is_some(), "_id flattened from identity");
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some(), "audit flattened");
        assert!(json.get("identity").is_none(), "identity not nested");
        assert!(json.get("audit").is_none(), "audit not nested");
        assert!(json.get("stages").is_some());
        assert_eq!(json["name"], "Travel approval");
        let _round: Blueprint = serde_json::from_value(json).unwrap();
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateBlueprintInput::default();
        assert!(empty.is_empty());
        let with = UpdateBlueprintInput {
            published: Some(true),
            ..Default::default()
        };
        assert!(!with.is_empty());
    }

    #[test]
    fn stage_camelcase_round_trips() {
        let s = BlueprintStage {
            name: "Finance".into(),
            approver_kind: "role".into(),
            approver_role: Some("finance_lead".into()),
            sla_mins: Some(240),
            escalate_on_breach: true,
            escalate_to_user_id: Some(ObjectId::new()),
            ..Default::default()
        };
        let j = serde_json::to_value(&s).unwrap();
        assert!(j.get("approverKind").is_some());
        assert!(j.get("approverRole").is_some());
        assert!(j.get("escalateOnBreach").is_some());
        let _r: BlueprintStage = serde_json::from_value(j).unwrap();
    }
}
