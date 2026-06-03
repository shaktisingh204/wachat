//! §9.3 Attendance — DTOs.
//!
//! Mongo collection: `crm_attendance`. One document per employee per
//! day. The struct flattens `Identity` + `Audit` from `crm-core` so the
//! ownership/audit fields land at the document root.
//!
//! Spec (§9.3 verbatim): Date ★, Employee ★, Shift, Punch-in
//! time/location/selfie, Punch-out time/location/selfie, Break in/out,
//! Total hours ⚙, Overtime hours ⚙, Status (present/absent/half-day/
//! leave/holiday/WFH), Late by, Early-out by, Source (manual/biometric/
//! web/mobile), Approver, Notes.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ===================== Punch + break sub-types ===================== */

/// Geo + device snapshot captured at a single punch event. All fields
/// except `at` are optional — kiosks may have lat/long but no selfie,
/// biometric devices skip lat/long entirely, and web punches expose IP
/// but not device.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PunchPoint {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lat: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lng: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    /// Free-form device identifier (e.g. user-agent or kiosk serial).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device: Option<String>,
    /// SabFiles `_id` of the selfie captured at punch.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selfie_file_id: Option<ObjectId>,
}

/// One break interval. `out` is `None` while the break is in progress.
///
/// Note: `in` is a Rust reserved keyword, so the field is declared as
/// `r#in` but `#[serde(rename = "in")]` keeps the JSON key as plain
/// `"in"` so the wire format matches the spec.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakSlot {
    #[serde(rename = "in")]
    pub r#in: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub out: Option<DateTime<Utc>>,
}

/* ===================== Enums ===================== */

/// Day-level attendance verdict. `HalfDay` and `Wfh` need explicit
/// renames so the JSON wire format stays consistent (`"half_day"`,
/// `"wfh"`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttendanceStatus {
    #[default]
    Present,
    Absent,
    HalfDay,
    Leave,
    Holiday,
    Wfh,
}

/// Where the punch came from. Drives auditability + which fields on
/// `PunchPoint` are likely populated.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AttendanceSource {
    #[default]
    Manual,
    Biometric,
    Web,
    Mobile,
}

/* ===================== Attendance ===================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attendance {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Calendar day this record covers. Stored as the start-of-day
    /// instant in the tenant timezone — server actions normalize.
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,
    /// Employee `_id` (FK into `crm_employees`).
    pub employee_id: ObjectId,
    /// Optional reference to the shift the employee was scheduled for
    /// (FK into the shift catalog). Drives late/early calculations.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shift_id: Option<ObjectId>,

    /* ----- punch events ----------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub punch_in: Option<PunchPoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub punch_out: Option<PunchPoint>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub breaks: Vec<BreakSlot>,

    /* ----- derived totals (⚙ in spec — server-computed) --------- */
    /// Worked hours after subtracting breaks. `f32` is plenty for a
    /// day's worth of hours and matches the server-side rounding.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_hours: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overtime_hours: Option<f32>,

    /* ----- workflow --------------------------------------------- */
    #[serde(default)]
    pub status: AttendanceStatus,
    /// Minutes late vs the scheduled shift start.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub late_by_minutes: Option<u32>,
    /// Minutes early-out vs the scheduled shift end.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub early_out_by_minutes: Option<u32>,
    #[serde(default)]
    pub source: AttendanceSource,
    /// Manager / HR who approved a manual or corrected entry.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
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
    fn attendance_round_trips_with_snake_case_status() {
        let now = Utc::now();
        let att = Attendance {
            identity: sample_identity(),
            audit: Audit::new(None),
            date: now,
            employee_id: ObjectId::new(),
            shift_id: Some(ObjectId::new()),
            punch_in: Some(PunchPoint {
                at: now,
                lat: Some(12.9716),
                lng: Some(77.5946),
                ip: Some("203.0.113.42".into()),
                device: Some("Mozilla/5.0".into()),
                selfie_file_id: Some(ObjectId::new()),
            }),
            punch_out: Some(PunchPoint {
                at: now,
                lat: Some(12.9716),
                lng: Some(77.5946),
                ip: Some("203.0.113.42".into()),
                device: Some("Mozilla/5.0".into()),
                selfie_file_id: None,
            }),
            breaks: vec![BreakSlot {
                r#in: now,
                out: Some(now),
            }],
            total_hours: Some(4.0),
            overtime_hours: Some(0.0),
            status: AttendanceStatus::HalfDay,
            late_by_minutes: Some(15),
            early_out_by_minutes: None,
            source: AttendanceSource::Web,
            approver_id: Some(ObjectId::new()),
            notes: Some("Doctor appointment after lunch.".into()),
        };

        let json = serde_json::to_value(&att).unwrap();

        // Identity + Audit flattened to root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity-specific fields.
        assert!(json.get("employeeId").is_some());
        assert!(json.get("shiftId").is_some());
        assert!(json.get("punchIn").is_some());
        assert!(json.get("punchOut").is_some());
        assert!(json.get("totalHours").is_some());
        assert!(json.get("overtimeHours").is_some());
        assert!(json.get("lateByMinutes").is_some());
        assert!(json.get("approverId").is_some());

        // HalfDay -> "half_day" snake_case round-trips on the wire.
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("half_day"),
            "HalfDay must serialize as snake_case 'half_day'"
        );
        // Source enum serializes lowercase.
        assert_eq!(json.get("source").and_then(|v| v.as_str()), Some("web"),);

        // BreakSlot's `in` keyword: keep the wire key as plain "in".
        let breaks = json.get("breaks").and_then(|v| v.as_array()).unwrap();
        assert!(
            breaks[0].get("in").is_some(),
            "BreakSlot.in must serialize as 'in'"
        );

        // Round-trip back.
        let back: Attendance = serde_json::from_value(json).unwrap();
        assert_eq!(back.status, AttendanceStatus::HalfDay);
        assert_eq!(back.source, AttendanceSource::Web);
        assert_eq!(back.late_by_minutes, Some(15));
        assert_eq!(back.breaks.len(), 1);
    }
}
