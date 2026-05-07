//! Communication-send logs attached to outbound sales documents
//! (Quotation, Proforma, Invoice). These are append-only audit trails:
//! each send attempt produces one entry capturing the recipient and
//! transport-level outcome.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeliveryOutcome {
    Queued,
    Sent,
    Delivered,
    Failed,
    Bounced,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailLog {
    pub sent_at: DateTime<Utc>,
    pub to: String,
    pub status: DeliveryOutcome,
    /// Provider message id (SES, Resend, …) for cross-referencing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_message_id: Option<String>,
    /// Failure detail. Populated only when `status` is `Failed` /
    /// `Bounced`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsAppSendLog {
    pub sent_at: DateTime<Utc>,
    /// Recipient phone in `wa_id` format (digits only, no `+`) — same
    /// shape `wachat-types::WaContact` uses.
    pub to: String,
    pub status: DeliveryOutcome,
    /// Meta-side wamid for tracing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wamid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Render-pipeline status for a doc's PDF. Stored on the doc so list
/// views can show "ready / regenerating / stale" without re-rendering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PdfStatus {
    /// PDF has never been generated.
    #[default]
    None,
    /// Generation queued.
    Pending,
    Ready,
    /// Doc edited after last render — needs regen on next send.
    Stale,
    Failed,
}
