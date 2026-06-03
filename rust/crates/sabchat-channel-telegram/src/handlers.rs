//! HTTP handlers for the SabChat Telegram channel adapter.
//!
//! Each handler is a thin orchestration layer over four Mongo
//! collections:
//!
//! | Endpoint              | Collections touched                                    |
//! |-----------------------|--------------------------------------------------------|
//! | `POST /ingest`        | `sabchat_inboxes`, `sabchat_contacts`, `sabchat_conversations`, `sabchat_messages` |
//! | `POST /callback`      | `sabchat_inboxes`, `sabchat_contacts`, `sabchat_conversations`, `sabchat_messages` |
//!
//! ## Idempotency contract
//!
//! Both endpoints write `provider_metadata.update_id` on every message
//! they create. Before inserting, we look up an existing message on
//! `(inbox_id, provider_metadata.update_id)` — if it exists we return
//! the cached ids with `deduped = true` rather than appending a
//! duplicate. This is the standard SabChat adapter behaviour and
//! matches what `sabchat-channel-whatsapp` does for `wamid.*`.
//!
//! ## Identity resolution
//!
//! Telegram has a stable per-user `from_id` so contact resolution is
//! straightforward: look up `sabchat_contacts` with `tenant_id +
//! social_ids.{provider="telegram", external_id=from_id}`. On miss we
//! `$setOnInsert` a fresh contact carrying the display name and
//! `@username` handle.
//!
//! ## Conversation resolution
//!
//! For `(inbox, contact)` we look for the most-recent `Open` or
//! `Pending` conversation — Chatwoot-style. If the latest conversation
//! is `Resolved` / `Snoozed` / non-existent, we create a new one.
//! Callback presses follow the same rule but return 404 if no
//! conversation exists (the visitor pressed a stale button without
//! ever talking to us — that's almost certainly a bug upstream and we
//! want to see it).

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use mongodb::options::FindOneOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{CallbackReq, CallbackResp, IngestReq, IngestResp};
use crate::state::SabChatChannelTelegramState;

/// Mongo collection names — kept inline so reviews against the
/// `sabchat-types` collection-table stay trivial.
const INBOXES_COLL: &str = "sabchat_inboxes";
const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";

/// Stable provider discriminant baked into `social_ids.provider` and
/// the message `provider_metadata.channel` field. Lower-case to match
/// `ChannelType::Telegram`'s snake_case serde value.
const PROVIDER: &str = "telegram";

// ===========================================================================
// POST /ingest
// ===========================================================================

