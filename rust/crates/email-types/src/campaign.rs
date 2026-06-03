use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailCampaignType {
    Regular,
    Ab,
    Rss,
    Plain,
    Transactional,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailCampaignStatus {
    Draft,
    Scheduled,
    Sending,
    Sent,
    Paused,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailCampaignVariant {
    pub id: String,
    pub subject: String,
    pub from_name: String,
    pub from_email: String,
    #[serde(default)]
    pub template_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(default)]
    pub scheduled_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metrics: Option<EmailVariantMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailVariantMetrics {
    #[serde(default)]
    pub sent: u64,
    #[serde(default)]
    pub opens: u64,
    #[serde(default)]
    pub clicks: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailCampaignAbConfig {
    pub test_what: AbTestField,
    pub sample_size: u8, // %
    pub winner_metric: AbWinnerMetric,
    pub winner_after_hours: u32,
    #[serde(default)]
    pub winner_variant_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AbTestField {
    Subject,
    From,
    Content,
    SendTime,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AbWinnerMetric {
    OpenRate,
    ClickRate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailCampaign {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: EmailCampaignType,
    pub status: EmailCampaignStatus,
    pub subject: String,
    pub from_name: String,
    pub from_email: String,
    #[serde(default)]
    pub preheader: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub template_id: Option<ObjectId>,
    #[serde(default)]
    pub brand_kit_id: Option<ObjectId>,
    #[serde(default)]
    pub list_ids: Vec<ObjectId>,
    #[serde(default)]
    pub segment_ids: Vec<ObjectId>,
    #[serde(default)]
    pub variants: Vec<EmailCampaignVariant>,
    #[serde(default)]
    pub ab_config: Option<EmailCampaignAbConfig>,
    #[serde(default = "default_true")]
    pub track_opens: bool,
    #[serde(default = "default_true")]
    pub track_clicks: bool,
    #[serde(default)]
    pub scheduled_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn default_true() -> bool {
    true
}
