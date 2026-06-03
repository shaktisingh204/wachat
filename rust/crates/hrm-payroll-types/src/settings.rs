//! §9.12 HRM Settings — DTOs.
//!
//! Mongo collection: `crm_hrm_settings` (one document per tenant).
//! `HrmSettings` flattens the `crm-core` `Identity` + `Audit` fragments
//! at the document root.
//!
//! Spec (§9.12 verbatim):
//! > Workflows, Approval chains, Working days, Overtime rules, Late
//! > marking rules, Leave year, Notice period rules, Probation rules,
//! > Resignation workflow, Asset return checklist, Notification
//! > templates.

use bson::oid::ObjectId;
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ===================== Workflows + approval chains ===================== */

/// One step inside a workflow / approval chain. `approver_kind` selects
/// how the runtime resolves the approver:
///   - `"manager"`  — the requester's reporting manager (no value).
///   - `"role"`     — any user holding the role in `approver_value`.
///   - `"specific"` — a specific user id in `approver_value`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalStepDef {
    pub name: String,
    pub approver_kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_value: Option<String>,
    /// SLA — auto-escalates / auto-approves after this many hours.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deadline_hours: Option<u32>,
}

/// Module-scoped workflow (one per `applies_to` per tenant). Steps are
/// evaluated in order.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDef {
    pub name: String,
    /// `"leave"` | `"resignation"` | `"timesheet"` | `"expense"`.
    pub applies_to: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub steps: Vec<ApprovalStepDef>,
}

/// Reusable named approval chain referenced by other modules. Carries
/// its own `id` so workflows can pin a specific chain version.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalChain {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub steps: Vec<ApprovalStepDef>,
}

/* ===================== Working days + attendance rules ===================== */

/// Working-week shape. Day numbers follow `chrono::Weekday::num_days_from_sunday`:
/// `0 = Sunday .. 6 = Saturday`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkingDaysConfig {
    /// Days that are full holidays every week.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub weekly_off_days: Vec<u8>,
    /// Days that count as a half-day (e.g. 2nd & 4th Saturday tracked
    /// elsewhere — this is for week-after-week half-days).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub half_day_on: Vec<u8>,
    /// Standard working hours per full day (e.g. 8.0 or 9.0).
    pub working_hours_per_day: f32,
}

/// Overtime rule. `multiplier` is applied to the base hourly rate after
/// `after_hours` is exceeded; `max_hours_per_day` caps payable OT.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OvertimeRule {
    pub name: String,
    /// OT kicks in after this many hours in a day.
    pub after_hours: f32,
    /// e.g. 1.5 for time-and-a-half, 2.0 for double-time.
    pub multiplier: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_hours_per_day: Option<f32>,
    /// Restrict applicability to specific grades / bands. Empty = all.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applicable_to_grades: Vec<String>,
}

/// Late-arrival policy expressed as minute thresholds past punch-in.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LateMarkingRule {
    pub grace_minutes: u32,
    pub half_day_after_minutes: u32,
    pub absent_after_minutes: u32,
}

/* ===================== Leave year ===================== */

/// Anchor of the tenant's leave year. e.g. `(start_month: 4, start_day: 1)`
/// = April 1st (Indian FY style).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaveYear {
    pub start_month: u8,
    pub start_day: u8,
}

/* ===================== Lifecycle rules ===================== */

/// Notice period required from / for an employee type. `employee_type`
/// is free-form (e.g. `"full_time"`, `"intern"`, `"contract"`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoticePeriodRule {
    pub employee_type: String,
    pub days: u32,
}

/// Probation rule per employee type. `can_extend` toggles whether HR
/// may extend probation; `max_extension_months` caps that extension.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbationRule {
    pub employee_type: String,
    pub months: u32,
    #[serde(default)]
    pub can_extend: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_extension_months: Option<u32>,
}

/// Resignation workflow envelope — high-level steps + the standard
/// exit checklist toggles. Granular per-step approvals live in a
/// `WorkflowDef { applies_to: "resignation", ... }`; this captures
/// the company-policy gates HR enforces alongside the workflow.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResignationWorkflow {
    /// Free-form step labels in order (e.g. ["manager_acceptance",
    /// "hr_clearance", "final_settlement"]).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub steps: Vec<String>,
    #[serde(default)]
    pub exit_interview_required: bool,
    #[serde(default)]
    pub noc_required: bool,
    #[serde(default)]
    pub asset_return_required: bool,
}

/* ===================== Asset return checklist ===================== */

/// One row of the exit asset-return checklist (laptop, ID card, ...).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetReturnChecklistItem {
    pub label: String,
    #[serde(default)]
    pub required: bool,
}

/* ===================== Notifications ===================== */

/// Notification template. `event` keys the trigger (`"leave_approved"`,
/// `"birthday"`, `"work_anniversary"`); `channel` selects the delivery
/// transport. `subject` is meaningful only for `email`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationTemplate {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub event: String,
    /// `"email"` | `"whatsapp"` | `"sms"` | `"push"`.
    pub channel: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    pub body: String,
}

/* ===================== Aggregate settings doc ===================== */

