//! HTTP handlers for the SabChat AI copilot.
//!
//! Each handler:
//!
//! 1. Parses the caller's tenant id off the [`AuthUser`].
//! 2. Verifies the target conversation exists under that tenant (404
//!    otherwise — no cross-tenant existence leaks).
//! 3. Loads the last 30 messages of the conversation in chronological
//!    order.
//! 4. Builds the appropriate prompt via [`crate::prompts`].
//! 5. Calls [`crate::llm::LlmClient::complete`] and shapes the response.
//!
//! ## Tenancy
//!
//! Every Mongo read includes `tenantId == auth.tenant_id`. The copilot
//! never mutates any document — it is a read-only assistant — so there
//! is no write-side guard to worry about beyond the read guard.
//!
//! ## Why the "last 30 messages" window?
//!
//! The brief specifies 30. In practice that's a comfortable window for
//! both a draft (we want enough context to match tone and topic) and a
//! summary (a long thread will typically resolve in well under 30
//! turns). The window is enforced server-side so the client cannot
//! ask the copilot to stream a multi-thousand-message thread into the
//! prompt.

use axum::{Json, extract::State};
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabchat_types::SabChatMessage;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde_json::json;
use tracing::instrument;

use crate::dto::{
    DraftRequest, DraftResponse, SuggestActionsRequest, SuggestActionsResponse,
    SuggestedAction, SummarizeRequest, SummarizeResponse, WrapUpRequest, WrapUpResponse,
};
use crate::prompts::{
    build_draft_prompt, build_suggest_actions_prompt, build_summary_prompt, build_wrap_up_prompt,
};
use crate::state::SabChatAiCopilotState;

// ===========================================================================
// Collection names
// ===========================================================================

const MESSAGES_COLL: &str = "sabchat_messages";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// Number of trailing messages we feed into the LLM context window.
/// Matches the brief.
const HISTORY_WINDOW: i64 = 30;

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse `auth.tenant_id` into an `ObjectId` or fail with 401.
fn tenant_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Verify the conversation exists under the caller's tenant. Returns
/// 404 if the id is malformed, missing, or lives under a different
/// tenant — we do not leak existence across tenants.
async fn ensure_conversation_visible(
    mongo: &MongoHandle,
    conversation_id_hex: &str,
    tenant: ObjectId,
) -> Result<ObjectId> {
    let oid = oid_from_str(conversation_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let found = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?;
    if found.is_none() {
        return Err(ApiError::NotFound("Conversation not found.".to_owned()));
    }
    Ok(oid)
}

/// Load the last [`HISTORY_WINDOW`] messages of a conversation in
/// **chronological order** (oldest first). Mongo gives us newest-first
/// via the descending `_id` sort; we reverse the slice before returning
/// so the prompt builder sees the natural reading order.
async fn load_recent_history(
    mongo: &MongoHandle,
    conversation_oid: ObjectId,
    tenant: ObjectId,
) -> Result<Vec<SabChatMessage>> {
    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(HISTORY_WINDOW)
        .build();
    let cursor = coll
        .find(doc! {
            "tenantId": tenant,
            "conversationId": conversation_oid,
        })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find(history)"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.collect(history)"))
    })?;

    let mut messages: Vec<SabChatMessage> = docs
        .into_iter()
        .map(|d| {
            bson::from_document::<SabChatMessage>(d).map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("message deserialize (history)"),
                )
            })
        })
        .collect::<Result<Vec<_>>>()?;
    // Mongo returned newest-first; we want oldest-first for the prompt.
    messages.reverse();
    Ok(messages)
}

// ===========================================================================
// POST /draft
// ===========================================================================

/// `POST /v1/sabchat/ai/copilot/draft` — produce a suggested reply.
///
/// Loads the last 30 messages, builds the draft prompt, calls the LLM
/// client, and returns the generated text + accounting metadata.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id))]
pub async fn draft(
    auth: AuthUser,
    State(state): State<SabChatAiCopilotState>,
    Json(body): Json<DraftRequest>,
) -> Result<Json<DraftResponse>> {
    let tenant = tenant_oid(&auth)?;
    let conv_oid =
        ensure_conversation_visible(&state.mongo, &body.conversation_id, tenant).await?;
    let history = load_recent_history(&state.mongo, conv_oid, tenant).await?;

    let (system, user) = build_draft_prompt(&history, body.hint.as_deref());
    let resp = state
        .llm
        .complete(&system, &user)
        .await
        .map_err(|e| ApiError::Internal(e.context("llm.complete(draft)")))?;

    Ok(Json(DraftResponse {
        draft: resp.text,
        model: resp.model,
        tokens_in: resp.tokens_in,
        tokens_out: resp.tokens_out,
    }))
}

