use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum EmailEventKind {
    Send,
    Delivered,
    Open,
    Click,
    BounceHard,
    BounceSoft,
    Complaint,
    Unsubscribe,
    Dropped,
    Deferred,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailEventGeo {
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailEvent {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub kind: EmailEventKind,
    #[serde(default)]
    pub campaign_id: Option<ObjectId>,
    #[serde(default)]
    pub journey_id: Option<ObjectId>,
    #[serde(default)]
    pub subscriber_id: Option<ObjectId>,
    #[serde(default)]
    pub message_id: Option<String>,
    pub email: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub ip: Option<String>,
    #[serde(default)]
    pub geo: Option<EmailEventGeo>,
    #[serde(default)]
    pub reason: Option<String>,
    pub provider: String,
    pub occurred_at: DateTime<Utc>,
    pub ingested_at: DateTime<Utc>,
}
