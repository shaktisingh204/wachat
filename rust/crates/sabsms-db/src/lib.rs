use bson::{oid::ObjectId, DateTime as BsonDateTime};
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsNumber {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: String,
    pub e164: String,
    pub country: String,
    pub r#type: String,
    pub provider: String,
    pub provider_number_id: Option<String>,
    pub capabilities: NumberCapabilities,
    pub status: String,
    pub monthly_cost: Option<i32>,
    pub created_at: BsonDateTime,
    pub released_at: Option<BsonDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumberCapabilities {
    pub sms: bool,
    pub mms: bool,
    pub rcs: bool,
    pub voice: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: String,
    pub idempotency_key: Option<String>,
    pub direction: String,
    pub channel: String,
    pub from: String,
    pub to: String,
    pub body: String,
    pub media: Option<Vec<SabsmsMedia>>,
    pub category: String,
    pub status: String,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub provider: String,
    pub provider_account_id: Option<String>,
    pub provider_message_id: Option<String>,
    pub template_id: Option<String>,
    pub campaign_id: Option<String>,
    pub conversation_id: Option<String>,
    pub contact_id: Option<String>,
    pub event_key: Option<String>,
    pub segments_count: Option<i32>,
    pub price: Option<i32>,
    pub cost: Option<i32>,
    pub tags: Option<Vec<String>>,
    pub queued_at: Option<BsonDateTime>,
    pub sent_at: Option<BsonDateTime>,
    pub delivered_at: Option<BsonDateTime>,
    pub failed_at: Option<BsonDateTime>,
    pub created_at: BsonDateTime,
    pub updated_at: BsonDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsMedia {
    pub sab_file_id: String,
    pub mime: String,
    pub bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsTemplate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: String,
    pub name: String,
    pub category: String,
    pub bodies: Vec<SabsmsTemplateBody>,
    pub variables: Option<Vec<String>>,
    pub status: String,
    pub reviewer_notes: Option<String>,
    pub dlt: Option<SabsmsTemplateDlt>,
    pub tendlc: Option<SabsmsTemplateTendlc>,
    pub created_at: BsonDateTime,
    pub updated_at: BsonDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsTemplateBody {
    pub locale: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsTemplateDlt {
    pub principal_entity_id: Option<String>,
    pub template_id: Option<String>,
    pub header_id: Option<String>,
    pub content_category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsTemplateTendlc {
    pub brand_id: Option<String>,
    pub campaign_id: Option<String>,
    pub use_case: Option<String>,
    pub sample_messages: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsCampaign {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: String,
    pub name: String,
    pub template_id: String,
    pub audience: SabsmsCampaignAudience,
    pub schedule: SabsmsCampaignSchedule,
    pub throttle_per_second: Option<i32>,
    pub sender_strategy: String,
    pub sender_number_ids: Option<Vec<String>>,
    pub category: String,
    pub status: String,
    pub stats: SabsmsCampaignStats,
    pub scheduled_at: Option<BsonDateTime>,
    pub started_at: Option<BsonDateTime>,
    pub completed_at: Option<BsonDateTime>,
    pub created_at: BsonDateTime,
    pub updated_at: BsonDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SabsmsCampaignAudience {
    #[serde(rename = "segment")]
    Segment { segment_id: String },
    #[serde(rename = "contacts")]
    Contacts { contact_ids: Vec<String> },
    #[serde(rename = "csv")]
    Csv { sab_file_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SabsmsCampaignSchedule {
    #[serde(rename = "immediate")]
    Immediate,
    #[serde(rename = "scheduled")]
    Scheduled { send_at: BsonDateTime },
    #[serde(rename = "recurring")]
    Recurring { cron: String },
    #[serde(rename = "drip")]
    Drip { drip_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsCampaignStats {
    pub total: i32,
    pub queued: i32,
    pub sent: i32,
    pub delivered: i32,
    pub failed: i32,
    pub replied: i32,
    pub clicked: i32,
    pub unsubscribed: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsSuppression {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: String,
    pub phone_hash: String,
    pub source: String,
    pub reason: Option<String>,
    pub created_at: BsonDateTime,
}

#[derive(Clone)]
pub struct SabsmsDb {
    pub db: Database,
}

impl SabsmsDb {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn messages(&self) -> Collection<SabsmsMessage> {
        self.db.collection("sabsms_messages")
    }

    pub fn numbers(&self) -> Collection<SabsmsNumber> {
        self.db.collection("sabsms_numbers")
    }

    pub fn templates(&self) -> Collection<SabsmsTemplate> {
        self.db.collection("sabsms_templates")
    }

    pub fn campaigns(&self) -> Collection<SabsmsCampaign> {
        self.db.collection("sabsms_campaigns")
    }

    pub fn suppressions(&self) -> Collection<SabsmsSuppression> {
        self.db.collection("sabsms_suppressions")
    }
}