// ===========================================================================
// POST /summarize
// ===========================================================================

/// `POST /v1/sabchat/ai/copilot/summarize` — short thread summary.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id))]
pub async fn summarize(
    auth: AuthUser,
    State(state): State<SabChatAiCopilotState>,
    Json(body): Json<SummarizeRequest>,
) -> Result<Json<SummarizeResponse>> {
    let tenant = tenant_oid(&auth)?;
    let conv_oid =
        ensure_conversation_visible(&state.mongo, &body.conversation_id, tenant).await?;
    let history = load_recent_history(&state.mongo, conv_oid, tenant).await?;

    let (system, user) = build_summary_prompt(&history);
    let resp = state
        .llm
        .complete(&system, &user)
        .await
        .map_err(|e| ApiError::Internal(e.context("llm.complete(summarize)")))?;

    Ok(Json(SummarizeResponse {
        summary: resp.text,
        model: resp.model,
        tokens_in: resp.tokens_in,
        tokens_out: resp.tokens_out,
    }))
}

// ===========================================================================
// POST /suggest-actions
// ===========================================================================

/// `POST /v1/sabchat/ai/copilot/suggest-actions` — suggested next steps.
///
/// The LLM call here primes the model with the conversation context,
/// but until a real provider is wired we return a small deterministic
/// action set so the client UI can be exercised. The `kind` taxonomy
/// matches the brief: `label`, `escalate`, `resolve`, `reply`.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id))]
pub async fn suggest_actions(
    auth: AuthUser,
    State(state): State<SabChatAiCopilotState>,
    Json(body): Json<SuggestActionsRequest>,
) -> Result<Json<SuggestActionsResponse>> {
    let tenant = tenant_oid(&auth)?;
    let conv_oid =
        ensure_conversation_visible(&state.mongo, &body.conversation_id, tenant).await?;
    let history = load_recent_history(&state.mongo, conv_oid, tenant).await?;

    // We still call the LLM so accounting / latency tracking exercises
    // the same path it will exercise in prod. Output is discarded for
    // now — a follow-up PR will swap to structured output / tool calls
    // and parse a real action list out of the response.
    let (system, user) = build_suggest_actions_prompt(&history);
    let _ = state
        .llm
        .complete(&system, &user)
        .await
        .map_err(|e| ApiError::Internal(e.context("llm.complete(suggest-actions)")))?;

    // Deterministic placeholder set. Order = priority hint for the UI.
    let actions = vec![
        SuggestedAction {
            kind: "reply".to_owned(),
            title: "Send a suggested reply".to_owned(),
            payload: json!({ "useDraftEndpoint": true }),
        },
        SuggestedAction {
            kind: "label".to_owned(),
            title: "Tag conversation as `follow-up`".to_owned(),
            payload: json!({ "label": "follow-up" }),
        },
        SuggestedAction {
            kind: "escalate".to_owned(),
            title: "Escalate to senior support".to_owned(),
            payload: json!({ "team": "senior-support" }),
        },
        SuggestedAction {
            kind: "resolve".to_owned(),
            title: "Mark as resolved".to_owned(),
            payload: json!({}),
        },
    ];

    Ok(Json(SuggestActionsResponse { actions }))
}

// ===========================================================================
// POST /wrap-up
// ===========================================================================

/// `POST /v1/sabchat/ai/copilot/wrap-up` — internal resolution note.
///
/// The note is returned to the caller; persisting it onto the
/// conversation / audit log is the calling UI's responsibility (so the
/// agent can edit before committing).
#[instrument(skip_all, fields(conversation_id = %body.conversation_id))]
pub async fn wrap_up(
    auth: AuthUser,
    State(state): State<SabChatAiCopilotState>,
    Json(body): Json<WrapUpRequest>,
) -> Result<Json<WrapUpResponse>> {
    let tenant = tenant_oid(&auth)?;
    let conv_oid =
        ensure_conversation_visible(&state.mongo, &body.conversation_id, tenant).await?;
    let history = load_recent_history(&state.mongo, conv_oid, tenant).await?;

    let (system, user) = build_wrap_up_prompt(&history);
    let resp = state
        .llm
        .complete(&system, &user)
        .await
        .map_err(|e| ApiError::Internal(e.context("llm.complete(wrap-up)")))?;

    Ok(Json(WrapUpResponse { note: resp.text }))
}
