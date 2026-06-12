use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// JSON-wire shapes that mirror `src/lib/sabsms/types.ts`. Field order
/// doesn't matter — serde uses tags. CamelCase is the wire convention.

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    Outbound,
    Inbound,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Channel {
    Sms,
    Mms,
    Rcs,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MessageStatus {
    Queued,
    Sending,
    Sent,
    Delivered,
    Failed,
    Undelivered,
    Rejected,
    Suppressed,
}

impl MessageStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            MessageStatus::Queued => "queued",
            MessageStatus::Sending => "sending",
            MessageStatus::Sent => "sent",
            MessageStatus::Delivered => "delivered",
            MessageStatus::Failed => "failed",
            MessageStatus::Undelivered => "undelivered",
            MessageStatus::Rejected => "rejected",
            MessageStatus::Suppressed => "suppressed",
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MessageCategory {
    Transactional,
    Otp,
    Marketing,
    Alert,
    Service,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderId {
    Twilio,
    /// Test-only provider used by e2e suites (`SABSMS_PROVIDER_MOCK=true`).
    Mock,
    Vonage,
    Messagebird,
    Plivo,
    Sinch,
    Infobip,
    AwsSns,
    Telnyx,
    Msg91,
    Gupshup,
    Textlocal,
    Kaleyra,
    Karix,
}

impl ProviderId {
    pub fn as_str(self) -> &'static str {
        match self {
            ProviderId::Twilio => "twilio",
            ProviderId::Mock => "mock",
            ProviderId::Vonage => "vonage",
            ProviderId::Messagebird => "messagebird",
            ProviderId::Plivo => "plivo",
            ProviderId::Sinch => "sinch",
            ProviderId::Infobip => "infobip",
            ProviderId::AwsSns => "aws_sns",
            ProviderId::Telnyx => "telnyx",
            ProviderId::Msg91 => "msg91",
            ProviderId::Gupshup => "gupshup",
            ProviderId::Textlocal => "textlocal",
            ProviderId::Kaleyra => "kaleyra",
            ProviderId::Karix => "karix",
        }
    }

    /// Parse the lowercase wire / Mongo string form back to an id.
    pub fn parse(s: &str) -> Option<ProviderId> {
        Some(match s {
            "twilio" => ProviderId::Twilio,
            "mock" => ProviderId::Mock,
            "vonage" => ProviderId::Vonage,
            "messagebird" => ProviderId::Messagebird,
            "plivo" => ProviderId::Plivo,
            "sinch" => ProviderId::Sinch,
            "infobip" => ProviderId::Infobip,
            "aws_sns" => ProviderId::AwsSns,
            "telnyx" => ProviderId::Telnyx,
            "msg91" => ProviderId::Msg91,
            "gupshup" => ProviderId::Gupshup,
            "textlocal" => ProviderId::Textlocal,
            "kaleyra" => ProviderId::Kaleyra,
            "karix" => ProviderId::Karix,
            _ => return None,
        })
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Media {
    pub sab_file_id: String,
    pub mime: String,
    pub bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueSendInput {
    pub workspace_id: String,
    pub to: String,
    pub body: String,
    pub category: MessageCategory,
    #[serde(default)]
    pub channel: Option<Channel>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub provider_account_id: Option<String>,
    #[serde(default)]
    pub provider: Option<ProviderId>,
    #[serde(default)]
    pub sender_id: Option<String>,
    #[serde(default)]
    pub template_id: Option<String>,
    #[serde(default)]
    pub template_prefix: Option<String>,
    #[serde(default)]
    pub campaign_id: Option<String>,
    #[serde(default)]
    pub contact_id: Option<String>,
    #[serde(default)]
    pub event_key: Option<String>,
    #[serde(default)]
    pub media: Option<Vec<Media>>,
    #[serde(default)]
    pub idempotency_key: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueSendResult {
    pub id: String,
    pub status: MessageStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segments: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_cost: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditReserveRequest {
    pub workspace_id: String,
    pub message_id: String,
    pub segments: u32,
    pub estimated_cost: i64,
    pub category: MessageCategory,
    pub destination_country: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditReserveResponse {
    pub reservation_token: String,
    pub approved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Body for the Next credits callback `op=reserve-batch` — one
/// affordability gate covering a claimed campaign batch.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignBatchReserveRequest {
    pub workspace_id: String,
    pub campaign_id: String,
    pub count: u32,
    pub segments_total: u32,
    pub estimated_cost: i64,
    pub category: MessageCategory,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditFinaliseRequest {
    pub workspace_id: String,
    pub message_id: String,
    pub reservation_token: String,
    pub actual_cost: i64,
    pub charge: bool,
}

/// Internal representation written to MongoDB. Kept separate from
/// `EnqueueSendInput` so we can attach engine-side metadata.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageDoc {
    pub workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub idempotency_key: Option<String>,
    pub direction: Direction,
    pub channel: Channel,
    pub from: String,
    pub to: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media: Option<Vec<Media>>,
    pub category: MessageCategory,
    pub status: MessageStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    pub provider: ProviderId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub campaign_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segments_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    pub queued_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sent_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delivered_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
