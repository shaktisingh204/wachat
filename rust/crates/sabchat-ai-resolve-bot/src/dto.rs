//! Wire-format DTOs for the SabChat auto-resolve RAG bot endpoints.
//!
//! Two POST routes:
//!
//! - `POST /v1/sabchat/ai/resolve-bot/answer` — pure read; returns a
//!   proposed answer + cited sources + escalation flag.
//! - `POST /v1/sabchat/ai/resolve-bot/auto-reply` — same retrieval +
//!   prompt path, but when the bot is confident enough it also appends a
//!   [`SabChatMessage`](sabchat_types::SabChatMessage) (sender = Bot,
//!   direction = Outbound) and writes a `message_sent` audit row.
//!
//! All bodies use `#[serde(rename_all = "camelCase")]` to match the
//! shape the Next.js shim already speaks.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// POST /answer
// ---------------------------------------------------------------------------

/// Body for `POST /answer`.
///
/// `question` is the visitor's free-text query. The caller is
/// responsible for passing the raw visitor message — we do **not** mine
/// `sabchat_messages` for it here; that wiring lives on the
/// `/auto-reply` path.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AnswerBody {
    /// Hex `ObjectId` of the inbox. Determines tenant scope + bot config.
    pub inbox_id: String,
    /// Hex `ObjectId` of the conversation. Used for source attribution
    /// only on `/answer`; on `/auto-reply` it's where the appended bot
    /// message lands.
    pub conversation_id: String,
    /// The visitor's free-text question.
    pub question: String,
}

/// Body for `POST /auto-reply`. No `question` field — the handler reads
/// the most recent inbound visitor message from `sabchat_messages` and
/// uses its text as the query.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AutoReplyBody {
    pub inbox_id: String,
    pub conversation_id: String,
}

/// Where a piece of evidence came from. Mirrored on the wire as
/// `{ kind, id, title }`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AnswerSource {
    /// `"article"` (Help Center KB) or `"prior"` (prior outbound agent
    /// reply on a past resolved conversation).
    pub kind: String,
    /// Hex `ObjectId` of the underlying document.
    pub id: String,
    /// Display title. For prior messages this is the truncated message
    /// text.
    pub title: String,
}

/// Response envelope shared by `/answer` and `/auto-reply` (when no
/// auto-post happened).
///
/// - `answer` — the bot's drafted reply (or a suggested handoff string
///   when `escalate = true`).
/// - `confidence` — `[0.0, 1.0]` self-reported confidence from the bot
///   adapter.
/// - `sources` — cited evidence the bot used to compose the answer.
/// - `escalate` — `true` if `confidence < threshold` (or the bot itself
///   asked for escalation). When `true` on `/auto-reply` no message is
///   posted; the suggested answer is still returned for the agent UI to
///   show in a draft pane.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AnswerResponse {
    pub answer: String,
    pub confidence: f32,
    pub sources: Vec<AnswerSource>,
    pub escalate: bool,
}

/// Extended response for `POST /auto-reply` — same shape as
/// [`AnswerResponse`] plus a `posted` flag (and the new message's hex
/// id when one was written).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AutoReplyResponse {
    pub answer: String,
    pub confidence: f32,
    pub sources: Vec<AnswerSource>,
    pub escalate: bool,
    /// `true` iff the bot drafted a message AND it cleared the
    /// confidence threshold AND we successfully appended it.
    pub posted: bool,
    /// Hex `ObjectId` of the appended message, when `posted = true`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
}