/// `POST /ingest` — land one inbound Telegram message on the
/// conversation graph.
///
/// Steps (each one mirrors a sibling channel adapter):
///
/// 1. Validate the bare-minimum required fields.
/// 2. Resolve the Telegram inbox by `(channelType=telegram,
///    channelConfig.settings.botUsername=botUsername)`.
/// 3. Check for an existing `sabchat_messages` row with the same
///    `(inboxId, provider_metadata.update_id)` — return early if found.
/// 4. Find-or-create the per-tenant contact keyed on the Telegram
///    `from_id` social identity.
/// 5. Find-or-create the latest open conversation on `(inbox, contact)`.
/// 6. Translate `text` / `photo_url` / `voice_url` into a
///    [`ContentBlock`](sabchat_types::ContentBlock) and insert the
///    message.
/// 7. Update the conversation's `last_message_*` fields and bump
///    `unread_count`.
#[instrument(skip_all, fields(bot_username = %body.bot_username, update_id = %body.provider_update_id))]
pub async fn ingest(
    State(state): State<SabChatChannelTelegramState>,
    Json(body): Json<IngestReq>,
) -> Result<Json<IngestResp>> {
    // ---- Input validation ---------------------------------------------
    if body.bot_username.trim().is_empty() {
        return Err(ApiError::Validation("botUsername is required.".to_owned()));
    }
    if body.chat_id.trim().is_empty() {
        return Err(ApiError::Validation("chatId is required.".to_owned()));
    }
    if body.from_id.trim().is_empty() {
        return Err(ApiError::Validation("fromId is required.".to_owned()));
    }
    if body.provider_update_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerUpdateId is required.".to_owned(),
        ));
    }

    // ---- Resolve target inbox -----------------------------------------
    let inbox = resolve_inbox(&state.mongo, &body.bot_username).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

    // ---- Idempotency check --------------------------------------------
    if let Some(existing) =
        find_message_by_update_id(&state.mongo, &inbox_id, &body.provider_update_id).await?
    {
        let conversation_id = existing
            .get_object_id("conversationId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?
            .to_hex();
        let message_id = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?
            .to_hex();
        return Ok(Json(IngestResp {
            conversation_id,
            message_id,
            deduped: true,
        }));
    }

    // ---- Resolve / create contact -------------------------------------
    let contact_id = upsert_contact(
        &state.mongo,
        &tenant_id,
        &body.from_id,
        body.from_username.as_deref(),
        body.from_name.as_deref(),
    )
    .await?;

    // ---- Resolve / create conversation --------------------------------
    let conversation_id =
        find_or_create_conversation(&state.mongo, &tenant_id, &inbox_id, &contact_id).await?;

    // ---- Build the ContentBlock ---------------------------------------
    //
    // Map per the channel contract:
    //   photo  → Image    (with text as alt-caption when present)
    //   voice  → Voice    (with text as transcript when present)
    //   plain  → Text     (default fallback; empty text becomes a single
    //                      space so downstream renderers don't choke)
    let (content, preview) = build_content_block(&body);

    // ---- Resolve timestamps -------------------------------------------
    let event_ts = parse_timestamp(body.timestamp.as_deref());
    let event_bson_ts = bson::DateTime::from_chrono(event_ts);

    // ---- Insert the message -------------------------------------------
    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    let message_oid = ObjectId::new();
    let provider_metadata = doc! {
        "channel": PROVIDER,
        "updateId": &body.provider_update_id,
        "botUsername": &body.bot_username,
        "chatId": &body.chat_id,
        "fromId": &body.from_id,
    };
    let attachments = attachments_from_content(&body);
    let message_doc = doc! {
        "_id": message_oid,
        "tenantId": tenant_id,
        "conversationId": conversation_id,
        "inboxId": inbox_id,
        "contactId": contact_id,
        "senderType": "visitor",
        "senderId": Bson::Null,
        "direction": "inbound",
        "content": content,
        "attachments": attachments,
        "providerMetadata": provider_metadata,
        "private": false,
        "createdAt": event_bson_ts,
    };
    messages.insert_one(message_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one"))
    })?;

    // ---- Bump the conversation summary --------------------------------
    let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let now_bson = bson::DateTime::from_chrono(Utc::now());
    conversations
        .update_one(
            doc! { "_id": conversation_id },
            doc! {
                "$set": {
                    "lastMessageAt": event_bson_ts,
                    "lastMessagePreview": preview,
                    "updatedAt": now_bson,
                },
                "$inc": { "unreadCount": 1_i32 },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.update_one"))
        })?;

    Ok(Json(IngestResp {
        conversation_id: conversation_id.to_hex(),
        message_id: message_oid.to_hex(),
        deduped: false,
    }))
}

// ===========================================================================
// POST /callback
// ===========================================================================

