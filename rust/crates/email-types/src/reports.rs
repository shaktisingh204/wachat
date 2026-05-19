//! Pre-aggregated report rows persisted into `email_reports_cache`.
//!
//! Mirrors the `EmailReportsCache` TypeScript shape declared in
//! `src/lib/email/types.ts`. The aggregator worker (`email-reports`)
//! upserts one row per `(scope, scopeId, bucket, bucketAt)` tuple
//! so the read path on the HTTP surface can serve KPI tiles without
//! re-aggregating the raw `email_events` ledger each request.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Scope of the cached aggregate. `campaign` and `journey` rows are
/// keyed by `scopeId`; `account` and `tenant` rows omit it.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EmailReportScope {
    Campaign,
    Journey,
    Account,
    Tenant,
}

/// Bucket granularity. `Lifetime` rows are upserted with `bucketAt`
/// pinned to the Unix epoch so the upsert key is stable.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EmailReportBucket {
    Day,
    Hour,
    Lifetime,
}

/// KPI metrics stamped into every cache row.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EmailReportMetrics {
    #[serde(default)]
    pub sent: u64,
    #[serde(default)]
    pub delivered: u64,
    #[serde(default)]
    pub opened: u64,
    #[serde(default)]
    pub unique_opens: u64,
    #[serde(default)]
    pub clicked: u64,
    #[serde(default)]
    pub unique_clicks: u64,
    #[serde(default)]
    pub bounced: u64,
    #[serde(default)]
    pub complained: u64,
    #[serde(default)]
    pub unsubscribed: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revenue: Option<f64>,
}

/// One row of `email_reports_cache`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailReportsCache {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub scope: EmailReportScope,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope_id: Option<ObjectId>,
    pub bucket: EmailReportBucket,
    pub bucket_at: DateTime<Utc>,
    pub metrics: EmailReportMetrics,
    pub updated_at: DateTime<Utc>,
}
