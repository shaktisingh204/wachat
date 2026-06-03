//! HTTP handlers for the Messenger / Conversations slice.
//!
//! Each handler corresponds 1:1 with an `export async function` in
//! `src/app/actions/facebook.actions.ts`. Graph traffic flows through
//! `MetaClient::{get_json,post_json}` which already injects the `Bearer`
//! token header — Meta accepts the bearer header in lieu of the legacy
//! `?access_token=` query param the TS code emits, so we don't have to
//! splice the token into the URL.
//!
//! Error envelopes match the legacy contract: where a TS action returned
//! `{ error: string }` we preserve that shape via the response DTO and
//! ApiError mapping in `wachat_meta_client::error`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::document_to_clean_json;
use serde_json::{Value, json};
use urlencoding::encode as urlencode;

use crate::dto::{
    AckResp, ButtonTemplateButton, ChatInitialDataResp, ConversationsResp, MessagesResp,
    OneTimeNotifRequestBody, OneTimeNotifSendBody, PassThreadBody, QuickReplyItem,
    RecurringOptInBody, RecurringSendBody, SearchQuery, SecondaryReceiversResp,
    SendButtonTemplateBody, SendGenericTemplateBody, SendMediaBody, SendQuickRepliesBody,
    SendTextBody, SendWhatsappInteractiveBody, SendWhatsappMediaBody, SendWhatsappTemplateBody,
    SendWhatsappTextBody, ThreadControlBody,
};
use crate::state::WachatFacebookMessagingState;
use crate::store::{FacebookProject, load_project_for};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

fn require_token(p: &FacebookProject) -> Result<&str> {
    p.access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("Access denied or project not configured.".to_owned()))
}

fn require_token_and_page(p: &FacebookProject) -> Result<(&str, &str)> {
    let token = p.access_token.as_deref().ok_or_else(|| {
        ApiError::BadRequest(
            "Project not found or is missing Facebook Page ID or access token.".to_owned(),
        )
    })?;
    let page_id = p.facebook_page_id.as_deref().ok_or_else(|| {
        ApiError::BadRequest(
            "Project not found or is missing Facebook Page ID or access token.".to_owned(),
        )
    })?;
    Ok((token, page_id))
}

/// Pull `data: [...]` out of a Graph paged-list response. Empty if absent.
fn extract_data_array(v: Value) -> Vec<Value> {
    match v {
        Value::Object(mut m) => match m.remove("data") {
            Some(Value::Array(a)) => a,
            _ => Vec::new(),
        },
        _ => Vec::new(),
    }
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

/// `GET /projects/{project_id}/conversations`
/// Mirrors `getFacebookConversations`.
pub async fn get_conversations(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
) -> Result<Json<ConversationsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let conversations = list_conversations(&state, &project).await?;
    Ok(Json(ConversationsResp { conversations }))
}

/// `GET /projects/{project_id}/conversations/search?query=...`
/// Mirrors `searchFacebookConversations` — Meta has no native search so we
/// fetch all conversations and filter on participant name + snippet.
pub async fn search_conversations(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<ConversationsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let conversations = list_conversations(&state, &project).await?;
    let lower = q.query.to_lowercase();

    let filtered: Vec<Value> = conversations
        .into_iter()
        .filter(|c| {
            let snippet_match = c
                .get("snippet")
                .and_then(Value::as_str)
                .map(|s| s.to_lowercase().contains(&lower))
                .unwrap_or(false);
            if snippet_match {
                return true;
            }
            // participants.data[*].name
            c.get("participants")
                .and_then(|p| p.get("data"))
                .and_then(Value::as_array)
                .map(|arr| {
                    arr.iter().any(|p| {
                        p.get("name")
                            .and_then(Value::as_str)
                            .map(|s| s.to_lowercase().contains(&lower))
                            .unwrap_or(false)
                    })
                })
                .unwrap_or(false)
        })
        .collect();

    Ok(Json(ConversationsResp {
        conversations: filtered,
    }))
}

