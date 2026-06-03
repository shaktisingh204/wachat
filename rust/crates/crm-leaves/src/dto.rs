//! Wire-format request DTOs for the leave catalog + leave application
//! endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! `hrm_payroll_types::{LeaveType, LeaveApplication}` DTO — we
//! deliberately do not redeclare them here. The shapes below describe
//! only what callers send IN (create-input, update-input, list-query);
//! they are intentionally narrower than the full models so the API
//! surface stays controlled.
//!
//! All structs use `#[serde(rename_all = "camelCase")]` so JSON
//! requests round-trip with the TS clients.

use chrono::{DateTime, Utc};
use crm_core::Attachment;
use hrm_payroll_types::LeaveApplicationStatus;
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

// =========================================================================
// LeaveType — catalog DTOs
// =========================================================================

/// `GET /v1/crm/leaves/types` query string.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListLeaveTypesQuery {
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text substring match (case-insensitive) against `code` /
    /// `name`.
    #[serde(default)]
    pub q: Option<String>,
}

/// `POST /v1/crm/leaves/types` body. The catalog is small and fully
/// admin-curated, so the input mirrors the persisted model except for
/// the §0 ownership / audit fragments which the handler stamps.
///
/// **Required:** `code`, `name`.
/// **Optional:** `paid`, `accrualRule`, `maxBalance`, `carryForward`,
/// `encashable`, `genderRestricted`, `minServiceMonths`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLeaveTypeInput {
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- catalog (★ required) ----- */
    pub code: String,
    pub name: String,

    /* ----- catalog (optional) ----- */
    /// Whether the leave is paid. Defaults to `true` on the persisted
    /// model when absent — the handler honours that default.
    #[serde(default)]
    pub paid: Option<bool>,

    /// Free-text accrual rule, e.g. `"monthly:1.25"`, `"yearly:15"`,
    /// `"none"`. Stored verbatim; defaults to `"none"` when absent so
    /// the persisted document always has the field populated.
    #[serde(default)]
    pub accrual_rule: Option<String>,

    /// Cap on the running balance (in days). `None` means uncapped.
    #[serde(default)]
    pub max_balance: Option<f32>,

    /// Whether unused balance carries forward. Defaults to `false`.
    #[serde(default)]
    pub carry_forward: Option<bool>,

    /// Whether unused balance is encashable. Defaults to `false`.
    #[serde(default)]
    pub encashable: Option<bool>,

    /// Optional gender restriction (`"male"` / `"female"`). `None`
    /// means the type is available to all employees.
    #[serde(default)]
    pub gender_restricted: Option<String>,

    /// Minimum employment tenure (in months) required before an
    /// employee can apply.
    #[serde(default)]
    pub min_service_months: Option<u32>,
}

/// `PATCH /v1/crm/leaves/types/:typeId` body. Every field is optional;
/// only fields explicitly sent are modified. `updatedAt` /
/// `updatedBy` are always refreshed.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLeaveTypeInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paid: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accrual_rule: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_balance: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub carry_forward: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub encashable: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gender_restricted: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_service_months: Option<u32>,
}

impl UpdateLeaveTypeInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.code.is_none()
            && self.name.is_none()
            && self.paid.is_none()
            && self.accrual_rule.is_none()
            && self.max_balance.is_none()
            && self.carry_forward.is_none()
            && self.encashable.is_none()
            && self.gender_restricted.is_none()
            && self.min_service_months.is_none()
    }
}

// =========================================================================
// LeaveApplication — per-employee request DTOs
// =========================================================================

/// `GET /v1/crm/leaves/applications` query string. Listing is tenant-
/// scoped by `userId`; callers can additionally narrow by employee or
/// status.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListLeaveApplicationsQuery {
    /// 1-indexed page. Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,

    /// Optional applicant (24-char hex). Matches against the flattened
    /// `Assignment.assignedTo` — that's where the per-employee owner
    /// of the application lives on the persisted document.
    #[serde(default)]
    pub employee_id: Option<String>,

    /// Optional status filter. Accepts `pending` / `approved` /
    /// `rejected` / `cancelled` (snake_case to match the enum's
    /// serde discriminant).
    #[serde(default)]
    pub status: Option<LeaveApplicationStatus>,
}

