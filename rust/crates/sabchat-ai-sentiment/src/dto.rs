//! Wire-format DTOs for the SabChat AI sentiment endpoints.
//!
//! All payloads use `#[serde(rename_all = "camelCase")]` to match the
//! JSON shape the Next.js shim sends. The [`Classification`] response
//! type itself lives in [`crate::classifier`] and is shared between the
//! HTTP layer and the persisted document so the on-disk shape and the
//! API response can never drift.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// POST /v1/sabchat/ai/sentiment/classify
// ---------------------------------------------------------------------------

/// Body for `POST /classify` — stateless classification of an arbitrary
/// text blob. No tenancy lookup, no persistence.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClassifyBody {
    /// Free-form text to classify. May be empty (in which case every
    /// detector returns its zero value).
    pub text: String,
}

// ---------------------------------------------------------------------------
// POST /v1/sabchat/ai/sentiment/message
// ---------------------------------------------------------------------------

/// Body for `POST /message` — classify a stored message and persist the
/// result onto `sabchat_messages.providerMetadata.classification`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClassifyMessageBody {
    /// Hex `ObjectId` of the target message. Must belong to the caller's
    /// tenant — cross-tenant ids 404.
    pub message_id: String,
}

// ---------------------------------------------------------------------------
// POST /v1/sabchat/ai/sentiment/conversation
// ---------------------------------------------------------------------------

/// Body for `POST /conversation` — classify the most recent visitor
/// messages on a conversation, persist each result, then patch
/// `customAttrs.churnRisk` + `customAttrs.lastSentiment` on the parent
/// conversation document.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClassifyConversationBody {
    /// Hex `ObjectId` of the target conversation. Must belong to the
    /// caller's tenant.
    pub conversation_id: String,
}

/// Response for `POST /conversation`. `scored` is the number of visitor
/// messages we actually classified (0-10); `churn_risk` is the value
/// freshly written to `customAttrs.churnRisk`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClassifyConversationResponse {
    /// Count of visitor messages whose classification we persisted.
    pub scored: u32,
    /// New churn-risk value in `[0.0, 1.0]`.
    pub churn_risk: f32,
}
