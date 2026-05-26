//! Wire-format DTOs for the SabChat ↔ CRM bridge endpoints.
//!
//! All bodies use `#[serde(rename_all = "camelCase")]` to match the JSON
//! the Next.js shim sends. Response shapes are deliberately small —
//! every mutating endpoint returns the resolved foreign-key id so the
//! caller can chain follow-up writes without a second roundtrip.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /link-contact/{sabChatContactId}` — link or auto-create CRM row
// ---------------------------------------------------------------------------

/// Body for `POST /link-contact/{sabChatContactId}`.
///
/// * If `crmContactId` is provided the bridge skips matching and links
///   directly (subject to tenancy).
/// * If `crmContactId` is `None` the bridge searches `crm_contacts` for
///   the caller's tenant by any email/phone overlap and links to the
///   first match. Failing that, a new `crm_contacts` row is **created**
///   from the sabchat contact and linked.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LinkContactBody {
    /// Optional pre-resolved CRM contact id (hex `ObjectId`).
    #[serde(default)]
    pub crm_contact_id: Option<String>,
}

/// Response envelope for the three contact-sync endpoints.
///
/// `crmContactId` is always the **resolved** id — either the one passed
/// in, the one we matched, or the one we just created.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LinkContactResponse {
    pub sabchat_contact_id: String,
    pub crm_contact_id: String,
    /// `true` when the link target was created during this call rather
    /// than matched or pre-supplied. Useful for the UI to show a "Just
    /// added to CRM" toast.
    pub created: bool,
}

// ---------------------------------------------------------------------------
// `POST /conversation-to-deal/{conversationId}` — create deal
// ---------------------------------------------------------------------------

/// Body for `POST /conversation-to-deal/{conversationId}`.
///
/// The bridge resolves the conversation's contact, auto-links it to a
/// `crm_contacts` row if needed, then inserts a `crm_deals` row carrying
/// the supplied pipeline/stage/amount and writes the new deal id back
/// onto `conversation.customAttrs.dealIds[]`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConversationToDealBody {
    /// Required — hex `ObjectId` of the target pipeline.
    pub pipeline_id: String,
    /// Optional — hex `ObjectId` of the target stage. When omitted the
    /// CRM resolves the pipeline's default stage downstream.
    #[serde(default)]
    pub stage_id: Option<String>,
    /// Deal title. Falls back to "New deal from chat".
    #[serde(default)]
    pub title: Option<String>,
    /// Deal amount in the pipeline's default currency.
    #[serde(default)]
    pub amount: Option<f64>,
}

/// Response envelope for `POST /conversation-to-deal/{conversationId}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConversationToDealResponse {
    pub conversation_id: String,
    pub crm_contact_id: String,
    pub deal_id: String,
}

// ---------------------------------------------------------------------------
// `POST /conversation-to-ticket/{conversationId}` — create ticket
// ---------------------------------------------------------------------------

/// Body for `POST /conversation-to-ticket/{conversationId}`. Both
/// fields default — the bridge derives a subject from the conversation
/// preview when none is supplied, and falls back to `"medium"` priority.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConversationToTicketBody {
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
}

/// Response envelope for `POST /conversation-to-ticket/{conversationId}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConversationToTicketResponse {
    pub conversation_id: String,
    pub crm_contact_id: String,
    pub ticket_id: String,
}

// ---------------------------------------------------------------------------
// `POST /conversation-to-booking/{conversationId}` — create booking
// ---------------------------------------------------------------------------

/// Body for `POST /conversation-to-booking/{conversationId}`. The
/// caller MUST supply a `serviceId` + `startAt`; everything else
/// (duration, attendee details) is filled in by the CRM bookings module
/// downstream.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConversationToBookingBody {
    /// Required — hex `ObjectId` of the service being booked.
    pub service_id: String,
    /// Required — start wall-clock for the booking.
    pub start_at: DateTime<Utc>,
}

/// Response envelope for `POST /conversation-to-booking/{conversationId}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConversationToBookingResponse {
    pub conversation_id: String,
    pub crm_contact_id: String,
    pub booking_id: String,
}
