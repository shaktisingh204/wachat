//! HTTP handlers for the SabChat LINE channel adapter.
//!
//! Each handler is a thin orchestration layer over four Mongo
//! collections:
//!
//! | Endpoint              | Collections touched                                    |
//! |-----------------------|--------------------------------------------------------|
//! | `POST /ingest`        | `sabchat_inboxes`, `sabchat_contacts`, `sabchat_conversations`, `sabchat_messages` |
//! | `POST /follow`        | `sabchat_inboxes`, `sabchat_contacts`, `sabchat_conversations`, `sabchat_messages` |
//! | `POST /postback`      | `sabchat_inboxes`, `sabchat_contacts`, `sabchat_conversations`, `sabchat_messages` |
//!
//! ## Idempotency contract
//!
//! Every endpoint writes `provider_metadata.update_id` on every message
//! it creates. Before inserting, we look up an existing message on
//! `(inbox_id, provider_metadata.update_id)` — if it exists we return
//! the cached ids with `deduped = true` rather than appending a
//! duplicate. This is the standard SabChat adapter behaviour and
//! matches what `sabchat-channel-whatsapp` does for `wamid.*` and what
//! `sabchat-channel-telegram` does for `update_id`.
//!
//! ## Identity resolution
//!
//! LINE has a stable per-user `userId` so contact resolution is
//! straightforward: look up `sabchat_contacts` with `tenant_id +
//! social_ids.{provider="line", external_id=user_id}`. On miss we
//! `$setOnInsert` a fresh contact carrying the optional display name.
//!
//! ## Conversation resolution
//!
//! For `(inbox, contact)` we look for the most-recent `Open` or
//! `Pending` conversation — Chatwoot-style. If the latest conversation
//! is `Resolved` / `Snoozed` / non-existent, we create a new one. All
//! three endpoints (`/ingest`, `/follow`, `/postback`) use
//! find-or-create semantics — postbacks/follows from a brand-new user
//! still spawn a contact + conversation, because LINE follow events
//! genuinely *are* a new-user signal.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use mongodb::options::FindOneOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{FollowReq, FollowResp, IngestReq, IngestResp, PostbackReq, PostbackResp};
use crate::state::SabChatChannelLineState;

/// Mongo collection names — kept inline so reviews against the
/// `sabchat-types` collection-table stay trivial.
const INBOXES_COLL: &str = "sabchat_inboxes";
const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";

/// Stable provider discriminant baked into `social_ids.provider` and
/// the message `provider_metadata.channel` field. Lower-case to match
/// `ChannelType::Line`'s snake_case serde value.
const PROVIDER: &str = "line";

// ===========================================================================
// POST /ingest
// ===========================================================================

/// `POST /ingest` — land one inbound LINE message on the conversation
/// graph.
///
/// Steps (each one mirrors a sibling channel adapter):
///
/// 1. Validate the bare-minimum required fields.
/// 2. Resolve the LINE inbox by `(channelType=line,
///    channelConfig.settings.channelId=channelId)`.
/// 3. Check for an existing `sabchat_messages` row with the same
///    `(inboxId, provider_metadata.update_id)` — return early if found.
/// 4. Find-or-create the per-tenant contact keyed on the LINE
///    `user_id` social identity.
/// 5. Find-or-create the latest open conversation on `(inbox, contact)`.
/// 6. Translate `text` / `image_url` / `audio_url` / sticker into a
///    [`ContentBlock`](sabchat_types::ContentBlock) and insert the
///    message.
/// 7. Update the conversation's `last_message_*` fields and bump
///    `unread_count`.
#[instrument(skip_all, fields(channel_id = %body.channel_id, message_id = %body.provider_message_id))]
pub async fn ingest(
    State(state): State<SabChatChannelLineState>,
    Json(body): Json<IngestReq>,
) -> Result<Json<IngestResp>> {
    // ---- Input validation ---------------------------------------------
    if body.channel_id.trim().is_empty() {
        return Err(ApiError::Validation("channelId is required.".to_owned()));
    }
    if body.user_id.trim().is_empty() {
        return Err(ApiError::Validation("userId is required.".to_owned()));
    }
    if body.provider_message_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerMessageId is required.".to_owned(),
        ));
    }

    // ---- Resolve target inbox -----------------------------------------
    let inbox = resolve_inbox(&state.mongo, &body.channel_id).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

    // ---- Idempotency check --------------------------------------------
    if let Some(existing) =
        find_message_by_update_id(&state.mongo, &inbox_id, &body.provider_message_id).await?
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
        &body.user_id,
        body.display_name.as_deref(),
    )
    .await?;

    // ---- Resolve / create conversation --------------------------------
    let conversation_id =
        find_or_create_conversation(&state.mongo, &tenant_id, &inbox_id, &contact_id).await?;

    // ---- Build the ContentBlock ---------------------------------------
    //
    // Map per the channel contract:
    //   image    → Image     (with text as alt-caption when present)
    //   audio    → Voice     (with text as transcript when present)
    //   sticker  → Image     (url=null, alt="LINE sticker …")
    //   text     → Text      (default fallback; empty text becomes a
    //                         single space so downstream renderers don't
    //                         choke)
    let (content, preview) = build_content_block(&body);

    // ---- Resolve timestamps -------------------------------------------
    let event_ts = parse_timestamp(body.timestamp.as_deref());
    let event_bson_ts = bson::DateTime::from_chrono(event_ts);

    // ---- Insert the message -------------------------------------------
    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    let message_oid = ObjectId::new();
    let mut provider_metadata = doc! {
        "channel": PROVIDER,
        "updateId": &body.provider_message_id,
        "channelId": &body.channel_id,
        "userId": &body.user_id,
    };
    if let Some(pkg) = body.sticker_package_id.as_deref().filter(|s| !s.is_empty()) {
        provider_metadata.insert("stickerPackageId", pkg);
    }
    if let Some(sid) = body.sticker_id.as_deref().filter(|s| !s.is_empty()) {
        provider_metadata.insert("stickerId", sid);
    }
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
// POST /follow
// ===========================================================================

