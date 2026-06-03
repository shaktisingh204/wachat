//! §5.7 Sales-CRM Analytics & Reports — request envelopes.
//!
//! Spec verbatim (§5.7):
//! > Leads Summary, Team Sales Report, Client Performance Report,
//! > Lead Source Report, Pipeline Velocity, Conversion Funnel,
//! > Sales Forecast, Activity Report, Win/Loss Analysis.
//!
//! This module models only the **request** side — the typed envelope
//! callers send when asking for one of the §5.7 reports. Concrete
//! response/result shapes belong with their consumers (see the
//! future `crm-reports-types` crate); they're report-specific and don't
//! share a common shape.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Which §5.7 report is being requested. Snake-case so multi-word
/// variants (`leads_summary`, `pipeline_velocity`, …) round-trip cleanly.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SalesAnalyticsKind {
    #[default]
    LeadsSummary,
    TeamSales,
    ClientPerformance,
    LeadSource,
    PipelineVelocity,
    ConversionFunnel,
    SalesForecast,
    ActivityReport,
    WinLossAnalysis,
}

/// Filters layered onto a [`SalesAnalyticsRequest`]. Every field is
/// optional — the report engine treats `None` as "don't constrain".
///
/// `group_by` is a free-form string (`"day" | "week" | "month" | "owner"
/// | "source"`) so new groupings can roll out without a crate edit.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesAnalyticsFilters {
    /// Window start (inclusive).
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub from: Option<DateTime<Utc>>,
    /// Window end (exclusive).
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub to: Option<DateTime<Utc>>,
    /// Restrict to a single owner.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
    /// Restrict to a pipeline (drives Pipeline Velocity / Conversion
    /// Funnel / Forecast scoping).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pipeline_id: Option<ObjectId>,
    /// Restrict to a sales team (drives Team Sales Report).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_id: Option<ObjectId>,
    /// Restrict to one attribution source (drives Lead Source Report).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// Bucketing dimension. Free-form: `"day" | "week" | "month" |
    /// "owner" | "source"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_by: Option<String>,
}

/// Top-level analytics request envelope. The handler dispatches on
/// [`Self::kind`] and applies [`Self::filters`] uniformly.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesAnalyticsRequest {
    pub kind: SalesAnalyticsKind,
    #[serde(default)]
    pub filters: SalesAnalyticsFilters,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analytics_request_round_trips() {
        let owner = ObjectId::new();
        let pipeline = ObjectId::new();
        let req = SalesAnalyticsRequest {
            kind: SalesAnalyticsKind::PipelineVelocity,
            filters: SalesAnalyticsFilters {
                from: Some(Utc::now()),
                to: Some(Utc::now()),
                owner_id: Some(owner),
                pipeline_id: Some(pipeline),
                team_id: None,
                source: Some("website".to_string()),
                group_by: Some("week".to_string()),
            },
        };

        let json = serde_json::to_value(&req).unwrap();

        // Multi-word enum variant → snake_case.
        assert_eq!(
            json.get("kind").and_then(|v| v.as_str()),
            Some("pipeline_velocity")
        );

        // camelCase filter fields at the nested `filters` key.
        let filters = json.get("filters").unwrap();
        assert!(filters.get("ownerId").is_some());
        assert!(filters.get("pipelineId").is_some());
        assert!(filters.get("groupBy").is_some());
        // Unset filter (`team_id`) skip-serializes.
        assert!(filters.get("teamId").is_none());

        // Round-trip back.
        let back: SalesAnalyticsRequest = serde_json::from_value(json).unwrap();
        assert!(matches!(back.kind, SalesAnalyticsKind::PipelineVelocity));
        assert_eq!(back.filters.source.as_deref(), Some("website"));
        assert_eq!(back.filters.group_by.as_deref(), Some("week"));
        assert_eq!(back.filters.owner_id, Some(owner));
        assert!(back.filters.team_id.is_none());
    }
}
