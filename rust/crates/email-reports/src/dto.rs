//! Wire DTOs for the email-reports HTTP surface.

use serde::{Deserialize, Serialize};

/// Aggregation bucket granularity. `Lifetime` pins `bucketAt` to the
/// Unix epoch so the upsert key is stable across worker runs.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Bucket {
    Day,
    Hour,
    Lifetime,
}

impl Bucket {
    pub fn as_str(self) -> &'static str {
        match self {
            Bucket::Day => "day",
            Bucket::Hour => "hour",
            Bucket::Lifetime => "lifetime",
        }
    }
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportMetrics {
    pub sent: u64,
    pub delivered: u64,
    pub opened: u64,
    pub unique_opens: u64,
    pub clicked: u64,
    pub unique_clicks: u64,
    pub bounced: u64,
    pub complained: u64,
    pub unsubscribed: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revenue: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignReport {
    pub campaign_id: String,
    pub bucket: &'static str,
    pub metrics: ReportMetrics,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    /// `true` when the row came from `email_reports_cache`; `false`
    /// when we aggregated live because the cache row was missing.
    pub from_cache: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyReport {
    pub journey_id: String,
    pub bucket: &'static str,
    pub metrics: ReportMetrics,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    pub from_cache: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountReport {
    pub tenant_id: String,
    pub bucket: &'static str,
    pub metrics: ReportMetrics,
    pub from_cache: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareRow {
    pub campaign_id: String,
    pub metrics: ReportMetrics,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareBody {
    pub campaign_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareResponse {
    pub rows: Vec<CompareRow>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevenueRow {
    pub campaign_id: String,
    pub orders: u64,
    pub revenue: f64,
    pub clicks: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevenueResponse {
    pub rows: Vec<RevenueRow>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBody {
    /// `campaign` | `journey` | `account`
    pub scope: String,
    #[serde(default)]
    pub scope_id: Option<String>,
    /// `csv` | `pdf`
    pub format: String,
}