/// `GET /projects/{project_id}/conversations/{conversation_id}/messages`
/// Mirrors `getFacebookConversationMessages`.
pub async fn get_conversation_messages(
    user: AuthUser,
    Path((project_id, conversation_id)): Path<(String, String)>,
    State(state): State<WachatFacebookMessagingState>,
) -> Result<Json<MessagesResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;
    let path = format!(
        "{}/messages?fields={}",
        urlencode(&conversation_id),
        urlencode("id,created_time,from,to,message"),
    );
    let resp: Value = state.meta.get_json(&path, token).await?;
    let mut messages = extract_data_array(resp);
    // TS reverses to chronological order.
    messages.reverse();
    Ok(Json(MessagesResp { messages }))
}

/// `GET /projects/{project_id}/chat-initial-data`
/// Mirrors `getFacebookChatInitialData` — bundle the project doc together
/// with its conversations so the chat page can render in one round-trip.
pub async fn get_chat_initial_data(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
) -> Result<Json<ChatInitialDataResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    // The TS returns `null` project when not found; here load_project_for
    // already 404's, so we simply return the project verbatim alongside
    // the conversation list.
    let project_json = document_to_clean_json(project.raw.clone());

    let conversations = match list_conversations(&state, &project).await {
        Ok(v) => v,
        Err(ApiError::BadRequest(_)) => Vec::new(),
        Err(e) => return Err(e),
    };
    Ok(Json(ChatInitialDataResp {
        project: Some(project_json),
        conversations,
    }))
}