/// `POST /callback` — record a Telegram callback-query button press as
/// a `System`-typed message on the most-recent open conversation for
/// the `(inbox, contact)` pair.
///
/// Surfaces 404 if no contact / conversation can be resolved — that's
/// almost certainly a stale inline button and we'd rather see it than
/// silently spawn a fresh thread.
#[instrument(skip_all, fields(bot_username = %body.bot_username, update_id = %body.provider_update_id))]
pub async fn callback(
    State(state): State<SabChatChannelTelegramState>,
    Json(body): Json<CallbackReq>,
) -> Result<Json<CallbackResp>> {
    // ---- Input validation ---------------------------------------------
    if body.bot_username.trim().is_empty() {
        return Err(ApiError::Validation("botUsername is required.".to_owned()));
    }
    if body.from_id.trim().is_empty() {
        return Err(ApiError::Validation("fromId is required.".to_owned()));
    }
    if body.provider_update_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerUpdateId is required.".to_owned(),
        ));
    }

    // ---- Resolve target inbox -----------------------------------------
    let inbox = resolve_inbox(&state.mongo, &body.bot_username).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

    // ---- Idempotency check --------------------------------------------
    if let Some(existing) =
        find_message_by_update_id(&state.mongo, &inbox_id, &body.provider_update_id).await?
    {
        let conversation_id = existing
            .get_object_id("conversationId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?
            .to_hex();
        let message_id = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?
            .to_hex();
        return Ok(Json(CallbackResp {
            conversation_id,
            message_id,
            deduped: true,
        }));
    }

    // ---- Look up the contact (do NOT auto-create) ---------------------
    //
    // A callback without a prior message means we're looking at a stale
    // inline keyboard for a contact that never existed in SabChat. 404
    // so the shim can log it.
    let contacts = state.mongo.collection::<Document>(CONTACTS_COLL);
    let contact = contacts
        .find_one(doc! {
            "tenantId": tenant_id,
            "socialIds": {
                "$elemMatch": {
                    "provider": PROVIDER,
                    "externalId": &body.from_id,
                },
            },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
        })?
        .ok_or_else(|| {
            ApiError::NotFound("No SabChat contact matches this Telegram user.".to_owned())
        })?;
    let contact_id = doc_object_id(&contact, "_id")?;

    // ---- Look up the most-recent open conversation --------------------
    let conversation_id = latest_open_conversation(&state.mongo, &inbox_id, &contact_id)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound("No open SabChat conversation for this Telegram contact.".to_owned())
        })?;

    // ---- Insert the System message ------------------------------------
    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    let message_oid = ObjectId::new();
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let text = format!("Pressed: {}", body.data);
    let provider_metadata = doc! {
        "channel": PROVIDER,
        "updateId": &body.provider_update_id,
        "botUsername": &body.bot_username,
        "fromId": &body.from_id,
        "kind": "callback_query",
        "data": &body.data,
    };

    let message_doc = doc! {
        "_id": message_oid,
        "tenantId": tenant_id,
        "conversationId": conversation_id,
        "inboxId": inbox_id,
        "contactId": contact_id,
        "senderType": "system",
        "senderId": Bson::Null,
        "direction": "inbound",
        "content": doc! { "kind": "system", "text": &text },
        "attachments": Bson::Array(Vec::new()),
        "providerMetadata": provider_metadata,
        "private": false,
        "createdAt": now_bson,
    };
    messages.insert_one(message_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one(callback)"))
    })?;

    // System notes still bump the conversation summary so the inbox
    // re-sorts. They do NOT increment `unread_count` because they're
    // synthetic events, not visitor speech.
    let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    conversations
        .update_one(
            doc! { "_id": conversation_id },
            doc! {
                "$set": {
                    "lastMessageAt": now_bson,
                    "lastMessagePreview": &text,
                    "updatedAt": now_bson,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(callback)"),
            )
        })?;

    Ok(Json(CallbackResp {
        conversation_id: conversation_id.to_hex(),
        message_id: message_oid.to_hex(),
        deduped: false,
    }))
}

// ===========================================================================
// Lookup helpers
// ===========================================================================

/// Resolve a Telegram inbox by `(channelType, botUsername)`. The
/// `bot_username` field is matched verbatim against
/// `channelConfig.settings.botUsername` — the webhook shim is expected
/// to forward the bare username (no leading `@`).
///
/// Returns 404 if no enabled telegram inbox matches.
async fn resolve_inbox(mongo: &MongoHandle, bot_username: &str) -> Result<Document> {
    let coll = mongo.collection::<Document>(INBOXES_COLL);
    coll.find_one(doc! {
        "channelType": PROVIDER,
        "channelConfig.settings.botUsername": bot_username,
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
    .ok_or_else(|| {
        ApiError::NotFound(format!(
            "No telegram inbox configured for bot @{bot_username}."
        ))
    })
}

/// Look up an existing message with `(inboxId, providerMetadata.updateId)`
/// — used by both endpoints for idempotency.
async fn find_message_by_update_id(
    mongo: &MongoHandle,
    inbox_id: &ObjectId,
    update_id: &str,
) -> Result<Option<Document>> {
    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    coll.find_one(doc! {
        "inboxId": inbox_id,
        "providerMetadata.updateId": update_id,
    })
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one(update_id)"))
    })
}

