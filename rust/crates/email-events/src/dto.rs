//! Provider payload shapes + outbound wire DTOs.
//!
//! These are intentionally permissive — providers add fields over
//! time, and we don't want a strict deser to drop legitimate events.
//! Each provider only deserializes the handful of fields we actually
//! normalize into `EmailEvent`; everything else is captured loosely as
//! `serde_json::Value` for forward-compat.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Sendgrid
// ---------------------------------------------------------------------------

/// One Sendgrid event. Sendgrid POSTs an **array** of these.
///
/// Reference: <https://docs.sendgrid.com/for-developers/tracking-events/event>
#[derive(Debug, Clone, Deserialize)]
pub struct SendgridEvent {
    #[serde(default)]
    pub email: Option<String>,
    /// `processed`, `deferred`, `delivered`, `open`, `click`,
    /// `bounce`, `dropped`, `spamreport`, `unsubscribe`, …
    pub event: String,
    #[serde(default)]
    pub timestamp: Option<i64>,
    #[serde(default)]
    pub sg_message_id: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub useragent: Option<String>,
    #[serde(default)]
    pub ip: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub campaign_id: Option<String>,
    #[serde(default)]
    pub journey_id: Option<String>,
    #[serde(default)]
    pub subscriber_id: Option<String>,
    /// Forward-compat — Sendgrid keeps adding fields.
    #[serde(flatten)]
    pub extra: serde_json::Map<String, Value>,
}

// ---------------------------------------------------------------------------
// Mailgun
// ---------------------------------------------------------------------------

/// Mailgun webhooks are form-encoded with a fixed set of fields.
///
/// Reference: <https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/>
#[derive(Debug, Clone, Deserialize)]
pub struct MailgunEvent {
    /// `delivered`, `opened`, `clicked`, `bounced`, `failed`,
    /// `complained`, `unsubscribed`, `dropped`, …
    pub event: String,
    #[serde(default)]
    pub recipient: Option<String>,
    #[serde(default)]
    pub timestamp: Option<String>,
    #[serde(default)]
    pub message_id: Option<String>,
    #[serde(default, alias = "Message-Id")]
    pub message_id_header: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default, alias = "client-ip")]
    pub ip: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default, alias = "campaign-id")]
    pub campaign_id: Option<String>,
    #[serde(default, alias = "journey-id")]
    pub journey_id: Option<String>,
    #[serde(default, alias = "subscriber-id")]
    pub subscriber_id: Option<String>,
}

// ---------------------------------------------------------------------------
// SES via SNS
// ---------------------------------------------------------------------------

/// SES → SNS envelope. SES wraps the actual notification in an
/// SNS message; the body's `Message` field is itself a JSON string
/// that needs a second decode.
///
/// Reference: <https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html>
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct SnsEnvelope {
    #[serde(rename = "Type", default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub subscribe_url: Option<String>,
    #[serde(default)]
    pub topic_arn: Option<String>,
    #[serde(default)]
    pub timestamp: Option<String>,
}

/// Decoded SES notification (already extracted from `SnsEnvelope.message`).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SesNotification {
    /// `Bounce`, `Complaint`, `Delivery`, `Send`, `Reject`, `Open`,
    /// `Click`, `Rendering Failure`, `DeliveryDelay`, `Subscription`.
    pub notification_type: Option<String>,
    /// SES v2 puts the type in `eventType` instead.
    #[serde(default, alias = "eventType")]
    pub event_type: Option<String>,
    #[serde(default)]
    pub mail: Option<SesMail>,
    #[serde(default)]
    pub bounce: Option<Value>,
    #[serde(default)]
    pub complaint: Option<Value>,
    #[serde(default)]
    pub delivery: Option<Value>,
    #[serde(default)]
    pub open: Option<Value>,
    #[serde(default)]
    pub click: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SesMail {
    #[serde(default)]
    pub message_id: Option<String>,
    #[serde(default)]
    pub destination: Vec<String>,
    #[serde(default)]
    pub timestamp: Option<String>,
}

// ---------------------------------------------------------------------------
// Postmark
// ---------------------------------------------------------------------------

/// Postmark webhooks fire one POST per event but for batch ingestion
/// we accept either a single object or an array — `IntoIter` handles
/// both in the handler.
///
/// Reference: <https://postmarkapp.com/developer/webhooks/webhooks-overview>
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum PostmarkBatch {
    Many(Vec<PostmarkEvent>),
    One(PostmarkEvent),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct PostmarkEvent {
    /// `Delivery`, `Bounce`, `SpamComplaint`, `Open`, `Click`,
    /// `SubscriptionChange`.
    pub record_type: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub recipient: Option<String>,
    #[serde(default)]
    pub message_id: Option<String>,
    #[serde(default, rename = "OriginalLink")]
    pub original_link: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub geo: Option<Value>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "ReceivedAt")]
    pub received_at: Option<String>,
    #[serde(default, rename = "MessageStream")]
    pub stream: Option<String>,
    /// Postmark lets us tag outbound sends with arbitrary metadata.
    /// We use it to carry campaign/journey/subscriber ids round-trip.
    #[serde(default)]
    pub metadata: Option<serde_json::Map<String, Value>>,
}

// ---------------------------------------------------------------------------
// Brevo
// ---------------------------------------------------------------------------

/// Brevo (ex-Sendinblue) — single event per POST.
///
/// Reference: <https://developers.brevo.com/docs/transactional-webhooks>
#[derive(Debug, Clone, Deserialize)]
pub struct BrevoEvent {
    /// `sent`, `delivered`, `opened`, `click`, `soft_bounce`,
    /// `hard_bounce`, `complaint`, `unsubscribed`, `blocked`,
    /// `invalid_email`, `deferred`.
    pub event: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub ts: Option<i64>,
    #[serde(default, alias = "message-id")]
    pub message_id: Option<String>,
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default, alias = "campaign-id")]
    pub campaign_id: Option<String>,
    #[serde(default, alias = "journey-id")]
    pub journey_id: Option<String>,
    #[serde(default, alias = "subscriber-id")]
    pub subscriber_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Outbound wire shapes — list + ingest acks
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestAck {
    pub accepted: u64,
    pub skipped: u64,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListEventsQuery {
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub campaign_id: Option<String>,
    #[serde(default)]
    pub journey_id: Option<String>,
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
}

fn default_page() -> u64 {
    1
}
fn default_limit() -> u64 {
    50
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventRow {
    pub id: String,
    pub kind: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub campaign_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub journey_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscriber_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub provider: String,
    pub occurred_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEventsResponse {
    pub items: Vec<EventRow>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub has_more: bool,
}