/// `POST /projects/{project_id}/conversations/{conversation_id}/mark-read`
/// Mirrors `markFacebookConversationAsRead`. Idempotent: Meta returns an
/// error when the message has already been marked read; we suppress that
/// to match the TS contract.
pub async fn mark_conversation_as_read(
    user: AuthUser,
    Path((project_id, conversation_id)): Path<(String, String)>,
    State(state): State<WachatFacebookMessagingState>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let path = format!("{}?state=read", urlencode(&conversation_id));
    let body = json!({});
    match state.meta.post_json::<_, Value>(&path, token, &body).await {
        Ok(_) => Ok(Json(AckResp { success: true })),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("This message has already been read") {
                Ok(Json(AckResp { success: true }))
            } else {
                Err(e.into())
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

/// `POST /projects/{project_id}/messages/text`
/// Mirrors `sendFacebookMessage` (the FormData server action — surfaced
/// here as a structured JSON body).
pub async fn send_text_message(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<SendTextBody>,
) -> Result<Json<AckResp>> {
    if body.recipient_id.is_empty() || body.message_text.is_empty() {
        return Err(ApiError::BadRequest(
            "Missing required information to send message.".to_owned(),
        ));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "recipient": { "id": body.recipient_id },
        "messaging_type": "RESPONSE",
        "message": { "text": body.message_text },
    });
    state
        .meta
        .post_json::<_, Value>("me/messages", token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/messages/media`
/// Mirrors `sendFacebookMediaMessage`. The TS shim performs any necessary
/// upload and passes a URL or pre-uploaded media id — this handler only
/// forwards the payload.
pub async fn send_media_message(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<SendMediaBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "recipient": { "id": body.recipient_id },
        "messaging_type": "RESPONSE",
        "message": {
            "attachment": {
                "type": body.media_type,
                "payload": { "url": body.media_url, "is_reusable": true },
            }
        },
    });
    state
        .meta
        .post_json::<_, Value>("me/messages", token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/messages/button-template`
/// Mirrors `sendFacebookButtonTemplate`.
pub async fn send_button_template(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<SendButtonTemplateBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    // Re-shape buttons for Meta (`type` alias stays as `type` on the wire).
    let buttons: Vec<Value> = body
        .buttons
        .into_iter()
        .map(|b: ButtonTemplateButton| {
            let mut m = serde_json::Map::new();
            m.insert("type".into(), Value::String(b.kind));
            m.insert("title".into(), Value::String(b.title));
            if let Some(u) = b.url {
                m.insert("url".into(), Value::String(u));
            }
            if let Some(p) = b.payload {
                m.insert("payload".into(), Value::String(p));
            }
            Value::Object(m)
        })
        .collect();

    let payload = json!({
        "recipient": { "id": body.recipient_id },
        "messaging_type": "RESPONSE",
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": body.text,
                    "buttons": buttons,
                }
            }
        },
    });
    state
        .meta
        .post_json::<_, Value>("me/messages", token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/messages/generic-template`
/// Mirrors `sendFacebookGenericTemplate`.
pub async fn send_generic_template(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<SendGenericTemplateBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "recipient": { "id": body.recipient_id },
        "messaging_type": "RESPONSE",
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": body.elements,
                }
            }
        },
    });
    state
        .meta
        .post_json::<_, Value>("me/messages", token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/messages/quick-replies`
/// Mirrors `sendFacebookQuickReplies`.
pub async fn send_quick_replies(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<SendQuickRepliesBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let quick_replies: Vec<Value> = body
        .quick_replies
        .into_iter()
        .map(|q: QuickReplyItem| {
            let mut m = serde_json::Map::new();
            m.insert("content_type".into(), Value::String(q.content_type));
            if let Some(t) = q.title {
                m.insert("title".into(), Value::String(t));
            }
            if let Some(p) = q.payload {
                m.insert("payload".into(), Value::String(p));
            }
            if let Some(i) = q.image_url {
                m.insert("image_url".into(), Value::String(i));
            }
            Value::Object(m)
        })
        .collect();

    let payload = json!({
        "recipient": { "id": body.recipient_id },
        "messaging_type": "RESPONSE",
        "message": {
            "text": body.text,
            "quick_replies": quick_replies,
        },
    });
    state
        .meta
        .post_json::<_, Value>("me/messages", token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

// ---------------------------------------------------------------------------
// Handover Protocol
// ---------------------------------------------------------------------------

/// `POST /projects/{project_id}/handover/pass`
pub async fn pass_thread_control(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<PassThreadBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let mut m = serde_json::Map::new();
    m.insert("recipient".into(), json!({ "id": body.psid }));
    m.insert("target_app_id".into(), Value::String(body.target_app_id));
    if let Some(meta) = body.metadata {
        m.insert("metadata".into(), Value::String(meta));
    }
    state
        .meta
        .post_json::<_, Value>("me/pass_thread_control", token, &Value::Object(m))
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/handover/take`
pub async fn take_thread_control(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<ThreadControlBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let mut m = serde_json::Map::new();
    m.insert("recipient".into(), json!({ "id": body.psid }));
    if let Some(meta) = body.metadata {
        m.insert("metadata".into(), Value::String(meta));
    }
    state
        .meta
        .post_json::<_, Value>("me/take_thread_control", token, &Value::Object(m))
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/handover/request`
pub async fn request_thread_control(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<ThreadControlBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let mut m = serde_json::Map::new();
    m.insert("recipient".into(), json!({ "id": body.psid }));
    if let Some(meta) = body.metadata {
        m.insert("metadata".into(), Value::String(meta));
    }
    state
        .meta
        .post_json::<_, Value>("me/request_thread_control", token, &Value::Object(m))
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `GET /projects/{project_id}/handover/secondary-receivers`
pub async fn get_secondary_receivers(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
) -> Result<Json<SecondaryReceiversResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let path = format!("me/secondary_receivers?fields={}", urlencode("id,name"));
    let resp: Value = state.meta.get_json(&path, token).await?;
    let receivers = extract_data_array(resp);
    Ok(Json(SecondaryReceiversResp { receivers }))
}

// ---------------------------------------------------------------------------
// One-time / recurring notifications
// ---------------------------------------------------------------------------

/// `POST /projects/{project_id}/notifications/one-time/request`
/// Sends the `one_time_notif_req` template to ask the user to opt in.
pub async fn send_one_time_notif_request(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<OneTimeNotifRequestBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "recipient": { "id": body.psid },
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "one_time_notif_req",
                    "title": body.title,
                    "payload": body.payload,
                }
            }
        },
    });
    state
        .meta
        .post_json::<_, Value>("me/messages", token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/notifications/one-time/send`
/// Sends a text message using the `one_time_notif_token` returned when
/// the user opted in.
pub async fn send_one_time_notification(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<OneTimeNotifSendBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "recipient": { "one_time_notif_token": body.token },
        "message": { "text": body.message_text },
    });
    state
        .meta
        .post_json::<_, Value>("me/messages", token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/notifications/recurring/opt-in`
/// Sends the `notification_messages` opt-in template.
pub async fn send_recurring_notif_opt_in(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<RecurringOptInBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "recipient": { "id": body.psid },
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "notification_messages",
                    "title": body.title,
                    "image_url": body.image_url,
                    "payload": body.payload,
                    "notification_messages_frequency": body.frequency,
                }
            }
        },
    });
    state
        .meta
        .post_json::<_, Value>("me/messages", token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/notifications/recurring/send`
pub async fn send_recurring_notification(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<RecurringSendBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "recipient": { "notification_messages_token": body.token },
        "message": { "text": body.message_text },
    });
    state
        .meta
        .post_json::<_, Value>("me/messages", token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

// ---------------------------------------------------------------------------
// Shared list helper
// ---------------------------------------------------------------------------

/// Inner helper used by `get_conversations`, `search_conversations` and
/// `get_chat_initial_data`. Pulls the page's conversations from
/// `/{pageId}/conversations?platform=messenger`.
async fn list_conversations(
    state: &WachatFacebookMessagingState,
    project: &FacebookProject,
) -> Result<Vec<Value>> {
    let (token, page_id) = require_token_and_page(project)?;
    let path = format!(
        "{}/conversations?fields={}&platform=messenger",
        urlencode(page_id),
        urlencode("id,snippet,unread_count,updated_time,participants,can_reply"),
    );
    let resp: Value = state.meta.get_json(&path, token).await?;
    Ok(extract_data_array(resp))
}

// ---------------------------------------------------------------------------
// WhatsApp Cloud API
// ---------------------------------------------------------------------------

/// `POST /projects/{project_id}/whatsapp/messages/text`
pub async fn send_whatsapp_text(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<SendWhatsappTextBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": body.to,
        "type": "text",
        "text": {
            "body": body.text
        }
    });

    let path = format!("{}/messages", urlencode(&body.phone_number_id));
    state
        .meta
        .post_json::<_, Value>(&path, token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/whatsapp/messages/template`
pub async fn send_whatsapp_template(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<SendWhatsappTemplateBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "messaging_product": "whatsapp",
        "to": body.to,
        "type": "template",
        "template": {
            "name": body.template_name,
            "language": {
                "code": body.language_code
            },
            "components": body.components
        }
    });

    let path = format!("{}/messages", urlencode(&body.phone_number_id));
    state
        .meta
        .post_json::<_, Value>(&path, token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/whatsapp/messages/media`
pub async fn send_whatsapp_media(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<SendWhatsappMediaBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let mut media_obj = serde_json::Map::new();
    if let Some(link) = body.media_url {
        media_obj.insert("link".to_string(), Value::String(link));
    } else if let Some(id) = body.media_id {
        media_obj.insert("id".to_string(), Value::String(id));
    } else {
        return Err(ApiError::BadRequest(
            "Must provide media_url or media_id".to_owned(),
        ));
    }

    if let Some(caption) = body.caption {
        media_obj.insert("caption".to_string(), Value::String(caption));
    }

    let payload = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": body.to,
        "type": body.media_type,
        body.media_type: media_obj
    });

    let path = format!("{}/messages", urlencode(&body.phone_number_id));
    state
        .meta
        .post_json::<_, Value>(&path, token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}

/// `POST /projects/{project_id}/whatsapp/messages/interactive`
pub async fn send_whatsapp_interactive(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFacebookMessagingState>,
    Json(body): Json<SendWhatsappInteractiveBody>,
) -> Result<Json<AckResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = require_token(&project)?;

    let payload = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": body.to,
        "type": "interactive",
        "interactive": body.interactive
    });

    let path = format!("{}/messages", urlencode(&body.phone_number_id));
    state
        .meta
        .post_json::<_, Value>(&path, token, &payload)
        .await?;
    Ok(Json(AckResp { success: true }))
}