/// `POST /follow` — record a LINE `follow` event (the user added the
/// official account as a friend / unblocked) as a `System`-typed
/// message on the latest open conversation for the `(inbox, contact)`
/// pair.
///
/// Unlike `/postback`, this endpoint **does** auto-create the contact
/// and conversation: a fresh follow really is a new-user signal, and
/// we want the inbox row to show up even before the user sends their
/// first message.
#[instrument(skip_all, fields(channel_id = %body.channel_id, event_id = %body.provider_event_id))]
pub async fn follow(
    State(state): State<SabChatChannelLineState>,
    Json(body): Json<FollowReq>,
) -> Result<Json<FollowResp>> {
    // ---- Input validation ---------------------------------------------
    if body.channel_id.trim().is_empty() {
        return Err(ApiError::Validation("channelId is required.".to_owned()));
    }
    if body.user_id.trim().is_empty() {
        return Err(ApiError::Validation("userId is required.".to_owned()));
    }
    if body.provider_event_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerEventId is required.".to_owned(),
        ));
    }

    // ---- Resolve target inbox -----------------------------------------
    let inbox = resolve_inbox(&state.mongo, &body.channel_id).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

    // ---- Idempotency check --------------------------------------------
    if let Some(existing) =
        find_message_by_update_id(&state.mongo, &inbox_id, &body.provider_event_id).await?
    {
        let conversation_id = existing
            .get_object_id("conversationId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?
            .to_hex();
        let message_id = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?
            .to_hex();
        return Ok(Json(FollowResp {
            conversation_id,
            message_id,
            deduped: true,
        }));
    }

    // ---- Find-or-create contact + conversation ------------------------
    let contact_id = upsert_contact(
        &state.mongo,
        &tenant_id,
        &body.user_id,
        body.display_name.as_deref(),
    )
    .await?;
    let conversation_id =
        find_or_create_conversation(&state.mongo, &tenant_id, &inbox_id, &contact_id).await?;

    // ---- Insert the System message ------------------------------------
    let text = "User followed".to_owned();
    let provider_metadata = doc! {
        "channel": PROVIDER,
        "updateId": &body.provider_event_id,
        "channelId": &body.channel_id,
        "userId": &body.user_id,
        "kind": "follow",
    };
    let (message_oid, now_bson) = insert_system_message(
        &state.mongo,
        &tenant_id,
        &conversation_id,
        &inbox_id,
        &contact_id,
        &text,
        provider_metadata,
    )
    .await?;
    bump_conversation_no_unread(&state.mongo, &conversation_id, now_bson, &text).await?;

    Ok(Json(FollowResp {
        conversation_id: conversation_id.to_hex(),
        message_id: message_oid.to_hex(),
        deduped: false,
    }))
}

// ===========================================================================
// POST /postback
// ===========================================================================

