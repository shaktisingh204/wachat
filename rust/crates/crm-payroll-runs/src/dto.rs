//! Wire-format request DTOs for the payroll-run endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`hrm_payroll_types::PayrollRun`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send
//! IN (create-input, update-input, list-query, approval-step input);
//! they are intentionally narrower than the full PayrollRun model so
//! the API surface stays controlled.
//!
//! All structs use `#[serde(rename_all = "camelCase")]` so JSON
//! requests round-trip with the TS clients.

use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// Query string for the single-document + lifecycle routes (`GET` /
/// `PATCH` / `DELETE /{runId}` and `POST /{runId}/compute|disburse`).
/// Carries only the SabCRM tenant scope — **required** under
/// `ScopeMode::Project` (the `/v1/sabcrm/people/payroll-runs` mount),
/// ignored on the legacy `userId`-scoped mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `GET /v1/hrm/payroll-runs` query string.
///
/// `status` narrows by workflow stage; legal values are the lower-case
/// renames of [`hrm_payroll_types::PayrollRunStatus`]:
/// `"draft"`, `"processing"`, `"approved"`, `"disbursed"`, `"closed"`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/people/payroll-runs` mount); ignored on the legacy
    /// `userId`-scoped mount.
    #[serde(default)]
    pub project_id: Option<String>,
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Restrict to a single workflow status. Lower-case to match the
    /// stored enum.
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/hrm/payroll-runs` body. Curated subset of the full
/// [`hrm_payroll_types::PayrollRun`] fields — enough to drive the
/// "Start Payroll Run" UI without exposing the per-employee figures
/// (those are populated by the explicit `/compute` endpoint) or the
/// approval chain (populated by `/approve`).
///
/// **Required:** `periodFrom`, `periodTo`.
///
/// **Optional:** `payDate`, `lockDate`, `bankFileFormat`, `projectId`.
///
/// **Server-managed (NOT accepted on this body):** `employees[]`,
/// `totals`, `approvals[]`, `bankFileId`, `status` (defaults to
/// `"draft"`). See the lifecycle endpoints in [`crate::handlers`].
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayrollRunInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- period (★ required) ----- */
    /// First day (inclusive) of the pay period.
    pub period_from: chrono::DateTime<chrono::Utc>,
    /// Last day (inclusive) of the pay period.
    pub period_to: chrono::DateTime<chrono::Utc>,

    /* ----- dates ----- */
    /// Date the bank file is scheduled / executed against.
    #[serde(default)]
    pub pay_date: Option<chrono::DateTime<chrono::Utc>>,
    /// After this date, employees can no longer change attendance /
    /// reimbursement inputs that affect the run.
    #[serde(default)]
    pub lock_date: Option<chrono::DateTime<chrono::Utc>>,

    /* ----- bank file ----- */
    /// One of `"neft"`, `"imps"`, `"rtgs"`, `"upi_bulk"` — matches the
    /// snake-case wire form of `BankFileFormat`.
    #[serde(default)]
    pub bank_file_format: Option<String>,
}

/// `PATCH /v1/hrm/payroll-runs/:runId` body. Every field is optional;
/// only the fields explicitly sent are modified on the document.
/// `updatedAt` and `updatedBy` are always refreshed.
///
/// Note: this PATCH does NOT modify `employees[]`, `totals`,
/// `approvals[]`, `bankFileId`, or `status` — those are mutated only by
/// the dedicated lifecycle endpoints. Callers who try to send those
/// fields will see them silently ignored (we accept only the subset
/// declared on this struct).
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePayrollRunInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period_from: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period_to: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pay_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lock_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_file_format: Option<String>,
}

impl UpdatePayrollRunInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.period_from.is_none()
            && self.period_to.is_none()
            && self.pay_date.is_none()
            && self.lock_date.is_none()
            && self.bank_file_format.is_none()
    }
}

/// `POST /v1/hrm/payroll-runs/:runId/approve` body. One signing event
/// from one approver in the multi-step approval chain.
///
/// `approverId` is required; `comment` is free-form (e.g. "LGTM",
/// "needs CFO sign-off"). Status is forced server-side to `"approved"`
/// for now — a future iteration will accept `"rejected"` to short-
/// circuit the chain. The handler stamps `decidedAt` on insert so the
/// caller can't backdate.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApproveInput {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project`; ignored on the
    /// legacy `userId`-scoped mount. Also accepted as `?projectId=` on
    /// the query string.
    #[serde(default)]
    pub project_id: Option<String>,
    /// 24-char hex of the approver (typically the manager / CFO who
    /// is signing off on this step).
    pub approver_id: String,
    /// Optional free-form note.
    #[serde(default)]
    pub comment: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "periodFrom": "2026-04-01T00:00:00Z",
            "periodTo": "2026-04-30T23:59:59Z",
            "payDate": "2026-05-05T00:00:00Z",
            "bankFileFormat": "upi_bulk",
        });
        let input: CreatePayrollRunInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.bank_file_format.as_deref(), Some("upi_bulk"));
        assert!(input.pay_date.is_some());
        assert!(input.lock_date.is_none());
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdatePayrollRunInput::default();
        assert!(empty.is_empty());

        let with_field = UpdatePayrollRunInput {
            bank_file_format: Some("neft".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_query_defaults_are_none() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.status.is_none());
    }

    #[test]
    fn approve_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "approverId": "507f1f77bcf86cd799439011",
            "comment": "LGTM",
        });
        let input: ApproveInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.approver_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.comment.as_deref(), Some("LGTM"));
        assert!(input.project_id.is_none());
    }

    #[test]
    fn approve_input_parses_camel_case_project_id() {
        let input: ApproveInput = serde_json::from_value(serde_json::json!({
            "approverId": "507f1f77bcf86cd799439011",
            "projectId": "507f1f77bcf86cd799439099",
        }))
        .unwrap();
        assert_eq!(input.project_id.as_deref(), Some("507f1f77bcf86cd799439099"));
    }

    #[test]
    fn list_query_parses_camel_case_project_id() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439099",
        }))
        .unwrap();
        assert_eq!(q.project_id.as_deref(), Some("507f1f77bcf86cd799439099"));
    }

    #[test]
    fn scope_query_parses_camel_case_project_id() {
        let q: ScopeQuery = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439099",
        }))
        .unwrap();
        assert_eq!(q.project_id.as_deref(), Some("507f1f77bcf86cd799439099"));

        let empty: ScopeQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(empty.project_id.is_none());
    }
}