/// Find-or-create a SabChat contact for this Telegram user.
///
/// We dedupe on `(tenantId, socialIds.{provider="telegram",
/// externalId=from_id})`. On miss we insert a brand-new contact with
/// the social identity, optional handle, and optional display name.
/// On hit we **upgrade** the handle / name fields if we now know them
/// and the contact didn't carry them yet — Telegram users frequently
/// set a username only after a few interactions, and we want the inbox
/// row to reflect it.
async fn upsert_contact(
    mongo: &MongoHandle,
    tenant_id: &ObjectId,
    from_id: &str,
    from_username: Option<&str>,
    from_name: Option<&str>,
) -> Result<ObjectId> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);

    // Step 1 — try to find the existing contact.
    let existing = coll
        .find_one(doc! {
            "tenantId": tenant_id,
            "socialIds": {
                "$elemMatch": {
                    "provider": PROVIDER,
                    "externalId": from_id,
                },
            },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
        })?;

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);

    if let Some(doc_existing) = existing {
        let contact_oid = doc_object_id(&doc_existing, "_id")?;

        // Build a single `$set` that carries all backfills we discover:
        //   - bump `updatedAt` + `lastSeenAt` unconditionally,
        //   - backfill `name` only if the stored row is missing one,
        //   - backfill the social-identity `handle` via positional
        //     `$[el]` + array-filters if we now know it.
        let mut update_set = doc! { "updatedAt": now_bson, "lastSeenAt": now_bson };

        if let Some(name) = from_name.filter(|s| !s.is_empty()) {
            let needs_name = doc_existing
                .get_str("name")
                .map(|s| s.is_empty())
                .unwrap_or(true);
            if needs_name {
                update_set.insert("name", name);
            }
        }

        let mut array_filters: Option<Vec<Document>> = None;
        if let Some(handle) = from_username.filter(|s| !s.is_empty()) {
            update_set.insert("socialIds.$[el].handle", handle);
            array_filters = Some(vec![doc! {
                "el.provider": PROVIDER,
                "el.externalId": from_id,
            }]);
        }

        let update_doc = doc! { "$set": update_set };
        let mut update_call = coll.update_one(doc! { "_id": contact_oid }, update_doc);
        if let Some(filters) = array_filters {
            update_call = update_call.array_filters(filters);
        }
        update_call.await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.update_one"))
        })?;

        return Ok(contact_oid);
    }

    // Step 2 — fresh insert.
    let contact_oid = ObjectId::new();
    let mut social = doc! {
        "provider": PROVIDER,
        "externalId": from_id,
    };
    if let Some(handle) = from_username.filter(|s| !s.is_empty()) {
        social.insert("handle", handle);
    }

    let mut new_doc = doc! {
        "_id": contact_oid,
        "tenantId": tenant_id,
        "emails": Bson::Array(Vec::new()),
        "phones": Bson::Array(Vec::new()),
        "socialIds": Bson::Array(vec![Bson::Document(social)]),
        "attrs": doc! {},
        "tags": Bson::Array(Vec::new()),
        "lastSeenAt": now_bson,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };
    if let Some(name) = from_name.filter(|s| !s.is_empty()) {
        new_doc.insert("name", name);
    }

    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.insert_one"))
    })?;

    Ok(contact_oid)
}

/// Find the latest `Open` or `Pending` conversation for the
/// `(inbox, contact)` pair. Returns `None` if no such row exists —
/// the caller then either creates one (`/ingest`) or 404s (`/callback`).
async fn latest_open_conversation(
    mongo: &MongoHandle,
    inbox_id: &ObjectId,
    contact_id: &ObjectId,
) -> Result<Option<ObjectId>> {
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let opts = FindOneOptions::builder()
        .sort(doc! { "lastMessageAt": -1, "updatedAt": -1 })
        .build();
    let row = coll
        .find_one(doc! {
            "inboxId": inbox_id,
            "contactId": contact_id,
            "status": { "$in": ["open", "pending"] },
        })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?;
    match row {
        Some(d) => Ok(Some(doc_object_id(&d, "_id")?)),
        None => Ok(None),
    }
}

