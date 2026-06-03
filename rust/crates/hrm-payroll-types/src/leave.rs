//! §9.4 Leave Management.
//!
//! Mongo collections: `hrm_leave_types` (`LeaveType`) and
//! `hrm_leave_applications` (`LeaveApplication`). The structs flatten the
//! `crm-core` cross-cutting fragments (`Identity`, `Audit`, plus
//! `Assignment` on the application) so the document root carries the §0
//! ownership / audit fields directly.
//!
//! `LeaveType` describes the catalog row (CL/SL/EL/ML/PL/Comp-off/Unpaid/…)
//! including paid? flag, accrual rule, max balance, carry-forward,
//! encashable?, gender restriction, and minimum service tenure.
//!
//! `LeaveApplication` is the per-employee request — it points at a
//! `LeaveType`, captures the from/to range, half-day flag, system-computed
//! day count, reason, attachments, an ordered approver chain, the overall
//! status, and a snapshot of the leave balance at the time of submission.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity};
use serde::{Deserialize, Serialize};

fn is_false(b: &bool) -> bool {
    !*b
}

fn is_true(b: &bool) -> bool {
    *b
}

/// Status of a leave application or of an individual approver step.
///
/// `Pending` means the actor (or the application as a whole) has not yet
/// been decided. `Approved` / `Rejected` are terminal decisions made by
/// an approver. `Cancelled` is a withdrawal initiated by the applicant
/// before the chain reaches a terminal state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LeaveApplicationStatus {
    #[default]
    Pending,
    Approved,
    Rejected,
    Cancelled,
}

/// One node in the ordered approver chain on a `LeaveApplication`. Each
/// configured approver's decision is recorded inline so the application
/// document carries the full audit trail of who decided what and when.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApproverStep {
    pub approver_id: ObjectId,
    #[serde(default)]
    pub status: LeaveApplicationStatus,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub decided_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

/// Catalog row defining a leave type (CL / SL / EL / ML / PL / Comp-off /
/// Unpaid / …). One document per project per leave-type code.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaveType {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- catalog fields ---------------------------------------- */
    /// Short code (e.g. "CL", "SL", "EL", "ML", "PL", "COMP", "LWP").
    pub code: String,
    pub name: String,

    /// Whether the leave is paid. Defaults to `true` (CL/SL/EL/ML/PL are
    /// paid; only Unpaid / LWP flips this).
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub paid: bool,

    /// Free-text accrual rule, e.g. `"monthly:1.25"`, `"yearly:15"`,
    /// `"none"`. Parsed by the leave-balance worker; stored verbatim
    /// here so the catalog stays portable across rule engines.
    pub accrual_rule: String,

    /// Cap on the running balance (in days). `None` means uncapped.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_balance: Option<f32>,

    /// Whether unused balance carries forward into the next leave year.
    #[serde(default, skip_serializing_if = "is_false")]
    pub carry_forward: bool,

    /// Whether unused balance is encashable on exit / year-end.
    #[serde(default, skip_serializing_if = "is_false")]
    pub encashable: bool,

    /// Optional gender restriction. Free-text `"male"` / `"female"` to
    /// avoid pulling in a cross-module enum dependency. `None` means the
    /// leave type is available to all employees.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gender_restricted: Option<String>,

    /// Minimum employment tenure (in months) required before the
    /// employee can apply for this leave type.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_service_months: Option<u32>,
}

fn default_true() -> bool {
    true
}