/// Per-tenant HRM settings — singleton document keyed by `userId` /
/// `projectId` (via the flattened `Identity`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HrmSettings {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub workflows: Vec<WorkflowDef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub approval_chains: Vec<ApprovalChain>,

    pub working_days: WorkingDaysConfig,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub overtime_rules: Vec<OvertimeRule>,
    pub late_marking: LateMarkingRule,
    pub leave_year: LeaveYear,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notice_period_rules: Vec<NoticePeriodRule>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub probation_rules: Vec<ProbationRule>,

    pub resignation_workflow: ResignationWorkflow,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub asset_return_checklist: Vec<AssetReturnChecklistItem>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notification_templates: Vec<NotificationTemplate>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn hrm_settings_round_trips_with_flattened_fragments() {
        let settings = HrmSettings {
            identity: sample_identity(),
            audit: Audit::new(None),
            workflows: vec![WorkflowDef {
                name: "Standard leave".into(),
                applies_to: "leave".into(),
                steps: vec![ApprovalStepDef {
                    name: "Manager".into(),
                    approver_kind: "manager".into(),
                    approver_value: None,
                    deadline_hours: Some(48),
                }],
            }],
            approval_chains: vec![ApprovalChain {
                id: ObjectId::new(),
                name: "Finance > 10k".into(),
                steps: vec![ApprovalStepDef {
                    name: "Finance head".into(),
                    approver_kind: "role".into(),
                    approver_value: Some("finance_head".into()),
                    deadline_hours: Some(24),
                }],
            }],
            working_days: WorkingDaysConfig {
                weekly_off_days: vec![0, 6], // Sun + Sat
                half_day_on: vec![],
                working_hours_per_day: 8.0,
            },
            overtime_rules: vec![OvertimeRule {
                name: "Standard OT".into(),
                after_hours: 8.0,
                multiplier: 1.5,
                max_hours_per_day: Some(4.0),
                applicable_to_grades: vec!["L1".into(), "L2".into()],
            }],
            late_marking: LateMarkingRule {
                grace_minutes: 10,
                half_day_after_minutes: 60,
                absent_after_minutes: 240,
            },
            leave_year: LeaveYear {
                start_month: 4,
                start_day: 1,
            },
            notice_period_rules: vec![NoticePeriodRule {
                employee_type: "full_time".into(),
                days: 60,
            }],
            probation_rules: vec![ProbationRule {
                employee_type: "full_time".into(),
                months: 6,
                can_extend: true,
                max_extension_months: Some(3),
            }],
            resignation_workflow: ResignationWorkflow {
                steps: vec![
                    "manager_acceptance".into(),
                    "hr_clearance".into(),
                    "final_settlement".into(),
                ],
                exit_interview_required: true,
                noc_required: true,
                asset_return_required: true,
            },
            asset_return_checklist: vec![
                AssetReturnChecklistItem {
                    label: "Laptop".into(),
                    required: true,
                },
                AssetReturnChecklistItem {
                    label: "Access card".into(),
                    required: true,
                },
            ],
            notification_templates: vec![NotificationTemplate {
                id: ObjectId::new(),
                event: "leave_approved".into(),
                channel: "email".into(),
                subject: Some("Your leave has been approved".into()),
                body: "Hi {{name}}, your leave from {{from}} to {{to}} is approved.".into(),
            }],
        };

        let json = serde_json::to_value(&settings).unwrap();

        // Identity + Audit flattened to root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity-specific fields.
        assert!(json.get("workflows").is_some());
        assert!(json.get("approvalChains").is_some());
        assert!(json.get("workingDays").is_some());
        assert!(json.get("overtimeRules").is_some());
        assert!(json.get("lateMarking").is_some());
        assert!(json.get("leaveYear").is_some());
        assert!(json.get("noticePeriodRules").is_some());
        assert!(json.get("probationRules").is_some());
        assert!(json.get("resignationWorkflow").is_some());
        assert!(json.get("assetReturnChecklist").is_some());
        assert!(json.get("notificationTemplates").is_some());

        // Spot-check nested camelCase + enum-string shape.
        let working = json.get("workingDays").unwrap();
        assert!(working.get("weeklyOffDays").is_some());
        assert!(working.get("workingHoursPerDay").is_some());

        let leave_year = json.get("leaveYear").unwrap();
        assert_eq!(
            leave_year.get("startMonth").and_then(|v| v.as_u64()),
            Some(4)
        );
        assert_eq!(leave_year.get("startDay").and_then(|v| v.as_u64()), Some(1));

        let templates = json
            .get("notificationTemplates")
            .unwrap()
            .as_array()
            .unwrap();
        assert_eq!(templates.len(), 1);
        assert!(templates[0].get("_id").is_some());
        assert_eq!(
            templates[0].get("channel").and_then(|v| v.as_str()),
            Some("email")
        );

        // Round-trip back.
        let back: HrmSettings = serde_json::from_value(json).unwrap();
        assert_eq!(back.workflows.len(), 1);
        assert_eq!(back.workflows[0].applies_to, "leave");
        assert_eq!(back.working_days.weekly_off_days, vec![0, 6]);
        assert_eq!(back.late_marking.grace_minutes, 10);
        assert_eq!(back.leave_year.start_month, 4);
        assert!(back.resignation_workflow.exit_interview_required);
        assert_eq!(back.asset_return_checklist.len(), 2);
        assert_eq!(back.notification_templates[0].event, "leave_approved");
    }
}
