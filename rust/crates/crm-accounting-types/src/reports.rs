//! §4.3 Accounting Reports.
//!
//! Request envelopes for the canonical accounting reports — Balance
//! Sheet, Trial Balance, Profit & Loss, Income Statement, Day Book,
//! Cash Flow Statement. These are *not* stored entities; they are
//! pure request DTOs the frontend posts to the report engine, so we
//! do **not** flatten `Identity` / `Audit` here.
//!
//! Filters mirror the spec:
//!   from / to range, optional branch + project scope, optional
//!   comparison period, presentation format (T-form or vertical),
//!   include-zero-balances toggle, and a drill-down level (0 = summary
//!   only, higher = expand sub-ledgers).
//!
//! The default `format` is `Vertical` (the modern presentation used
//! by every Indian accounting suite); `include_zero_balances` defaults
//! to `false` (omit dormant accounts); `drill_down_level` defaults to
//! `0` (summary).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Which canonical report to render.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccountingReportKind {
    BalanceSheet,
    TrialBalance,
    ProfitAndLoss,
    IncomeStatement,
    DayBook,
    CashFlowStatement,
}

/// Presentation layout. `TForm` is the classical two-column
/// debit/credit ledger view; `Vertical` is the modern stacked
/// statement view.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccountingReportFormat {
    TForm,
    #[default]
    Vertical,
}

/// Optional comparison period — when present, the report engine
/// renders a side-by-side comparison column (e.g. "FY24 vs FY23").
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonPeriod {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub to: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

fn is_false(b: &bool) -> bool {
    !*b
}

/// Filters applied to the report run. Branch + project scope are
/// optional (omit = "all branches" / "all projects"). `drill_down_level`
/// of `0` means summary-only; each increment expands one level of the
/// account hierarchy.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountingReportFilters {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub to: DateTime<Utc>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comparison: Option<ComparisonPeriod>,

    #[serde(default)]
    pub format: AccountingReportFormat,

    #[serde(default, skip_serializing_if = "is_false")]
    pub include_zero_balances: bool,

    /// `0` = summary only. Each higher level expands one tier of the
    /// chart-of-accounts tree.
    #[serde(default)]
    pub drill_down_level: u8,
}

/// Top-level request envelope: which report + the filters to run it
/// under.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountingReportRequest {
    pub kind: AccountingReportKind,
    pub filters: AccountingReportFilters,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn kind_and_format_serialize_snake_case() {
        let req = AccountingReportRequest {
            kind: AccountingReportKind::ProfitAndLoss,
            filters: AccountingReportFilters {
                from: Utc.with_ymd_and_hms(2026, 4, 1, 0, 0, 0).unwrap(),
                to: Utc.with_ymd_and_hms(2027, 3, 31, 23, 59, 59).unwrap(),
                branch_id: None,
                project_id: None,
                comparison: None,
                format: AccountingReportFormat::TForm,
                include_zero_balances: false,
                drill_down_level: 0,
            },
        };

        let json = serde_json::to_value(&req).expect("serialize");

        // Kind should be snake_case.
        assert_eq!(
            json.get("kind").and_then(|v| v.as_str()),
            Some("profit_and_loss")
        );

        // Format should be snake_case (TForm -> "t_form").
        let format = json
            .get("filters")
            .and_then(|f| f.get("format"))
            .and_then(|v| v.as_str());
        assert_eq!(format, Some("t_form"));

        // camelCase field name should appear.
        assert!(
            json.get("filters")
                .and_then(|f| f.get("drillDownLevel"))
                .is_some()
        );

        // Round-trip back.
        let back: AccountingReportRequest = serde_json::from_value(json).expect("deserialize");
        assert!(matches!(back.kind, AccountingReportKind::ProfitAndLoss));
        assert!(matches!(back.filters.format, AccountingReportFormat::TForm));
    }
}