/// `POST /postback` — record a LINE postback button tap (rich-menu,
/// quick-reply, template button) as a `System`-typed message on the
/// latest open conversation for the `(inbox, contact)` pair.
///
/// Like `/follow`, postbacks find-or-create the contact + conversation
/// — a tap from a never-conversed user still belongs in the inbox,
/// even though the rich-menu UI normally implies the user has at least
/// followed the account first.
#[instrument(skip_all, fields(channel_id = %body.channel_id, event_id = %body.provider_event_id))]
pub async fn postback(
    State(state): State<SabChatChannelLineState>,
    Json(body): Json<PostbackReq>,
) -> Result<Json<PostbackResp>> {
    // ---- Input validation ---------------------------------------------
    if body.channel_id.trim().is_empty() {
        return Err(ApiError::Validation("channelId is required.".to_owned()));
    }
    if body.user_id.trim().is_empty() {
        return Err(ApiError::Validation("userId is required.".to_owned()));
    }
    if body.provider_event_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerEventId is required.".to_owned(),
        ));
    }

    // ---- Resolve target inbox -----------------------------------------
    let inbox = resolve_inbox(&state.mongo, &body.channel_id).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

    // ---- Idempotency check --------------------------------------------
    if let Some(existing) =
        find_message_by_update_id(&state.mongo, &inbox_id, &body.provider_event_id).await?
    {
        let conversation_id = existing
            .get_object_id("conversationId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?
            .to_hex();
        let message_id = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?
            .to_hex();
        return Ok(Json(PostbackResp {
            conversation_id,
            message_id,
            deduped: true,
        }));
    }

    // ---- Find-or-create contact + conversation ------------------------
    let contact_id = upsert_contact(&state.mongo, &tenant_id, &body.user_id, None).await?;
    let conversation_id =
        find_or_create_conversation(&state.mongo, &tenant_id, &inbox_id, &contact_id).await?;

    // ---- Insert the System message ------------------------------------
    let text = format!("Postback: {}", body.data);
    let provider_metadata = doc! {
        "channel": PROVIDER,
        "updateId": &body.provider_event_id,
        "channelId": &body.channel_id,
        "userId": &body.user_id,
        "kind": "postback",
        "data": &body.data,
    };
    let (message_oid, now_bson) = insert_system_message(
        &state.mongo,
        &tenant_id,
        &conversation_id,
        &inbox_id,
        &contact_id,
        &text,
        provider_metadata,
    )
    .await?;
    bump_conversation_no_unread(&state.mongo, &conversation_id, now_bson, &text).await?;

    Ok(Json(PostbackResp {
        conversation_id: conversation_id.to_hex(),
        message_id: message_oid.to_hex(),
        deduped: false,
    }))
}

// ===========================================================================
// Lookup helpers
// ===========================================================================

/// Resolve a LINE inbox by `(channelType, channelId)`. The `channel_id`
/// field is matched verbatim against
/// `channelConfig.settings.channelId` — the webhook shim is expected
/// to forward `event.destination` from LINE's webhook envelope.
///
/// Returns 404 if no enabled line inbox matches.
async fn resolve_inbox(mongo: &MongoHandle, channel_id: &str) -> Result<Document> {
    let coll = mongo.collection::<Document>(INBOXES_COLL);
    coll.find_one(doc! {
        "channelType": PROVIDER,
        "channelConfig.settings.channelId": channel_id,
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
    .ok_or_else(|| {
        ApiError::NotFound(format!(
            "No line inbox configured for channelId {channel_id}."
        ))
    })
}

/// Look up an existing message with `(inboxId, providerMetadata.updateId)`
/// — used by every endpoint for idempotency.
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

/// Find-or-create a SabChat contact for this LINE user.
///
/// We dedupe on `(tenantId, socialIds.{provider="line",
/// externalId=user_id})`. On miss we insert a brand-new contact with
/// the social identity and optional display name. On hit we bump
/// `lastSeenAt` and backfill the display name if we now know it and
/// the contact didn't carry one yet — LINE display names sometimes
/// only surface on a profile fetch the shim runs lazily, and we want
/// the inbox row to reflect it.
async fn upsert_contact(
    mongo: &MongoHandle,
    tenant_id: &ObjectId,
    user_id: &str,
    display_name: Option<&str>,
) -> Result<ObjectId> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);

    // Step 1 — try to find the existing contact.
    let existing = coll
        .find_one(doc! {
            "tenantId": tenant_id,
            "socialIds": {
                "$elemMatch": {
                    "provider": PROVIDER,
                    "externalId": user_id,
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

        let mut update_set = doc! { "updatedAt": now_bson, "lastSeenAt": now_bson };
        if let Some(name) = display_name.filter(|s| !s.is_empty()) {
            let needs_name = doc_existing
                .get_str("name")
                .map(|s| s.is_empty())
                .unwrap_or(true);
            if needs_name {
                update_set.insert("name", name);
            }
        }
        coll.update_one(doc! { "_id": contact_oid }, doc! { "$set": update_set })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.update_one"))
            })?;

        return Ok(contact_oid);
    }

    // Step 2 — fresh insert.
    let contact_oid = ObjectId::new();
    let social = doc! {
        "provider": PROVIDER,
        "externalId": user_id,
    };
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
    if let Some(name) = display_name.filter(|s| !s.is_empty()) {
        new_doc.insert("name", name);
    }

    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.insert_one"))
    })?;

    Ok(contact_oid)
}

