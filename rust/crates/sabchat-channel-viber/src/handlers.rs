use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use mongodb::options::FindOneOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{
    DeliveredReq, DeliveredResp, IngestReq, IngestResp, SubscribedReq, SubscribedResp,
    UnsubscribedReq, UnsubscribedResp,
};
use crate::state::SabChatChannelViberState;

const INBOXES_COLL: &str = "sabchat_inboxes";
const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";

const PROVIDER: &str = "viber";

// ===========================================================================
// POST /ingest
// ===========================================================================

#[instrument(skip_all, fields(account_id = %body.account_id, token = %body.provider_message_token))]
pub async fn ingest(
    State(state): State<SabChatChannelViberState>,
    Json(body): Json<IngestReq>,
) -> Result<Json<IngestResp>> {
    if body.account_id.trim().is_empty() {
        return Err(ApiError::Validation("accountId is required.".to_owned()));
    }
    if body.user_id.trim().is_empty() {
        return Err(ApiError::Validation("userId is required.".to_owned()));
    }
    if body.provider_message_token.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerMessageToken is required.".to_owned(),
        ));
    }

    let inbox = resolve_inbox(&state.mongo, &body.account_id).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

    if let Some(existing) =
        find_message_by_token(&state.mongo, &inbox_id, &body.provider_message_token).await?
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

    let contact_id = upsert_contact(
        &state.mongo,
        &tenant_id,
        &body.user_id,
        body.user_name.as_deref(),
    )
    .await?;

    let conversation_id =
        find_or_create_conversation(&state.mongo, &tenant_id, &inbox_id, &contact_id).await?;

    let (content, preview) = build_content_block(&body);

    let event_ts = parse_timestamp(body.timestamp.as_deref());
    let event_bson_ts = bson::DateTime::from_chrono(event_ts);

    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    let message_oid = ObjectId::new();
    let provider_metadata = doc! {
        "channel": PROVIDER,
        "updateId": &body.provider_message_token,
        "accountId": &body.account_id,
        "userId": &body.user_id,
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
// POST /subscribed
// ===========================================================================

#[instrument(skip_all, fields(account_id = %body.account_id, token = %body.provider_event_token))]
pub async fn subscribed(
    State(state): State<SabChatChannelViberState>,
    Json(body): Json<SubscribedReq>,
) -> Result<Json<SubscribedResp>> {
    if body.account_id.trim().is_empty() {
        return Err(ApiError::Validation("accountId is required.".to_owned()));
    }
    if body.user_id.trim().is_empty() {
        return Err(ApiError::Validation("userId is required.".to_owned()));
    }
    if body.provider_event_token.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerEventToken is required.".to_owned(),
        ));
    }

    let inbox = resolve_inbox(&state.mongo, &body.account_id).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

    if let Some(existing) =
        find_message_by_token(&state.mongo, &inbox_id, &body.provider_event_token).await?
    {
        let conversation_id = existing
            .get_object_id("conversationId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?
            .to_hex();
        let message_id = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?
            .to_hex();
        return Ok(Json(SubscribedResp {
            conversation_id,
            message_id,
            deduped: true,
        }));
    }

    let contact_id = upsert_contact(
        &state.mongo,
        &tenant_id,
        &body.user_id,
        body.user_name.as_deref(),
    )
    .await?;
    let conversation_id =
        find_or_create_conversation(&state.mongo, &tenant_id, &inbox_id, &contact_id).await?;

    let text = "User subscribed".to_owned();
    let provider_metadata = doc! {
        "channel": PROVIDER,
        "updateId": &body.provider_event_token,
        "accountId": &body.account_id,
        "userId": &body.user_id,
        "kind": "subscribed",
    };
    let (message_oid, now_bson) =
        insert_system_message(&state.mongo, &tenant_id, &conversation_id, &inbox_id, &contact_id, &text, provider_metadata)
            .await?;
    bump_conversation_no_unread(&state.mongo, &conversation_id, now_bson, &text).await?;

    Ok(Json(SubscribedResp {
        conversation_id: conversation_id.to_hex(),
        message_id: message_oid.to_hex(),
        deduped: false,
    }))
}

