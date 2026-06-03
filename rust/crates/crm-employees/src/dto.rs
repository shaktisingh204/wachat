//! Wire-format request DTOs for the employee endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`hrm_payroll_types::Employee`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send
//! IN (create-input, update-input, list-query); they are intentionally
//! narrower than the full Employee model so the API surface stays
//! controlled.
//!
//! Field naming matches the existing TS server action and the
//! `Employee` struct in `hrm_payroll_types::employee`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.

use hrm_payroll_types::{EmploymentStatus, EmploymentType, Gender};
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/employees` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify an employee at a glance: `firstName`,
/// `lastName`, `displayName`, `workEmail`, and `employeeId`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search.
    #[serde(default)]
    pub q: Option<String>,
    /// Filter by department FK (24-char hex). Malformed input yields
    /// `BadRequest` at the handler layer.
    #[serde(default)]
    pub department_id: Option<String>,
    /// Filter by designation FK (24-char hex).
    #[serde(default)]
    pub designation_id: Option<String>,
    /// Filter by employment status (active / on_leave / terminated /
    /// resigned). String form to preserve forward-compat — unknown
    /// labels are rejected at the handler layer.
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/crm/employees` body. The endpoint accepts a curated subset
/// of the full [`hrm_payroll_types::Employee`] fields — enough to drive
/// the existing "Add Employee" UI without exposing the heavy
/// documents / skills / education surface. Those are populated by
/// downstream profile-edit endpoints rather than direct user entry on
/// the create form.
///
/// **Required** (★): firstName, lastName, dob, joiningDate,
/// departmentId, designationId, workEmail, salaryStructureId.
///
/// **Optional**: displayName, salutation, gender, personalEmail,
/// personalPhone, workPhone, employmentType, reportingManagerId,
/// dottedLineManagerId, ctc, variablePct, noticePeriodDays, status.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEmployeeInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- name (★ required) ----- */
    pub first_name: String,
    pub last_name: String,

    /* ----- name (optional) ----- */
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub salutation: Option<String>,

    /* ----- demographics ----- */
    /// Required by §9.1.
    pub dob: chrono::DateTime<chrono::Utc>,
    #[serde(default)]
    pub gender: Option<Gender>,

    /* ----- contact (personal) ----- */
    #[serde(default)]
    pub personal_email: Option<String>,
    #[serde(default)]
    pub personal_phone: Option<String>,

    /* ----- employment (★ required) ----- */
    /// Required by §9.1.
    pub joining_date: chrono::DateTime<chrono::Utc>,
    /// FK into `crm_departments`. Required by §9.1.
    pub department_id: String,
    /// FK into `crm_designations`. Required by §9.1.
    pub designation_id: String,
    /// Required by §9.1 — primary corporate identifier.
    pub work_email: String,
    /// FK into `hrm_salary_structures`. Required by §9.1 so payroll
    /// runs always have a structure to compute against.
    pub salary_structure_id: String,

    /* ----- employment (optional) ----- */
    #[serde(default)]
    pub work_phone: Option<String>,
    #[serde(default)]
    pub employment_type: Option<EmploymentType>,
    /// Self-FK to another `Employee._id` — primary supervisor.
    #[serde(default)]
    pub reporting_manager_id: Option<String>,
    /// Self-FK — secondary / matrixed supervisor.
    #[serde(default)]
    pub dotted_line_manager_id: Option<String>,
    /// Cost-to-company (annual). Cached on the employee doc.
    #[serde(default)]
    pub ctc: Option<f64>,
    /// Variable-pay percentage of CTC (0-100).
    #[serde(default)]
    pub variable_pct: Option<f32>,
    /// Notice period in days.
    #[serde(default)]
    pub notice_period_days: Option<u32>,
    /// Lifecycle bucket. Defaults to `Active` server-side when absent.
    #[serde(default)]
    pub status: Option<EmploymentStatus>,
}

