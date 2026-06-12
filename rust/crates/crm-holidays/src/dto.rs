//! Wire-format request DTOs for the holiday endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`hrm_payroll_types::Holiday`] DTO — we deliberately do not redeclare
//! it here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full Holiday model so the API surface stays
//! controlled.
//!
//! All structs use `#[serde(rename_all = "camelCase")]` so JSON
//! requests round-trip with the TS clients.

use chrono::{DateTime, Utc};
use hrm_payroll_types::HolidayType;
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{holidayId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project` (the
/// `/v1/sabcrm/people/holidays` mount), ignored on the legacy
/// `userId`-scoped mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `GET /v1/crm/holidays` query string.
///
/// `year` filters by calendar year (UTC) using `[Jan 1, Jan 1 next-year)`
/// bounds. `holiday_type` matches the canonical lowercase serialization
/// of [`HolidayType`] so the value is always wire-compatible.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/people/holidays` mount); ignored on the legacy
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
    /// 4-digit calendar year (UTC). When present, restricts results to
    /// holidays whose `date` falls in that year.
    #[serde(default)]
    pub year: Option<i32>,
    /// Optional classification filter.
    #[serde(default)]
    pub holiday_type: Option<HolidayType>,
}

/// `POST /v1/crm/holidays` body. Required: `date`, `name`. Everything
/// else is optional and falls back to the `Holiday` defaults.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHolidayInput {
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- required ----- */
    /// Calendar date for this holiday. ISO-8601 datetime (plain chrono
    /// serde — bson's `DateTime` deserializer only accepts extended
    /// JSON, which the TS clients never send; the handler converts via
    /// `bson::DateTime::from_chrono` for the Mongo write).
    pub date: DateTime<Utc>,
    /// Display name ("Republic Day", "Maharashtra Day", …).
    pub name: String,

    /* ----- optional ----- */
    #[serde(default)]
    pub holiday_type: Option<HolidayType>,
    /// Whether the holiday repeats every year on the same date.
    #[serde(default)]
    pub recurring: Option<bool>,
    /// Region / branch identifiers the holiday applies to. Empty means
    /// project-wide.
    #[serde(default)]
    pub applicable_locations: Option<Vec<String>>,
    #[serde(default)]
    pub notes: Option<String>,
}

/// `PATCH /v1/crm/holidays/:holidayId` body. Every field is optional;
/// only the fields explicitly sent are modified on the document. The
/// handler always refreshes `updatedAt` regardless of which fields are
/// set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHolidayInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub holiday_type: Option<HolidayType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub applicable_locations: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

impl UpdateHolidayInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.date.is_none()
            && self.name.is_none()
            && self.holiday_type.is_none()
            && self.recurring.is_none()
            && self.applicable_locations.is_none()
            && self.notes.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "date": "2026-01-26T00:00:00Z",
            "name": "Republic Day",
            "holidayType": "national",
            "recurring": true,
            "applicableLocations": ["india"],
            "notes": "Bank holiday across India.",
        });
        let input: CreateHolidayInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.name, "Republic Day");
        assert_eq!(input.holiday_type, Some(HolidayType::National));
        assert_eq!(input.recurring, Some(true));
        assert_eq!(
            input.applicable_locations.as_deref(),
            Some(&["india".to_string()][..]),
        );
        assert_eq!(input.notes.as_deref(), Some("Bank holiday across India."));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateHolidayInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateHolidayInput {
            name: Some("Republic Day".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_query_defaults_are_none() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.year.is_none());
        assert!(q.holiday_type.is_none());
    }

    #[test]
    fn list_query_parses_holiday_type() {
        let q: ListQuery =
            serde_json::from_value(serde_json::json!({ "holidayType": "regional" })).unwrap();
        assert_eq!(q.holiday_type, Some(HolidayType::Regional));
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
