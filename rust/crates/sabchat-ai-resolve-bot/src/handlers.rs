//! HTTP handlers for the SabChat auto-resolve RAG bot.
//!
//! Each handler maps to one route:
//!
//! | Endpoint                                          | Handler              |
//! |---------------------------------------------------|----------------------|
//! | `POST /v1/sabchat/ai/resolve-bot/answer`          | [`answer`]           |
//! | `POST /v1/sabchat/ai/resolve-bot/auto-reply`      | [`auto_reply`]       |
//!
//! ## Tenancy
//!
//! Every request scopes against `auth.tenant_id` (parsed once via
//! [`tenant_oid`]). Each Mongo read pre-filters by the same `tenantId`
//! to guarantee no cross-tenant leakage at the storage layer.
//!
//! ## Side-effects
//!
//! `answer` is read-only.
//!
//! `auto_reply` may, when the bot clears the per-inbox confidence
//! threshold, append a non-private bot message and patch the parent
//! conversation (`last_message_at`, `last_message_preview`,
//! `first_response_at` on the first outbound). Either way it writes one
//! `message_sent` audit row with `actor_type = "bot"` if and only if a
//! message was actually posted.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use mongodb::options::FindOneOptions;
use sabchat_types::ContentBlock;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{AnswerBody, AnswerResponse, AnswerSource, AutoReplyBody, AutoReplyResponse};
use crate::llm::BotAnswer;
use crate::retriever::{Retrieval, retrieve};
use crate::state::SabChatAiResolveBotState;

// ===========================================================================
// Constants
// ===========================================================================

const INBOXES_COLL: &str = "sabchat_inboxes";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";
const AUDIT_COLL: &str = "sabchat_audit_log";

/// Top-k retrieval count for the prompt.
const RETRIEVAL_K: usize = 5;

/// Confidence threshold used when the per-inbox bot config does not
/// override it. Matches the value the Next.js UI defaults to.
const DEFAULT_CONFIDENCE_THRESHOLD: f32 = 0.7;

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse `auth.tenant_id` into an `ObjectId` or fail with 401.
fn tenant_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Per-inbox bot configuration. Stored under
/// `inbox.channelConfig.settings.bot` as opaque JSON; we lift the four
/// fields we care about out at read time so the rest of the handler can
/// reason in terms of plain Rust values.
#[derive(Debug, Clone)]
struct BotConfig {
    enabled: bool,
    confidence_threshold: f32,
    max_tokens: Option<u32>,
    persona: Option<String>,
    // `refusal_keywords` is read out so future revisions can short-circuit
    // before calling the LLM. Today nothing reads it after parsing.
    #[allow(dead_code)]
    refusal_keywords: Vec<String>,
}

impl Default for BotConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
            max_tokens: None,
            persona: None,
            refusal_keywords: Vec::new(),
        }
    }
}

