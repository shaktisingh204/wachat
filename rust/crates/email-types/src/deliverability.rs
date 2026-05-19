use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailWarmupStatus { Pending, Running, Paused, Completed }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailWarmupSchedule {
    pub day: u32,
    pub cap: u64,
    #[serde(default)]
    pub sent_today: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailWarmupRun {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub domain: String,
    pub status: EmailWarmupStatus,
    pub started_at: DateTime<Utc>,
    #[serde(default)]
    pub completed_at: Option<DateTime<Utc>>,
    pub schedule: Vec<EmailWarmupSchedule>,
    pub current_day: u32,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailDnsSnapshot {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub domain: String,
    pub records: EmailDnsRecords,
    pub score: u8,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailDnsRecords {
    #[serde(default)]
    pub spf: Option<EmailSpfRecord>,
    #[serde(default)]
    pub dkim: Option<EmailDkimRecord>,
    #[serde(default)]
    pub dmarc: Option<EmailDmarcRecord>,
    #[serde(default)]
    pub mx: Option<EmailMxRecord>,
    #[serde(default)]
    pub bimi: Option<EmailBimiRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailSpfRecord {
    pub record: String,
    pub valid: bool,
    #[serde(default)]
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailDkimRecord {
    pub selector: String,
    pub record: String,
    pub valid: bool,
    #[serde(default)]
    pub bits: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailDmarcRecord {
    pub record: String,
    #[serde(default)]
    pub policy: Option<EmailDmarcPolicy>,
    pub valid: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EmailDmarcPolicy { None, Quarantine, Reject }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailMxRecord {
    pub records: Vec<String>,
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBimiRecord {
    pub record: String,
    pub valid: bool,
}
