//! Wire-format DTOs for the wachat-facebook-agents endpoints.
//!
//! All collection responses pass through stored Mongo documents verbatim
//! as `serde_json::Value` (with ObjectIds rendered as hex strings and
//! dates as ISO 8601), matching `JSON.parse(JSON.stringify(...))` from
//! `facebook.actions.ts`.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Generic envelopes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct OkResp {
    pub success: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct MessageResp {
    pub message: String,
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct AgentsResp {
    pub agents: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgentBody {
    pub name: String,
    #[serde(default)]
    pub personality: Option<String>,
    #[serde(default)]
    pub welcome_message: Option<String>,
    #[serde(default)]
    pub fallback_message: Option<String>,
    #[serde(default)]
    pub is_active: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateAgentBody {
    /// Free-form $set payload — same as the TS `Record<string, any>`.
    #[serde(flatten)]
    pub updates: serde_json::Map<String, Value>,
}

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct DocsResp {
    pub docs: Vec<Value>,
}

/// Body for `POST /v1/facebook/agents/projects/{id}/knowledge-docs`.
///
/// **Multipart binary stays in TS.** The TS shim uploads the file to its
/// blob store first and forwards the parsed text under `content` (and an
/// optional `blobUrl` reference for downstream consumers).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadKnowledgeDocBody {
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub doc_type: Option<String>,
    #[serde(default)]
    pub blob_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Moderation rules
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct RulesResp {
    pub rules: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveModerationRuleBody {
    /// Comma-separated keywords (matches the TS form contract).
    pub keywords: String,
    pub action: String,
    #[serde(default)]
    pub auto_reply_text: Option<String>,
    #[serde(default)]
    pub is_active: bool,
    /// When present and a valid ObjectId hex, an existing rule is updated
    /// in place; otherwise a new rule is inserted.
    #[serde(default)]
    pub rule_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Comment auto-reply settings (lives on `projects.facebookCommentAutoReply`)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentAutoReplyBody {
    #[serde(default)]
    pub enabled: bool,
    /// `"static"` | `"ai"`
    pub reply_mode: String,
    #[serde(default)]
    pub static_reply_text: Option<String>,
    #[serde(default)]
    pub ai_reply_prompt: Option<String>,
}

// ---------------------------------------------------------------------------
// Audience segments
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct SegmentsResp {
    pub segments: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAudienceSegmentBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub filter_city: Option<String>,
    #[serde(default)]
    pub filter_country: Option<String>,
    /// `"all"` skips the filter.
    #[serde(default)]
    pub filter_gender: Option<String>,
    #[serde(default)]
    pub filter_age_min: Option<i64>,
    #[serde(default)]
    pub filter_age_max: Option<i64>,
}