/// `POST /v1/crm/leaves/applications` body.
///
/// **Required:** `leaveTypeId`, `from`, `to`.
/// **Optional:** `halfDay`, `reason`, `attachments`.
///
/// `status` always starts as [`LeaveApplicationStatus::Pending`] and is
/// not configurable on create — workflow transitions go through the
/// approve / reject / cancel actions, never through a raw POST.
///
/// `days` is computed by the handler (a naive `(to - from) + 1`-day
/// count today; production work hands this off to the leave-balance
/// worker once it lands).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLeaveApplicationInput {
    /// Optional override of the project scope. See
    /// [`CreateLeaveTypeInput::project_id`] for the rationale.
    #[serde(default)]
    pub project_id: Option<String>,

    /// 24-char hex of the parent `LeaveType`. Required.
    pub leave_type_id: String,

    /// Inclusive start of the requested range. Required.
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub from: DateTime<Utc>,

    /// Inclusive end of the requested range. Required. Must be `>= from`.
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub to: DateTime<Utc>,

    /// Whether this is a half-day request. Defaults to `false`.
    #[serde(default)]
    pub half_day: Option<bool>,

    /// Optional free-text reason shown to approvers.
    #[serde(default)]
    pub reason: Option<String>,

    /// SabFile attachments (medical certificates, supporting docs).
    /// Per the SabFiles policy, no raw URLs — every file is referenced
    /// by its SabFile id via [`Attachment`].
    #[serde(default)]
    pub attachments: Option<Vec<Attachment>>,

    /// Optional applicant override (24-char hex). When omitted the
    /// authenticated caller is treated as the applicant — handler
    /// stamps `Assignment.assignedTo = AuthUser.user_id` so the
    /// employee dashboard's "my applications" filter just works.
    #[serde(default)]
    pub employee_id: Option<String>,
}

/// `PATCH /v1/crm/leaves/applications/:applicationId` body. Every field
/// is optional. Note: `status` is intentionally NOT patchable here —
/// use the approve / reject / cancel actions instead so the
/// approver-chain audit trail stays consistent.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLeaveApplicationInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub leave_type_id: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub from: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub to: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub half_day: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,
}

impl UpdateLeaveApplicationInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.leave_type_id.is_none()
            && self.from.is_none()
            && self.to.is_none()
            && self.half_day.is_none()
            && self.reason.is_none()
            && self.attachments.is_none()
    }
}

/// `POST /v1/crm/leaves/applications/:applicationId/approve` body.
/// Optional comment to record on the approver step. Empty body is
/// accepted (no comment).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApproveLeaveApplicationInput {
    #[serde(default)]
    pub comment: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_leave_type_round_trips_camel_case() {
        let json = serde_json::json!({
            "code": "EL",
            "name": "Earned Leave",
            "accrualRule": "monthly:1.25",
            "maxBalance": 45.0,
            "carryForward": true,
            "minServiceMonths": 6,
        });
        let input: CreateLeaveTypeInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.code, "EL");
        assert_eq!(input.name, "Earned Leave");
        assert_eq!(input.accrual_rule.as_deref(), Some("monthly:1.25"));
        assert_eq!(input.max_balance, Some(45.0));
        assert_eq!(input.carry_forward, Some(true));
        assert_eq!(input.min_service_months, Some(6));
    }

    #[test]
    fn update_leave_type_is_empty_detects_all_unset() {
        let empty = UpdateLeaveTypeInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateLeaveTypeInput {
            name: Some("Sick Leave".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_leave_types_query_defaults_are_none() {
        let q: ListLeaveTypesQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.q.is_none());
    }

    #[test]
    fn create_leave_application_round_trips_camel_case() {
        let oid = bson::oid::ObjectId::new().to_hex();
        let json = serde_json::json!({
            "leaveTypeId": oid,
            "from": "2026-05-10T00:00:00Z",
            "to":   "2026-05-12T00:00:00Z",
            "halfDay": false,
            "reason": "Family trip",
        });
        let input: CreateLeaveApplicationInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.leave_type_id, oid);
        assert_eq!(input.half_day, Some(false));
        assert_eq!(input.reason.as_deref(), Some("Family trip"));
        assert!(input.attachments.is_none());
    }

    #[test]
    fn update_leave_application_is_empty_detects_all_unset() {
        let empty = UpdateLeaveApplicationInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateLeaveApplicationInput {
            reason: Some("Updated reason".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_leave_applications_query_parses_status() {
        let q: ListLeaveApplicationsQuery =
            serde_json::from_value(serde_json::json!({ "status": "approved" })).unwrap();
        assert_eq!(q.status, Some(LeaveApplicationStatus::Approved));
    }

    #[test]
    fn approve_input_accepts_empty_body() {
        let input: ApproveLeaveApplicationInput =
            serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(input.comment.is_none());
    }
}
