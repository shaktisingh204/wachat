//! Lists + subscribers.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailList {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_from_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_from_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscriber_count: Option<u64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub archived_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailListInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub default_from_name: Option<String>,
    #[serde(default)]
    pub default_from_email: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailSubscriberStatus {
    Subscribed,
    Unsubscribed,
    Pending,
    Bounced,
    Complained,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailSubscriber {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub list_id: ObjectId,
    pub email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub custom_fields: serde_json::Value,
    pub status: EmailSubscriberStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engagement: Option<EmailSubscriberEngagement>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailSubscriberEngagement {
    #[serde(default)]
    pub send_count: u64,
    #[serde(default)]
    pub open_count: u64,
    #[serde(default)]
    pub click_count: u64,
    #[serde(default)]
    pub last_sent_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub last_opened_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub last_clicked_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub predicted_send_hour: Option<u8>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailSubscriberInput {
    pub email: String,
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub custom_fields: serde_json::Value,
    #[serde(default)]
    pub status: Option<EmailSubscriberStatus>,
}
