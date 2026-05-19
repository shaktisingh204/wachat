//! Provider-specific webhook payload shapes + the common ingest result.
//!
//! Each public provider speaks a different dialect — Mailgun sends form
//! fields, SES wraps raw MIME in an SNS envelope, and raw SMTP relays
//! POST the RFC-822 stream directly. The handlers normalise all three
//! into the same internal `ParsedMessage` (defined in `handlers.rs`)
//! before writing to Mongo.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Common query envelopes
// ---------------------------------------------------------------------------

/// `?token=` query — used when the path variant isn't available (some
/// providers strip path segments).
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TokenQuery {
    #[serde(default)]
    pub token: Option<String>,
}

// ---------------------------------------------------------------------------
// Mailgun — form-encoded
// ---------------------------------------------------------------------------

/// Mailgun "Routes" / "Store and Notify" inbound webhook payload.
///
/// Mailgun sends `application/x-www-form-urlencoded`. The fields below
/// match Mailgun's documented schema; everything else on the form is
/// ignored (we keep the parse forgiving so future Mailgun additions
/// don't break ingestion).
///
/// Reference: https://documentation.mailgun.com/en/latest/user_manual.html#routes
#[derive(Debug, Clone, Deserialize, Default)]
pub struct MailgunInboundForm {
    /// Mailgun's per-route token (when configured via the Mailgun UI as
    /// a stored variable). Falls back to the path / query token if
    /// absent.
    #[serde(default)]
    pub token: Option<String>,

    /// Sender (envelope `from`).
    #[serde(default)]
    pub sender: Option<String>,
    /// Display `From:` header.
    #[serde(default, rename = "From")]
    pub from_header: Option<String>,

    /// Comma-separated `To:` recipients.
    #[serde(default)]
    pub recipient: Option<String>,
    #[serde(default, rename = "To")]
    pub to_header: Option<String>,
    #[serde(default, rename = "Cc")]
    pub cc_header: Option<String>,

    /// Subject line.
    #[serde(default, rename = "Subject")]
    pub subject: Option<String>,
    #[serde(default, rename = "subject")]
    pub subject_lc: Option<String>,

    /// Mailgun's pre-extracted plain-text body (Mailgun strips quoted
    /// reply blocks for `stripped-text`).
    #[serde(default, rename = "body-plain")]
    pub body_plain: Option<String>,
    #[serde(default, rename = "stripped-text")]
    pub stripped_text: Option<String>,

    /// HTML body.
    #[serde(default, rename = "body-html")]
    pub body_html: Option<String>,
    #[serde(default, rename = "stripped-html")]
    pub stripped_html: Option<String>,

    /// RFC-822 `Message-ID` of the inbound mail (sans angle brackets).
    #[serde(default, rename = "Message-Id")]
    pub message_id_header: Option<String>,
    #[serde(default, rename = "message-id")]
    pub message_id_lc: Option<String>,

    /// `In-Reply-To` header — used for threading.
    #[serde(default, rename = "In-Reply-To")]
    pub in_reply_to: Option<String>,

    /// Space-separated `References` header.
    #[serde(default, rename = "References")]
    pub references: Option<String>,

    /// Raw MIME, only present if the Mailgun route was configured with
    /// `"forward()"` instead of `"store()"`.
    #[serde(default, rename = "body-mime")]
    pub body_mime: Option<String>,
}

// ---------------------------------------------------------------------------
// SES → SNS envelope
// ---------------------------------------------------------------------------

/// Top-level shape of an SNS notification that wraps an SES inbound
/// receipt. SNS optionally sends `SubscriptionConfirmation` payloads at
/// subscription time — the handler treats those as a successful no-op
/// so AWS' subscription handshake completes without manual intervention.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "Type")]
pub enum SnsEnvelope {
    Notification(SnsNotification),
    SubscriptionConfirmation(SnsSubscriptionConfirmation),
    UnsubscribeConfirmation(SnsSubscriptionConfirmation),
}

#[derive(Debug, Clone, Deserialize)]
pub struct SnsNotification {
    /// Stringified JSON — the embedded SES envelope.
    #[serde(rename = "Message")]
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SnsSubscriptionConfirmation {
    /// Confirmation URL — the operator must `GET` this once to confirm
    /// the subscription; the handler simply logs it.
    #[serde(default, rename = "SubscribeURL")]
    pub subscribe_url: Option<String>,
}

/// Subset of the SES "received" event we care about.
///
/// The full SES payload is huge; the only fields we need are the raw
/// MIME (`content`) when SES is configured with `SNSAction` /
/// `S3Action.deliverAsContent`, plus the `mail.headers` block as a
/// fallback.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct SesMessage {
    /// Base64-encoded raw MIME, present when the SES rule action is
    /// `SnsAction` with `Encoding = BASE64`.
    #[serde(default)]
    pub content: Option<String>,

    /// Mail envelope; fallback when `content` is absent.
    #[serde(default)]
    pub mail: Option<SesMail>,

    /// Receipt block — we read it only to surface SES spam / virus
    /// verdicts in tracing logs (not yet used to suppress messages).
    #[serde(default)]
    pub receipt: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SesMail {
    #[serde(default)]
    pub headers: Vec<SesHeader>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub destination: Vec<String>,
    #[serde(default, rename = "messageId")]
    pub message_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SesHeader {
    pub name: String,
    pub value: String,
}

// ---------------------------------------------------------------------------
// Ingest result
// ---------------------------------------------------------------------------

/// Response shape returned to providers after a successful ingest.
/// Mailgun / SES don't read the body but we keep the response stable so
/// integration tests + the SMTP relay path can assert on it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestResponse {
    pub ok: bool,
    /// `true` if a new thread was created, `false` if the message
    /// attached to an existing thread.
    pub new_thread: bool,
    pub thread_id: String,
    pub message_id: String,
}