/// Find the latest `Open` or `Pending` conversation for the
/// `(inbox, contact)` pair. Returns `None` if no such row exists —
/// the caller then creates one.
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
/// pair. Mirrors what every SabChat channel adapter does.
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

/// Insert a single `System`-typed message — used by both `/follow` and
/// `/postback`. Returns the new message id and the wall-clock timestamp
/// it was stamped with (so the caller can reuse it for the matching
/// conversation summary bump).
async fn insert_system_message(
    mongo: &MongoHandle,
    tenant_id: &ObjectId,
    conversation_id: &ObjectId,
    inbox_id: &ObjectId,
    contact_id: &ObjectId,
    text: &str,
    provider_metadata: Document,
) -> Result<(ObjectId, bson::DateTime)> {
    let messages = mongo.collection::<Document>(MESSAGES_COLL);
    let message_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let message_doc = doc! {
        "_id": message_oid,
        "tenantId": tenant_id,
        "conversationId": conversation_id,
        "inboxId": inbox_id,
        "contactId": contact_id,
        "senderType": "system",
        "senderId": Bson::Null,
        "direction": "inbound",
        "content": doc! { "kind": "system", "text": text },
        "attachments": Bson::Array(Vec::new()),
        "providerMetadata": provider_metadata,
        "private": false,
        "createdAt": now_bson,
    };
    messages.insert_one(message_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one(system)"))
    })?;
    Ok((message_oid, now_bson))
}

/// Bump the conversation summary without touching `unreadCount`. Used
/// by `/follow` and `/postback` — they're synthetic events, not visitor
/// speech, so they should re-sort the inbox but not mark it unread.
async fn bump_conversation_no_unread(
    mongo: &MongoHandle,
    conversation_id: &ObjectId,
    now_bson: bson::DateTime,
    preview: &str,
) -> Result<()> {
    let conversations = mongo.collection::<Document>(CONVERSATIONS_COLL);
    conversations
        .update_one(
            doc! { "_id": conversation_id },
            doc! {
                "$set": {
                    "lastMessageAt": now_bson,
                    "lastMessagePreview": preview,
                    "updatedAt": now_bson,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(system)"),
            )
        })?;
    Ok(())
}

// ===========================================================================
// Content translation
// ===========================================================================

