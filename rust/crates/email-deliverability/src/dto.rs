//! Wire DTOs (HTTP request / response shapes) the email-deliverability
//! router speaks. All bodies use `#[serde(rename_all = "camelCase")]` to
//! match the JSON shape the TS client sends.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Domains + DNS snapshots
// ---------------------------------------------------------------------------

/// One row returned by `GET /domains` — minimal projection over a stored
/// `email_dns_snapshots` document or `email_settings.senderDomain`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainRow {
    pub domain: String,
    /// Last computed score (0..=100). `None` if no snapshot exists yet.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_score: Option<u8>,
    /// ISO-8601 timestamp of the last DNS check, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_checked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDomainsResponse {
    pub domains: Vec<DomainRow>,
}

/// Per-record envelope returned by [`crate::dns::check_domain`]. Mirrors
/// the TS `EmailDnsSnapshot.records.{spf,dkim,dmarc,mx,bimi}` shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpfRecord {
    pub record: String,
    pub valid: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DkimRecord {
    pub selector: String,
    pub record: String,
    pub valid: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bits: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DmarcRecord {
    pub record: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy: Option<String>,
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MxRecord {
    pub records: Vec<String>,
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BimiRecord {
    pub record: String,
    pub valid: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsRecords {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spf: Option<SpfRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dkim: Option<DkimRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dmarc: Option<DmarcRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mx: Option<MxRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bimi: Option<BimiRecord>,
}

/// Result of a live DNS check. Persisted to `email_dns_snapshots` and
/// returned from `POST /domains/{domain}/check`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsSnapshot {
    pub domain: String,
    pub records: DnsRecords,
    /// 0..=100. Computed by [`crate::dns::score_snapshot`].
    pub score: u8,
    /// ISO-8601 timestamp.
    pub checked_at: String,
}

/// Optional query for `POST /domains/{domain}/check` — lets the caller
/// supply the DKIM selector to look up (defaults to `"default"`).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckDomainQuery {
    #[serde(default)]
    pub selector: Option<String>,
}

// ---------------------------------------------------------------------------
// DKIM keypair generation + rotation
// ---------------------------------------------------------------------------

/// Body for `POST /domains/{domain}/dkim/generate`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DkimGenerateBody {
    /// Selector to use for the new key (defaults to a random `sab<8hex>`).
    #[serde(default)]
    pub selector: Option<String>,
    /// RSA key size in bits — accepted values are 1024 / 2048. Defaults
    /// to 2048 if missing.
    #[serde(default)]
    pub bits: Option<u32>,
}

/// Response from `POST /domains/{domain}/dkim/generate`. The caller is
/// expected to publish `dns_record` as a TXT under
/// `{selector}._domainkey.{domain}` and then call `dkim/rotate` once the
/// record is live.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DkimGenerateResponse {
    pub selector: String,
    /// PEM-encoded RSA private key. Stored only on the server side
    /// (`email_settings.dkim.pending.privateKey`) — the response includes
    /// it once so an external signing service can fetch it if needed.
    pub private_key: String,
    /// The exact TXT record value to publish at
    /// `{selector}._domainkey.{domain}`.
    pub dns_record: String,
    pub bits: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DkimRotateResponse {
    /// New active selector after promotion.
    pub active_selector: String,
    /// Selector that has been moved to `rotating` (kept for ~7 days so
    /// in-flight messages still verify).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rotating_selector: Option<String>,
}

// ---------------------------------------------------------------------------
// Warmup
// ---------------------------------------------------------------------------

/// One day in a warmup schedule. Mirrors the TS
/// `EmailWarmupRun.schedule[]` shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WarmupDay {
    pub day: u32,
    pub cap: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sent_today: Option<u32>,
}

/// Wire shape for a warmup run.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WarmupRun {
    pub id: String,
    pub domain: String,
    pub status: String,
    pub schedule: Vec<WarmupDay>,
    pub current_day: u32,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WarmupListResponse {
    pub runs: Vec<WarmupRun>,
}

/// Body for `POST /warmup`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartWarmupBody {
    pub domain: String,
    #[serde(default)]
    pub schedule: Vec<WarmupDay>,
    #[serde(default)]
    pub notes: Option<String>,
}

/// Body for `PATCH /warmup/{id}` — `action` is one of
/// `"pause" | "resume" | "cancel"`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWarmupBody {
    pub action: String,
}

// ---------------------------------------------------------------------------
// Placement test
// ---------------------------------------------------------------------------

/// Result envelope for `GET /placement` — returns the most recent
/// placement test for the tenant (any domain).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacementResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunPlacementBody {
    pub domain: String,
    /// Optional campaign id this test should be associated with.
    #[serde(default)]
    pub campaign_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunPlacementResponse {
    pub id: String,
    pub status: String,
}

// ---------------------------------------------------------------------------
// Score rollup
// ---------------------------------------------------------------------------

/// Rolled-up deliverability score returned by `GET /score`. Combines DNS
/// validity (60% weight) with bounce / complaint rates from the last 30
/// days of `email_events` (40% weight).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreResponse {
    pub score: u8,
    pub dns_score: u8,
    pub bounce_rate: f64,
    pub complaint_rate: f64,
    /// Window of events considered, in days.
    pub window_days: u32,
}

// ---------------------------------------------------------------------------
// Generic message envelope (matches the broadcast crate convention)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}