// ===========================================================================
// POST /unsubscribed
// ===========================================================================

#[instrument(skip_all, fields(account_id = %body.account_id, token = %body.provider_event_token))]
pub async fn unsubscribed(
    State(state): State<SabChatChannelViberState>,
    Json(body): Json<UnsubscribedReq>,
) -> Result<Json<UnsubscribedResp>> {
    if body.account_id.trim().is_empty() {
        return Err(ApiError::Validation("accountId is required.".to_owned()));
    }
    if body.user_id.trim().is_empty() {
        return Err(ApiError::Validation("userId is required.".to_owned()));
    }
    if body.provider_event_token.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerEventToken is required.".to_owned(),
        ));
    }

    let inbox = resolve_inbox(&state.mongo, &body.account_id).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

    if let Some(existing) =
        find_message_by_token(&state.mongo, &inbox_id, &body.provider_event_token).await?
    {
        let conversation_id = existing
            .get_object_id("conversationId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?
            .to_hex();
        let message_id = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?
            .to_hex();
        return Ok(Json(UnsubscribedResp {
            conversation_id,
            message_id,
            deduped: true,
        }));
    }

    let contact_id = upsert_contact(
        &state.mongo,
        &tenant_id,
        &body.user_id,
        None,
    )
    .await?;
    let conversation_id =
        find_or_create_conversation(&state.mongo, &tenant_id, &inbox_id, &contact_id).await?;

    let text = "User unsubscribed".to_owned();
    let provider_metadata = doc! {
        "channel": PROVIDER,
        "updateId": &body.provider_event_token,
        "accountId": &body.account_id,
        "userId": &body.user_id,
        "kind": "unsubscribed",
    };
    let (message_oid, now_bson) =
        insert_system_message(&state.mongo, &tenant_id, &conversation_id, &inbox_id, &contact_id, &text, provider_metadata)
            .await?;
    bump_conversation_no_unread(&state.mongo, &conversation_id, now_bson, &text).await?;

    Ok(Json(UnsubscribedResp {
        conversation_id: conversation_id.to_hex(),
        message_id: message_oid.to_hex(),
        deduped: false,
    }))
}

// ===========================================================================
// POST /delivered
// ===========================================================================

#[instrument(skip_all, fields(account_id = %body.account_id, token = %body.provider_message_token))]
pub async fn delivered(
    State(state): State<SabChatChannelViberState>,
    Json(body): Json<DeliveredReq>,
) -> Result<Json<DeliveredResp>> {
    if body.account_id.trim().is_empty() {
        return Err(ApiError::Validation("accountId is required.".to_owned()));
    }
    if body.provider_message_token.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerMessageToken is required.".to_owned(),
        ));
    }

    let inbox = resolve_inbox(&state.mongo, &body.account_id).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;

    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    let result = messages
        .update_one(
            doc! {
                "inboxId": inbox_id,
                "providerMetadata.updateId": &body.provider_message_token,
            },
            doc! {
                "$set": { "providerMetadata.status": &body.status }
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.update_one(delivered)"))
        })?;

    if result.matched_count == 0 {
        return Ok(Json(DeliveredResp { message_id: None }));
    }

    let existing = find_message_by_token(&state.mongo, &inbox_id, &body.provider_message_token).await?;
    let msg_id = existing.and_then(|d| d.get_object_id("_id").ok().map(|oid| oid.to_hex()));

    Ok(Json(DeliveredResp { message_id: msg_id }))
}

// ===========================================================================
// Lookup helpers
// ===========================================================================