/// Translate the flat ingest payload into a SabChat `ContentBlock`
/// document plus a short inbox-preview string.
///
/// Precedence:
///
/// 1. `imageUrl` set → `Image { url, alt = text }`.
/// 2. `audioUrl` set → `Voice { url, transcript = text }`.
/// 3. Sticker fields set → `Image { url=null, alt="LINE sticker
///    {pkg}/{id}" }` (LINE doesn't expose a public sticker CDN URL).
/// 4. Otherwise → `Text { text }` (falls back to a single space so
///    downstream renderers always have *something*).
fn build_content_block(body: &IngestReq) -> (Document, String) {
    let text = body.text.as_deref().unwrap_or("").trim().to_owned();

    if let Some(url) = body.image_url.as_deref().filter(|s| !s.is_empty()) {
        let preview = if text.is_empty() {
            "[image]".to_owned()
        } else {
            format!("[image] {}", short_preview(&text))
        };
        let mut block = doc! { "kind": "image", "url": url };
        if !text.is_empty() {
            block.insert("alt", &text);
        }
        return (block, preview);
    }

    if let Some(url) = body.audio_url.as_deref().filter(|s| !s.is_empty()) {
        let preview = if text.is_empty() {
            "[audio]".to_owned()
        } else {
            format!("[audio] {}", short_preview(&text))
        };
        let mut block = doc! {
            "kind": "voice",
            "url": url,
            "durationS": 0_i64,
        };
        if !text.is_empty() {
            block.insert("transcript", &text);
        }
        return (block, preview);
    }

    // Sticker — emit an Image block with `url=null` and an alt
    // describing the sticker. We carry the pkg/id in the alt for now
    // since there's no public LINE sticker CDN; downstream renderers
    // can still surface "LINE sticker" alongside the metadata in
    // `providerMetadata`.
    if body.sticker_package_id.is_some() || body.sticker_id.is_some() {
        let pkg = body.sticker_package_id.as_deref().unwrap_or("");
        let sid = body.sticker_id.as_deref().unwrap_or("");
        let alt = if pkg.is_empty() && sid.is_empty() {
            "LINE sticker".to_owned()
        } else {
            format!("LINE sticker {pkg}/{sid}")
        };
        let block = doc! {
            "kind": "image",
            "url": Bson::Null,
            "alt": &alt,
        };
        return (block, format!("[sticker] {alt}"));
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
/// We emit a single attachment for image / audio payloads (no
/// `sabfile_id` because the upstream shim doesn't currently hand one
/// back — left as an empty string for later reconciliation, matching
/// the WhatsApp + Telegram adapter convention). Stickers and plain
/// text have no attachments.
fn attachments_from_content(body: &IngestReq) -> Bson {
    let mut out: Vec<Bson> = Vec::new();
    if let Some(url) = body.image_url.as_deref().filter(|s| !s.is_empty()) {
        out.push(Bson::Document(doc! {
            "sabfileId": "",
            "url": url,
            "name": "image.jpg",
            "mime": "image/jpeg",
        }));
    } else if let Some(url) = body.audio_url.as_deref().filter(|s| !s.is_empty()) {
        out.push(Bson::Document(doc! {
            "sabfileId": "",
            "url": url,
            "name": "audio.m4a",
            "mime": "audio/m4a",
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

    fn mk_body() -> IngestReq {
        IngestReq {
            channel_id: "C1".into(),
            user_id: "U1".into(),
            display_name: None,
            text: None,
            sticker_package_id: None,
            sticker_id: None,
            image_url: None,
            audio_url: None,
            provider_message_id: "m1".into(),
            timestamp: None,
        }
    }

    #[test]
    fn text_block_when_no_media() {
        let mut body = mk_body();
        body.text = Some("hello".into());
        let (block, preview) = build_content_block(&body);
        assert_eq!(block.get_str("kind").unwrap(), "text");
        assert_eq!(block.get_str("text").unwrap(), "hello");
        assert_eq!(preview, "hello");
    }

    #[test]
    fn image_takes_precedence_over_audio() {
        let mut body = mk_body();
        body.text = Some("look".into());
        body.image_url = Some("https://x/p.jpg".into());
        body.audio_url = Some("https://x/v.m4a".into());
        let (block, preview) = build_content_block(&body);
        assert_eq!(block.get_str("kind").unwrap(), "image");
        assert_eq!(block.get_str("alt").unwrap(), "look");
        assert!(preview.starts_with("[image]"));
    }

    #[test]
    fn audio_when_only_audio() {
        let mut body = mk_body();
        body.audio_url = Some("https://x/v.m4a".into());
        let (block, preview) = build_content_block(&body);
        assert_eq!(block.get_str("kind").unwrap(), "voice");
        assert_eq!(preview, "[audio]");
    }

    #[test]
    fn sticker_becomes_image_with_null_url() {
        let mut body = mk_body();
        body.sticker_package_id = Some("11537".into());
        body.sticker_id = Some("52002734".into());
        let (block, preview) = build_content_block(&body);
        assert_eq!(block.get_str("kind").unwrap(), "image");
        assert!(matches!(block.get("url"), Some(Bson::Null)));
        assert!(block.get_str("alt").unwrap().contains("11537/52002734"));
        assert!(preview.starts_with("[sticker]"));
    }

    #[test]
    fn empty_text_becomes_space() {
        let mut body = mk_body();
        body.text = Some("   ".into());
        let (block, _) = build_content_block(&body);
        assert_eq!(block.get_str("text").unwrap(), " ");
    }

    #[test]
    fn parse_timestamp_falls_back_to_now() {
        let t = parse_timestamp(Some("not-a-date"));
        assert!(t.timestamp() > 0);
    }
}