/// Per-employee leave application instance. Points at a `LeaveType`,
/// carries the requested range, the system-computed day count, the
/// approver chain with each decision, and a snapshot of the leave
/// balance at submission time.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaveApplication {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- request body ------------------------------------------ */
    pub leave_type_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub to: DateTime<Utc>,

    /// Whether this is a half-day request. Defaults to `false`; serde
    /// skips the field when default so the typical full-day case stays
    /// compact on the wire.
    #[serde(default, skip_serializing_if = "is_false")]
    pub half_day: bool,

    /// System-computed day count over the `from..=to` range, accounting
    /// for `half_day`, weekends, and holidays per the project policy.
    pub days: f32,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- workflow ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub approver_chain: Vec<ApproverStep>,

    #[serde(default)]
    pub status: LeaveApplicationStatus,

    /// Snapshot of the applicant's leave balance (in days) for this
    /// type at submission time. Lets reviewers see the balance the
    /// employee saw without re-deriving it after the fact.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub balance_snapshot: Option<f32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn leave_type_round_trips_with_flattened_fragments() {
        let lt = LeaveType {
            identity: fresh_identity(),
            audit: Audit::new(None),
            code: "EL".to_string(),
            name: "Earned Leave".to_string(),
            paid: true,
            accrual_rule: "monthly:1.25".to_string(),
            max_balance: Some(45.0),
            carry_forward: true,
            encashable: true,
            gender_restricted: None,
            min_service_months: Some(6),
        };

        let json = serde_json::to_value(&lt).unwrap();

        // Flattened §0 fragments live at the document root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        // Flattened, not nested.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields.
        assert_eq!(json.get("code").and_then(|v| v.as_str()), Some("EL"));
        assert_eq!(
            json.get("accrualRule").and_then(|v| v.as_str()),
            Some("monthly:1.25"),
        );
        assert_eq!(
            json.get("carryForward").and_then(|v| v.as_bool()),
            Some(true)
        );
        assert_eq!(
            json.get("minServiceMonths").and_then(|v| v.as_u64()),
            Some(6)
        );
        // `paid: true` is the default and skips serialization.
        assert!(json.get("paid").is_none());
        // `gender_restricted: None` skips serialization.
        assert!(json.get("genderRestricted").is_none());

        let back: LeaveType = serde_json::from_value(json).unwrap();
        assert_eq!(back.code, "EL");
        assert!(back.paid);
        assert_eq!(back.max_balance, Some(45.0));
    }

    #[test]
    fn leave_application_round_trips_approved_status_and_skips_default_half_day() {
        let app = LeaveApplication {
            identity: fresh_identity(),
            audit: Audit::new(None),
            assignment: Assignment::default(),
            leave_type_id: ObjectId::new(),
            from: Utc::now(),
            to: Utc::now(),
            half_day: false,
            days: 2.0,
            reason: Some("Family trip".to_string()),
            attachments: Vec::new(),
            approver_chain: vec![ApproverStep {
                approver_id: ObjectId::new(),
                status: LeaveApplicationStatus::Approved,
                decided_at: Some(Utc::now()),
                comment: Some("Approved by manager".to_string()),
            }],
            status: LeaveApplicationStatus::Approved,
            balance_snapshot: Some(12.5),
        };

        let json = serde_json::to_value(&app).unwrap();

        // Flattened §0 fragments at root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("assignment").is_none());

        // Default `half_day: false` is skipped.
        assert!(
            json.get("halfDay").is_none(),
            "half_day default should skip-serialize"
        );

        // Status round-trips as snake_case.
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("approved"),
        );

        // Approver step status also serializes snake_case.
        let step_status = json
            .pointer("/approverChain/0/status")
            .and_then(|v| v.as_str());
        assert_eq!(step_status, Some("approved"));

        // camelCase fields appear.
        assert!(json.get("leaveTypeId").is_some());
        assert!(json.get("balanceSnapshot").is_some());

        let back: LeaveApplication = serde_json::from_value(json).unwrap();
        assert_eq!(back.status, LeaveApplicationStatus::Approved);
        assert!(!back.half_day);
        assert_eq!(back.days, 2.0);
        assert_eq!(back.balance_snapshot, Some(12.5));
        assert_eq!(back.approver_chain.len(), 1);
        assert_eq!(
            back.approver_chain[0].status,
            LeaveApplicationStatus::Approved,
        );
    }
}