/// Load `inbox` under tenant scope and parse out the bot config.
///
/// We collapse not-found and cross-tenant misses into a single 404 to
/// avoid leaking the existence of foreign inboxes.
async fn load_inbox_and_config(
    mongo: &MongoHandle,
    inbox_id_hex: &str,
    tenant: ObjectId,
) -> Result<(Document, BotConfig)> {
    let oid = oid_from_str(inbox_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid inbox id.".to_owned()))?;

    let coll = mongo.collection::<Document>(INBOXES_COLL);
    let inbox = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Inbox not found.".to_owned()))?;

    let cfg = parse_bot_config(&inbox);
    Ok((inbox, cfg))
}

/// Pull `channelConfig.settings.bot` out of the inbox document. Missing
/// keys fall back to [`BotConfig::default`] — the handler still runs but
/// the bot is reported as disabled.
fn parse_bot_config(inbox: &Document) -> BotConfig {
    // `channelConfig.settings` is `serde_json::Value` on the wire, so
    // we round-trip the inbox doc to JSON for easy nested-path access.
    // Doing it once per request is cheap; this is not on the hot path.
    let value: serde_json::Value = serde_json::to_value(inbox).unwrap_or(serde_json::Value::Null);

    let bot = value
        .pointer("/channelConfig/settings/bot")
        .cloned()
        .unwrap_or(serde_json::Value::Null);

    let enabled = bot
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let confidence_threshold = bot
        .get("confidence_threshold")
        .or_else(|| bot.get("confidenceThreshold"))
        .and_then(|v| v.as_f64())
        .map(|f| f as f32)
        .unwrap_or(DEFAULT_CONFIDENCE_THRESHOLD);
    let max_tokens = bot
        .get("max_tokens")
        .or_else(|| bot.get("maxTokens"))
        .and_then(|v| v.as_u64())
        .map(|n| n as u32);
    let persona = bot
        .get("persona")
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .filter(|s| !s.is_empty());
    let refusal_keywords = bot
        .get("refusal_keywords")
        .or_else(|| bot.get("refusalKeywords"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();

    BotConfig {
        enabled,
        confidence_threshold,
        max_tokens,
        persona,
        refusal_keywords,
    }
}

/// Load a conversation by id under tenant scope. 404 on miss.
async fn load_conversation_for_tenant(
    mongo: &MongoHandle,
    conversation_id_hex: &str,
    tenant: ObjectId,
) -> Result<Document> {
    let oid = oid_from_str(conversation_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))
}

/// Decide whether the bot's answer should escalate. Returns `true` (=
/// escalate) when the bot is disabled, the confidence falls below the
/// threshold, or the answer text is empty.
fn should_escalate(cfg: &BotConfig, answer: &BotAnswer) -> bool {
    if !cfg.enabled {
        return true;
    }
    if answer.text.trim().is_empty() {
        return true;
    }
    answer.confidence < cfg.confidence_threshold
}

/// Convert the retriever's `Retrieval` rows into wire-shape
/// `AnswerSource` rows.
fn sources_from(used: &[Retrieval]) -> Vec<AnswerSource> {
    used.iter()
        .map(|r| AnswerSource {
            kind: r.kind.clone(),
            id: r.id.clone(),
            title: r.title.clone(),
        })
        .collect()
}

/// Suggested-handoff message shown when we choose not to auto-post. The
/// agent UI usually overrides this with a richer template, but the
/// string is safe to render verbatim.
fn handoff_text() -> String {
    "I'll connect you with a teammate who can help.".to_owned()
}

/// Best-effort `ContentBlock` → `Bson` conversion via `serde_json`. The
/// content enum round-trips cleanly so this is total in practice;
/// `Bson::Null` is only there to keep the signature total.
fn content_to_bson(content: &ContentBlock) -> Bson {
    let value = serde_json::to_value(content).unwrap_or(serde_json::Value::Null);
    Bson::try_from(value).unwrap_or(Bson::Null)
}

/// Append one row to `sabchat_audit_log`. Errors are logged but never
/// propagated — audit failures must never fail the user-facing write
/// they were meant to record.
async fn write_audit(
    mongo: &MongoHandle,
    tenant: ObjectId,
    conversation_oid: ObjectId,
    contact_oid: ObjectId,
    inbox_oid: ObjectId,
    action: &str,
    actor_type: &str,
) {
    let now = bson::DateTime::from_chrono(Utc::now());
    let doc = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "contactId": contact_oid,
        "inboxId": inbox_oid,
        "action": action,
        "actorType": actor_type,
        "createdAt": now,
    };
    let coll = mongo.collection::<Document>(AUDIT_COLL);
    if let Err(err) = coll.insert_one(doc).await {
        tracing::warn!(
            audit.action = action,
            error.detail = %err,
            "failed to write sabchat resolve-bot audit event",
        );
    }
}

/// Short text preview for the inbox-row sort/preview field. Keeps
/// behaviour consistent with `sabchat-messages` without taking a
/// dependency on its private `preview` module.
fn preview_for_text(text: &str) -> String {
    const PREVIEW_MAX_CHARS: usize = 120;
    if text.chars().count() <= PREVIEW_MAX_CHARS {
        return text.to_owned();
    }
    text.chars().take(PREVIEW_MAX_CHARS).collect()
}

/// Pull the most recent **inbound** visitor message off a conversation,
/// returning its plain text if available.
///
/// Non-text content (image, file, voice, …) is skipped because the
/// retriever is lexical and can do nothing useful with binary payloads.
async fn last_visitor_text(
    mongo: &MongoHandle,
    tenant: ObjectId,
    conversation_oid: ObjectId,
) -> Result<Option<String>> {
    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    let opts = FindOneOptions::builder().sort(doc! { "_id": -1 }).build();
    let doc = coll
        .find_one(doc! {
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "direction": "inbound",
            "senderType": "visitor",
            "private": { "$ne": true },
        })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_messages.find_one(last_visitor)"),
            )
        })?;

    let Some(d) = doc else { return Ok(None) };

    // We only care about text content for retrieval. Other kinds (image
    // / file / voice / …) get skipped — the bot cannot do anything
    // useful with them under a lexical retriever.
    let content = d.get_document("content").ok();
    let kind = content.and_then(|c| c.get_str("kind").ok());
    let text = match kind {
        Some("text") => content
            .and_then(|c| c.get_str("text").ok())
            .map(str::to_owned),
        _ => None,
    };
    Ok(text)
}