/// `PATCH /v1/crm/employees/:employeeId` body. Every field is optional;
/// only the fields explicitly sent are modified on the document. The
/// handler always refreshes `updatedAt` regardless of which fields are
/// set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEmployeeInput {
    /* ----- name ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salutation: Option<String>,

    /* ----- demographics ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dob: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gender: Option<Gender>,

    /* ----- contact ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub personal_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub personal_phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub work_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub work_phone: Option<String>,

    /* ----- employment ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub joining_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub designation_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salary_structure_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employment_type: Option<EmploymentType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reporting_manager_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dotted_line_manager_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ctc: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variable_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notice_period_days: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<EmploymentStatus>,
}

impl UpdateEmployeeInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.first_name.is_none()
            && self.last_name.is_none()
            && self.display_name.is_none()
            && self.salutation.is_none()
            && self.dob.is_none()
            && self.gender.is_none()
            && self.personal_email.is_none()
            && self.personal_phone.is_none()
            && self.work_email.is_none()
            && self.work_phone.is_none()
            && self.joining_date.is_none()
            && self.department_id.is_none()
            && self.designation_id.is_none()
            && self.salary_structure_id.is_none()
            && self.employment_type.is_none()
            && self.reporting_manager_id.is_none()
            && self.dotted_line_manager_id.is_none()
            && self.ctc.is_none()
            && self.variable_pct.is_none()
            && self.notice_period_days.is_none()
            && self.status.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "firstName": "Asha",
            "lastName": "Iyer",
            "displayName": "Asha Iyer",
            "salutation": "Ms.",
            "dob": "1992-04-15T00:00:00Z",
            "gender": "female",
            "joiningDate": "2024-01-08T00:00:00Z",
            "departmentId": "507f1f77bcf86cd799439011",
            "designationId": "507f1f77bcf86cd799439012",
            "workEmail": "asha@acme.example",
            "salaryStructureId": "507f1f77bcf86cd799439013",
            "employmentType": "full_time",
            "ctc": 1_800_000.0,
            "variablePct": 12.5,
            "noticePeriodDays": 60,
            "status": "active",
        });
        let input: CreateEmployeeInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.first_name, "Asha");
        assert_eq!(input.last_name, "Iyer");
        assert_eq!(input.display_name.as_deref(), Some("Asha Iyer"));
        assert_eq!(input.salutation.as_deref(), Some("Ms."));
        assert_eq!(input.work_email, "asha@acme.example");
        assert_eq!(input.department_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.designation_id, "507f1f77bcf86cd799439012");
        assert_eq!(input.salary_structure_id, "507f1f77bcf86cd799439013");
        assert_eq!(input.employment_type, Some(EmploymentType::FullTime));
        assert_eq!(input.gender, Some(Gender::Female));
        assert_eq!(input.ctc, Some(1_800_000.0));
        assert_eq!(input.variable_pct, Some(12.5));
        assert_eq!(input.notice_period_days, Some(60));
        assert_eq!(input.status, Some(EmploymentStatus::Active));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateEmployeeInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateEmployeeInput {
            status: Some(EmploymentStatus::OnLeave),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_query_defaults_are_none() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.q.is_none());
        assert!(q.department_id.is_none());
        assert!(q.designation_id.is_none());
        assert!(q.status.is_none());
    }

    #[test]
    fn list_query_accepts_filters() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "page": 2,
            "limit": 50,
            "q": "asha",
            "departmentId": "507f1f77bcf86cd799439011",
            "designationId": "507f1f77bcf86cd799439012",
            "status": "active",
        }))
        .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.limit, Some(50));
        assert_eq!(q.q.as_deref(), Some("asha"));
        assert_eq!(q.department_id.as_deref(), Some("507f1f77bcf86cd799439011"));
        assert_eq!(
            q.designation_id.as_deref(),
            Some("507f1f77bcf86cd799439012")
        );
        assert_eq!(q.status.as_deref(), Some("active"));
    }
}