async fn resolve_inbox(mongo: &MongoHandle, account_id: &str) -> Result<Document> {
    let coll = mongo.collection::<Document>(INBOXES_COLL);
    coll.find_one(doc! {
        "channelType": PROVIDER,
        "channelConfig.settings.accountId": account_id,
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
    .ok_or_else(|| {
        ApiError::NotFound(format!(
            "No viber inbox configured for accountId {account_id}."
        ))
    })
}

async fn find_message_by_token(
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

async fn upsert_contact(
    mongo: &MongoHandle,
    tenant_id: &ObjectId,
    user_id: &str,
    user_name: Option<&str>,
) -> Result<ObjectId> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);

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
        if let Some(name) = user_name.filter(|s| !s.is_empty()) {
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
    if let Some(name) = user_name.filter(|s| !s.is_empty()) {
        new_doc.insert("name", name);
    }

    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.insert_one"))
    })?;

    Ok(contact_oid)
}

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

    if let Some(url) = body.video_url.as_deref().filter(|s| !s.is_empty()) {
        let preview = if text.is_empty() {
            "[video]".to_owned()
        } else {
            format!("[video] {}", short_preview(&text))
        };
        let mut block = doc! { "kind": "video", "url": url };
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

    if let Some(url) = body.file_url.as_deref().filter(|s| !s.is_empty()) {
        let preview = if text.is_empty() {
            "[file]".to_owned()
        } else {
            format!("[file] {}", short_preview(&text))
        };
        let mut block = doc! { "kind": "file", "url": url };
        if let Some(name) = body.file_name.as_deref().filter(|s| !s.is_empty()) {
            block.insert("name", name);
        }
        return (block, preview);
    }

    if body.location_lat.is_some() || body.location_lon.is_some() {
        let preview = "[location]".to_owned();
        let mut block = doc! { "kind": "location" };
        if let Some(lat) = body.location_lat { block.insert("latitude", lat); }
        if let Some(lon) = body.location_lon { block.insert("longitude", lon); }
        return (block, preview);
    }

    if body.contact_name.is_some() || body.contact_phone.is_some() {
        let preview = "[contact]".to_owned();
        let mut block = doc! { "kind": "contact" };
        if let Some(name) = body.contact_name.as_deref().filter(|s| !s.is_empty()) {
            block.insert("name", name);
        }
        if let Some(phone) = body.contact_phone.as_deref().filter(|s| !s.is_empty()) {
            block.insert("phone", phone);
        }
        return (block, preview);
    }

    if let Some(sid) = body.sticker_id.as_deref().filter(|s| !s.is_empty()) {
        let alt = format!("Viber sticker {sid}");
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

fn attachments_from_content(body: &IngestReq) -> Bson {
    let mut out: Vec<Bson> = Vec::new();
    if let Some(url) = body.image_url.as_deref().filter(|s| !s.is_empty()) {
        out.push(Bson::Document(doc! {
            "sabfileId": "",
            "url": url,
            "name": "image.jpg",
            "mime": "image/jpeg",
        }));
    } else if let Some(url) = body.video_url.as_deref().filter(|s| !s.is_empty()) {
        out.push(Bson::Document(doc! {
            "sabfileId": "",
            "url": url,
            "name": "video.mp4",
            "mime": "video/mp4",
        }));
    } else if let Some(url) = body.audio_url.as_deref().filter(|s| !s.is_empty()) {
        out.push(Bson::Document(doc! {
            "sabfileId": "",
            "url": url,
            "name": "audio.m4a",
            "mime": "audio/mp4",
        }));
    } else if let Some(url) = body.file_url.as_deref().filter(|s| !s.is_empty()) {
        let name = body.file_name.as_deref().unwrap_or("file");
        out.push(Bson::Document(doc! {
            "sabfileId": "",
            "url": url,
            "name": name,
            "mime": "application/octet-stream",
        }));
    }
    Bson::Array(out)
}

fn short_preview(s: &str) -> String {
    const CAP: usize = 200;
    if s.chars().count() <= CAP {
        return s.to_owned();
    }
    s.chars().take(CAP).collect::<String>() + "…"
}

fn doc_object_id(doc: &Document, field: &str) -> Result<ObjectId> {
    doc.get_object_id(field)
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("document missing {field}")))
}

fn parse_timestamp(raw: Option<&str>) -> DateTime<Utc> {
    raw.and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(Utc::now)
}