/// Find-or-create the active conversation for an `(inbox, contact)`
/// pair. Mirrors what every SabChat channel adapter does:
///
/// * If the latest conversation is `Open` or `Pending` we reuse it.
/// * Otherwise we insert a fresh conversation row with sensible
///   Chatwoot-parity defaults.
async fn find_or_create_conversation(
    mongo: &MongoHandle,
    tenant_id: &ObjectId,
    inbox_id: &ObjectId,
    contact_id: &ObjectId,
) -> Result<ObjectId> {
    if let Some(existing) = latest_open_conversation(mongo, inbox_id, contact_id).await? {
        return Ok(existing);
    }

    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let oid = ObjectId::new();
    let new_doc = doc! {
        "_id": oid,
        "tenantId": tenant_id,
        "inboxId": inbox_id,
        "contactId": contact_id,
        "status": "open",
        "priority": "medium",
        "assigneeId": Bson::Null,
        "teamId": Bson::Null,
        "labels": Bson::Array(Vec::new()),
        "snoozeUntil": Bson::Null,
        "sla": doc! { "breached": false },
        "lastMessageAt": Bson::Null,
        "lastMessagePreview": Bson::Null,
        "unreadCount": 0_i32,
        "customAttrs": doc! {},
        "firstResponseAt": Bson::Null,
        "resolvedAt": Bson::Null,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };
    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.insert_one"))
    })?;
    Ok(oid)
}

// ===========================================================================
// Content translation
// ===========================================================================

/// Translate the flat ingest payload into a SabChat `ContentBlock`
/// document plus a short inbox-preview string.
///
/// Precedence:
///
/// 1. `photoUrl` set → `Image { url, alt = text }`.
/// 2. `voiceUrl` set → `Voice { url, duration_s, transcript = text }`.
/// 3. Otherwise → `Text { text }` (falls back to a single space so
///    downstream renderers always have *something*).
fn build_content_block(body: &IngestReq) -> (Document, String) {
    let text = body.text.as_deref().unwrap_or("").trim().to_owned();

    if let Some(url) = body.photo_url.as_deref().filter(|s| !s.is_empty()) {
        let preview = if text.is_empty() {
            "[photo]".to_owned()
        } else {
            format!("[photo] {}", short_preview(&text))
        };
        let mut block = doc! { "kind": "image", "url": url };
        if !text.is_empty() {
            block.insert("alt", &text);
        }
        return (block, preview);
    }

    if let Some(url) = body.voice_url.as_deref().filter(|s| !s.is_empty()) {
        let duration = body.voice_duration_s.unwrap_or(0) as i64;
        let preview = if text.is_empty() {
            format!("[voice {duration}s]")
        } else {
            format!("[voice {duration}s] {}", short_preview(&text))
        };
        let mut block = doc! {
            "kind": "voice",
            "url": url,
            "durationS": duration,
        };
        if !text.is_empty() {
            block.insert("transcript", &text);
        }
        return (block, preview);
    }

    let final_text = if text.is_empty() {
        " ".to_owned()
    } else {
        text
    };
    let preview = short_preview(&final_text);
    let block = doc! { "kind": "text", "text": &final_text };
    (block, preview)
}

/// Pre-resolved attachment list for fast inbox indexing — mirrors what
/// `SabChatMessage.attachments` carries.
///
/// We emit a single attachment for photo / voice payloads (no
/// `sabfile_id` because the upstream shim doesn't currently hand one
/// back — left as an empty string for later reconciliation, matching
/// the WhatsApp adapter's convention). Text messages have no
/// attachments.
fn attachments_from_content(body: &IngestReq) -> Bson {
    let mut out: Vec<Bson> = Vec::new();
    if let Some(url) = body.photo_url.as_deref().filter(|s| !s.is_empty()) {
        out.push(Bson::Document(doc! {
            "sabfileId": "",
            "url": url,
            "name": "photo.jpg",
            "mime": "image/jpeg",
        }));
    } else if let Some(url) = body.voice_url.as_deref().filter(|s| !s.is_empty()) {
        out.push(Bson::Document(doc! {
            "sabfileId": "",
            "url": url,
            "name": "voice.ogg",
            "mime": "audio/ogg",
        }));
    }
    Bson::Array(out)
}

