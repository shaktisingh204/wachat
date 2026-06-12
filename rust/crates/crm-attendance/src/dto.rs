//! Wire-format request DTOs for the attendance endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`hrm_payroll_types::Attendance`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send
//! IN (create-input, update-input, list-query, punch-input).
//!
//! Field naming matches the existing TS server action and the
//! `Attendance` struct in `hrm-payroll-types::attendance`. All structs
//! use `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.

use chrono::{DateTime, Utc};
use hrm_payroll_types::{AttendanceSource, AttendanceStatus, BreakSlot, PunchPoint};
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{attendanceId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project` (the
/// `/v1/sabcrm/people/attendance` mount), ignored on the legacy
/// `userId`-scoped mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `GET /v1/crm/attendance` query string.
///
/// Filtering is intentionally narrow because attendance is high-volume —
/// the four filters (`employeeId`, `dateFrom`/`dateTo`, `status`) cover
/// the vast majority of dashboards (single-employee timesheet,
/// monthly/weekly window, "who is absent today").
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/people/attendance` mount); ignored on the legacy
    /// `userId`-scoped mounts.
    #[serde(default)]
    pub project_id: Option<String>,
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Filter to a single employee (24-char hex). Most common filter for
    /// employee-self-service timesheet views.
    #[serde(default)]
    pub employee_id: Option<String>,
    /// Inclusive lower bound on `date`. ISO-8601 datetime (plain chrono
    /// serde — the wire is JSON/query-string, not BSON; the handler
    /// converts via `bson::DateTime::from_chrono` for the Mongo filter).
    #[serde(default)]
    pub date_from: Option<DateTime<Utc>>,
    /// Inclusive upper bound on `date`. ISO-8601 datetime.
    #[serde(default)]
    pub date_to: Option<DateTime<Utc>>,
    /// Filter to a single attendance verdict (e.g. `"absent"`,
    /// `"half_day"`). Wire format must match the snake_case
    /// serialization of [`AttendanceStatus`].
    #[serde(default)]
    pub status: Option<AttendanceStatus>,
}

/// `POST /v1/crm/attendance` body. Accepts the full surface of an
/// Attendance document so back-office HR users can correct historical
/// rows from a desktop UI. Mobile / kiosk flows should prefer the
/// `/punch-in` and `/punch-out` shorthands instead.
///
/// **Required:** `date`, `employeeId`, `status`.
/// **Optional:** everything else — derived totals, geo points, and
/// approval metadata default to `None` until the source system stamps
/// them.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAttendanceInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- required ★ ----- */
    /// Calendar day this record covers. Server actions normalize to
    /// start-of-day in the tenant timezone before persisting. ISO-8601
    /// datetime on the JSON wire (plain chrono serde — bson's
    /// `DateTime` deserializer only accepts extended JSON, which the
    /// TS clients never send).
    pub date: DateTime<Utc>,
    /// Employee `_id` (24-char hex). FK into `crm_employees`.
    pub employee_id: String,
    /// Day-level verdict. Required so payroll can roll up by status
    /// without a downstream NULL-handling step.
    pub status: AttendanceStatus,

    /* ----- optional ----- */
    /// Optional reference to the shift the employee was scheduled for
    /// (24-char hex). Drives late/early calculations.
    #[serde(default)]
    pub shift_id: Option<String>,

    #[serde(default)]
    pub punch_in: Option<PunchPoint>,
    #[serde(default)]
    pub punch_out: Option<PunchPoint>,
    #[serde(default)]
    pub breaks: Vec<BreakSlot>,

    /// Worked hours after subtracting breaks. Server-computed in the
    /// happy path; HR can override on a manual correction entry.
    #[serde(default)]
    pub total_hours: Option<f32>,
    #[serde(default)]
    pub overtime_hours: Option<f32>,

    /// Minutes late vs the scheduled shift start.
    #[serde(default)]
    pub late_by_minutes: Option<u32>,
    /// Minutes early-out vs the scheduled shift end.
    #[serde(default)]
    pub early_out_by_minutes: Option<u32>,

    /// Where the punch came from. Defaults to `manual` when absent —
    /// matches the [`AttendanceSource`] default.
    #[serde(default)]
    pub source: Option<AttendanceSource>,

    /// Manager / HR who approved a manual or corrected entry (24-char hex).
    #[serde(default)]
    pub approver_id: Option<String>,

    #[serde(default)]
    pub notes: Option<String>,
}