// ===========================================================================
// POST /answer — read-only
// ===========================================================================

/// `POST /v1/sabchat/ai/resolve-bot/answer` — propose a reply.
///
/// Pure read path: validate input → load inbox + bot config under
/// tenant → load conversation under tenant → retrieve top-5 KB
/// snippets → call the [`Bot`](crate::llm::Bot) adapter → decide
/// escalate vs answer.
///
/// When `escalate = true` the returned `answer` is the suggested
/// handoff string (see [`handoff_text`]) rather than the bot's draft,
/// to match the contract documented on `AnswerResponse`.
#[instrument(skip_all, fields(inbox_id = %body.inbox_id, conversation_id = %body.conversation_id))]
pub async fn answer(
    auth: AuthUser,
    State(state): State<SabChatAiResolveBotState>,
    Json(body): Json<AnswerBody>,
) -> Result<Json<AnswerResponse>> {
    if body.question.trim().is_empty() {
        return Err(ApiError::Validation("Question is required.".to_owned()));
    }

    let tenant = tenant_oid(&auth)?;

    // Inbox load (also tenant-checks) + bot config.
    let (_inbox, cfg) = load_inbox_and_config(&state.mongo, &body.inbox_id, tenant).await?;

    // Conversation tenant-check — we don't strictly need the doc here,
    // but verifying it exists prevents callers from probing arbitrary
    // ids on someone else's inbox.
    let _conversation =
        load_conversation_for_tenant(&state.mongo, &body.conversation_id, tenant).await?;

    // Retrieval is best-effort; failures degrade to "no sources" instead
    // of 500'ing the request. The bot adapter still returns a useful
    // fallback in that case.
    let retrievals = match retrieve(&state.mongo, tenant, &body.question, RETRIEVAL_K).await {
        Ok(r) => r,
        Err(err) => {
            tracing::warn!(error.detail = %err, "resolve-bot retrieval failed");
            Vec::new()
        }
    };

    let bot_answer = state
        .bot
        .answer(
            &body.question,
            &retrievals,
            cfg.persona.as_deref(),
            cfg.max_tokens,
        )
        .await
        .map_err(|e| ApiError::Internal(e.context("resolve-bot.answer")))?;

    let escalate = should_escalate(&cfg, &bot_answer);
    let sources = sources_from(&bot_answer.used);

    let answer_text = if escalate {
        handoff_text()
    } else {
        bot_answer.text.clone()
    };

    Ok(Json(AnswerResponse {
        answer: answer_text,
        confidence: bot_answer.confidence,
        sources,
        escalate,
    }))
}

// ===========================================================================
// POST /auto-reply — may write a message + audit row
// ===========================================================================