/// Trim a message body down to the 200-char inbox-preview cap. Mirrors
/// what `sabchat-conversations` does on the read side.
fn short_preview(s: &str) -> String {
    const CAP: usize = 200;
    if s.chars().count() <= CAP {
        return s.to_owned();
    }
    s.chars().take(CAP).collect::<String>() + "…"
}

// ===========================================================================
// Small helpers
// ===========================================================================

/// Extract an `ObjectId` field from a `Document` with a uniform error
/// message — used everywhere we pull an `_id` / `tenantId` / similar.
fn doc_object_id(doc: &Document, field: &str) -> Result<ObjectId> {
    doc.get_object_id(field)
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("document missing {field}")))
}

/// Parse the optional RFC-3339 timestamp the shim forwards. Falls back
/// to wall-clock if the field is absent or malformed.
fn parse_timestamp(raw: Option<&str>) -> DateTime<Utc> {
    raw.and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(Utc::now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_block_when_no_media() {
        let body = IngestReq {
            bot_username: "b".into(),
            chat_id: "1".into(),
            from_id: "2".into(),
            from_username: None,
            from_name: None,
            text: Some("hello".into()),
            photo_url: None,
            voice_url: None,
            voice_duration_s: None,
            provider_update_id: "u".into(),
            timestamp: None,
        };
        let (block, preview) = build_content_block(&body);
        assert_eq!(block.get_str("kind").unwrap(), "text");
        assert_eq!(block.get_str("text").unwrap(), "hello");
        assert_eq!(preview, "hello");
    }

    #[test]
    fn photo_takes_precedence_over_voice() {
        let body = IngestReq {
            bot_username: "b".into(),
            chat_id: "1".into(),
            from_id: "2".into(),
            from_username: None,
            from_name: None,
            text: Some("look".into()),
            photo_url: Some("https://x/p.jpg".into()),
            voice_url: Some("https://x/v.ogg".into()),
            voice_duration_s: Some(3),
            provider_update_id: "u".into(),
            timestamp: None,
        };
        let (block, preview) = build_content_block(&body);
        assert_eq!(block.get_str("kind").unwrap(), "image");
        assert_eq!(block.get_str("alt").unwrap(), "look");
        assert!(preview.starts_with("[photo]"));
    }

    #[test]
    fn voice_when_only_voice() {
        let body = IngestReq {
            bot_username: "b".into(),
            chat_id: "1".into(),
            from_id: "2".into(),
            from_username: None,
            from_name: None,
            text: None,
            photo_url: None,
            voice_url: Some("https://x/v.ogg".into()),
            voice_duration_s: Some(7),
            provider_update_id: "u".into(),
            timestamp: None,
        };
        let (block, preview) = build_content_block(&body);
        assert_eq!(block.get_str("kind").unwrap(), "voice");
        assert_eq!(block.get_i64("durationS").unwrap(), 7);
        assert_eq!(preview, "[voice 7s]");
    }

    #[test]
    fn empty_text_becomes_space() {
        let body = IngestReq {
            bot_username: "b".into(),
            chat_id: "1".into(),
            from_id: "2".into(),
            from_username: None,
            from_name: None,
            text: Some("   ".into()),
            photo_url: None,
            voice_url: None,
            voice_duration_s: None,
            provider_update_id: "u".into(),
            timestamp: None,
        };
        let (block, _) = build_content_block(&body);
        assert_eq!(block.get_str("text").unwrap(), " ");
    }

    #[test]
    fn parse_timestamp_falls_back_to_now() {
        let t = parse_timestamp(Some("not-a-date"));
        // Sanity — `parse_timestamp` returns wall-clock on garbage.
        assert!(t.timestamp() > 0);
    }
}
