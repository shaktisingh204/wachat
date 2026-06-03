use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::common::EmailAddress;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailInboxThreadStatus {
    Open,
    Pending,
    Closed,
    Archived,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailInboxMessageDirection {
    Inbound,
    Outbound,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailInboxThread {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub account_id: ObjectId,
    pub subject: String,
    pub participants: Vec<EmailAddress>,
    pub status: EmailInboxThreadStatus,
    pub unread: bool,
    #[serde(default)]
    pub starred: bool,
    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default)]
    pub campaign_id: Option<ObjectId>,
    #[serde(default)]
    pub contact_id: Option<ObjectId>,
    #[serde(default)]
    pub assigned_to: Option<ObjectId>,
    #[serde(default)]
    pub sla_due_at: Option<DateTime<Utc>>,
    pub last_message_at: DateTime<Utc>,
    pub last_message_preview: String,
    #[serde(default)]
    pub message_count: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailInboxAttachment {
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailInboxMessage {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub thread_id: ObjectId,
    pub direction: EmailInboxMessageDirection,
    pub from: EmailAddress,
    pub to: Vec<EmailAddress>,
    #[serde(default)]
    pub cc: Vec<EmailAddress>,
    #[serde(default)]
    pub bcc: Vec<EmailAddress>,
    pub subject: String,
    #[serde(default)]
    pub body_text: Option<String>,
    #[serde(default)]
    pub body_html: Option<String>,
    #[serde(default)]
    pub message_id: Option<String>,
    #[serde(default)]
    pub in_reply_to: Option<String>,
    #[serde(default)]
    pub references: Vec<String>,
    #[serde(default)]
    pub attachments: Vec<EmailInboxAttachment>,
    #[serde(default)]
    pub sent_by: Option<ObjectId>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailInboxAssignment {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub thread_id: ObjectId,
    pub assigned_to: ObjectId,
    pub assigned_by: ObjectId,
    pub assigned_at: DateTime<Utc>,
    #[serde(default)]
    pub released_at: Option<DateTime<Utc>>,
}