/// `PATCH /v1/crm/attendance/:attendanceId` body. Every field is
/// optional; only the fields explicitly sent are modified on the
/// document. The handler always refreshes `updatedAt` regardless of
/// which fields are set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAttendanceInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shift_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub punch_in: Option<PunchPoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub punch_out: Option<PunchPoint>,
    /// When `Some`, the entire breaks array is replaced (PATCH semantics
    /// at the array level — partial-array edits aren't supported).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breaks: Option<Vec<BreakSlot>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_hours: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overtime_hours: Option<f32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<AttendanceStatus>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub late_by_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub early_out_by_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<AttendanceSource>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

impl UpdateAttendanceInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.date.is_none()
            && self.employee_id.is_none()
            && self.shift_id.is_none()
            && self.punch_in.is_none()
            && self.punch_out.is_none()
            && self.breaks.is_none()
            && self.total_hours.is_none()
            && self.overtime_hours.is_none()
            && self.status.is_none()
            && self.late_by_minutes.is_none()
            && self.early_out_by_minutes.is_none()
            && self.source.is_none()
            && self.approver_id.is_none()
            && self.notes.is_none()
    }
}

/// `POST /v1/crm/attendance/punch-in` and `/punch-out` body — the
/// shorthand mobile-app flow.
///
/// The request stamps a punch on the *current* employee's *today* row.
/// "Current employee" is resolved by `employeeId` on the body (the
/// caller's app already knows it from the user profile); "today" is the
/// instant on the server when the request lands. If no row exists for
/// (employeeId, today), the handler creates one with `status = present`
/// and `source = mobile` (overridable via [`PunchInput::source`]).
///
/// All fields except `employeeId` are optional — if `at` is absent the
/// server stamps `Utc::now()`, which is the desired behaviour for 99 %
/// of mobile clients (the device clock is not authoritative).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PunchInput {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/people/attendance` mount); ignored on the legacy
    /// `userId`-scoped mounts.
    #[serde(default)]
    pub project_id: Option<String>,

    /// Employee `_id` (24-char hex). Must be supplied — the punch
    /// endpoints do not (yet) read employee identity from the JWT
    /// claims because employee != user in the SabNode model.
    pub employee_id: String,

    /// Optional override of the punch instant. Defaults to `Utc::now()`.
    /// ISO-8601 datetime (plain chrono serde).
    #[serde(default)]
    pub at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub lat: Option<f64>,
    #[serde(default)]
    pub lng: Option<f64>,
    #[serde(default)]
    pub ip: Option<String>,
    #[serde(default)]
    pub device: Option<String>,
    /// SabFiles `_id` of the selfie captured at punch (24-char hex).
    #[serde(default)]
    pub selfie_file_id: Option<String>,

    /// Source override. Defaults to [`AttendanceSource::Mobile`] for
    /// these endpoints (matches the typical caller).
    #[serde(default)]
    pub source: Option<AttendanceSource>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "date": "2026-05-07T00:00:00Z",
            "employeeId": "507f1f77bcf86cd799439011",
            "status": "half_day",
            "lateByMinutes": 15,
            "totalHours": 4.0,
            "source": "web",
        });
        let input: CreateAttendanceInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.employee_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.status, AttendanceStatus::HalfDay);
        assert_eq!(input.late_by_minutes, Some(15));
        assert_eq!(input.total_hours, Some(4.0));
        assert_eq!(input.source, Some(AttendanceSource::Web));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateAttendanceInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateAttendanceInput {
            status: Some(AttendanceStatus::Absent),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_query_defaults_are_none() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.employee_id.is_none());
        assert!(q.date_from.is_none());
        assert!(q.date_to.is_none());
        assert!(q.status.is_none());
    }

    #[test]
    fn list_query_parses_status_snake_case() {
        let q: ListQuery =
            serde_json::from_value(serde_json::json!({ "status": "half_day" })).unwrap();
        assert_eq!(q.status, Some(AttendanceStatus::HalfDay));
    }

    #[test]
    fn punch_input_minimal_payload() {
        let json = serde_json::json!({ "employeeId": "507f1f77bcf86cd799439011" });
        let input: PunchInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.employee_id, "507f1f77bcf86cd799439011");
        assert!(input.at.is_none());
        assert!(input.source.is_none());
        assert!(input.project_id.is_none());
    }

    #[test]
    fn punch_input_parses_camel_case_project_id() {
        let json = serde_json::json!({
            "employeeId": "507f1f77bcf86cd799439011",
            "projectId": "507f1f77bcf86cd799439099",
        });
        let input: PunchInput = serde_json::from_value(json).unwrap();
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