/// `POST /v1/sabchat/ai/resolve-bot/auto-reply` — call `/answer`
/// internally and, when the bot is confident enough, post its reply on
/// the conversation.
///
/// On the post path we also patch the parent conversation
/// (`last_message_at`, `last_message_preview`, `first_response_at` on
/// the first outbound) and write one `message_sent` audit row with
/// `actor_type = "bot"`. On the escalate path nothing is posted — the
/// suggested answer is still returned so the agent UI can show it in a
/// draft pane.
#[instrument(skip_all, fields(inbox_id = %body.inbox_id, conversation_id = %body.conversation_id))]
pub async fn auto_reply(
    auth: AuthUser,
    State(state): State<SabChatAiResolveBotState>,
    Json(body): Json<AutoReplyBody>,
) -> Result<Json<AutoReplyResponse>> {
    let tenant = tenant_oid(&auth)?;

    // Tenant-checked loads of the inbox + conversation.
    let (_inbox, cfg) = load_inbox_and_config(&state.mongo, &body.inbox_id, tenant).await?;
    let conversation =
        load_conversation_for_tenant(&state.mongo, &body.conversation_id, tenant).await?;

    let conversation_oid = conversation
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let inbox_oid = conversation
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing inboxId")))?;
    let contact_oid = conversation
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing contactId")))?;

    // ---- Find the last visitor message text -----------------------------
    //
    // The auto-reply contract takes no `question` field — we mine the
    // conversation for it. If there's nothing to answer (no inbound
    // visitor text yet) we escalate immediately rather than calling the
    // LLM on an empty prompt.
    let question = match last_visitor_text(&state.mongo, tenant, conversation_oid).await? {
        Some(q) if !q.trim().is_empty() => q,
        _ => {
            return Ok(Json(AutoReplyResponse {
                answer: handoff_text(),
                confidence: 0.0,
                sources: Vec::new(),
                escalate: true,
                posted: false,
                message_id: None,
            }));
        }
    };

    // ---- Retrieval + LLM call ------------------------------------------
    let retrievals = match retrieve(&state.mongo, tenant, &question, RETRIEVAL_K).await {
        Ok(r) => r,
        Err(err) => {
            tracing::warn!(error.detail = %err, "resolve-bot retrieval failed");
            Vec::new()
        }
    };

    let bot_answer = state
        .bot
        .answer(
            &question,
            &retrievals,
            cfg.persona.as_deref(),
            cfg.max_tokens,
        )
        .await
        .map_err(|e| ApiError::Internal(e.context("resolve-bot.auto_reply.answer")))?;

    let escalate = should_escalate(&cfg, &bot_answer);
    let sources = sources_from(&bot_answer.used);

    if escalate {
        // Do NOT post — surface the bot's draft alongside the handoff
        // text so the agent UI can decide what to do.
        return Ok(Json(AutoReplyResponse {
            answer: handoff_text(),
            confidence: bot_answer.confidence,
            sources,
            escalate: true,
            posted: false,
            message_id: None,
        }));
    }

    // ---- Append the bot message ----------------------------------------
    //
    // Sender = Bot, direction = Outbound, content = Text. We mirror the
    // shape `sabchat-messages::append` writes so downstream readers can
    // treat bot-authored rows identically to agent-authored ones.
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let new_oid = ObjectId::new();
    let content = ContentBlock::Text {
        text: bot_answer.text.clone(),
    };
    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "senderType": "bot",
        "direction": "outbound",
        "content": content_to_bson(&content),
        "attachments": Bson::Array(vec![]),
        "providerMetadata": Bson::Null,
        "private": false,
        "createdAt": now_bson,
    };

    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    messages.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one(bot)"))
    })?;

    // ---- Patch the parent conversation ---------------------------------
    //
    // Bumps `lastMessageAt` + `lastMessagePreview` + `updatedAt`, and
    // sets `firstResponseAt` if this is the first outbound reply.
    let preview = preview_for_text(&bot_answer.text);
    let mut set_doc = doc! {
        "lastMessageAt": now_bson,
        "lastMessagePreview": preview,
        "updatedAt": now_bson,
    };
    let already_first_response = conversation
        .get("firstResponseAt")
        .and_then(|b| match b {
            Bson::Null => None,
            other => Some(other),
        })
        .is_some();
    if !already_first_response {
        set_doc.insert("firstResponseAt", now_bson);
    }

    let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    conversations
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(bot auto-reply)"),
            )
        })?;

    // ---- Audit ---------------------------------------------------------
    write_audit(
        &state.mongo,
        tenant,
        conversation_oid,
        contact_oid,
        inbox_oid,
        "message_sent",
        "bot",
    )
    .await;

    Ok(Json(AutoReplyResponse {
        answer: bot_answer.text,
        confidence: bot_answer.confidence,
        sources,
        escalate: false,
        posted: true,
        message_id: Some(new_oid.to_hex()),
    }))
}
