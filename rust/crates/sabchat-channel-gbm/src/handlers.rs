use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use mongodb::options::FindOneOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{DeliveredReq, DeliveredResp, IngestReq, IngestResp};
use crate::state::SabChatChannelGbmState;

const INBOXES_COLL: &str = "sabchat_inboxes";
const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";
const PROVIDER: &str = "google_business_messages";

#[instrument(skip_all, fields(agent_id = %body.agent_id, update_id = %body.provider_update_id))]
pub async fn ingest(
    State(state): State<SabChatChannelGbmState>,
    Json(body): Json<IngestReq>,
) -> Result<Json<IngestResp>> {
    if body.agent_id.trim().is_empty() {
        return Err(ApiError::Validation("agentId is required.".to_owned()));
    }
    if body.conversation_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "conversationId is required.".to_owned(),
        ));
    }
    if body.provider_update_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerUpdateId is required.".to_owned(),
        ));
    }

    let inbox = resolve_inbox(&state.mongo, &body.agent_id).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

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

    let contact_id = upsert_contact(
        &state.mongo,
        &tenant_id,
        &body.conversation_id,
        body.from_name.as_deref(),
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
        "updateId": &body.provider_update_id,
        "agentId": &body.agent_id,
        "gbmConversationId": &body.conversation_id,
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

#[instrument(skip_all, fields(agent_id = %body.agent_id, update_id = %body.provider_update_id))]
pub async fn delivered(
    State(state): State<SabChatChannelGbmState>,
    Json(body): Json<DeliveredReq>,
) -> Result<Json<DeliveredResp>> {
    if body.agent_id.trim().is_empty() {
        return Err(ApiError::Validation("agentId is required.".to_owned()));
    }
    if body.conversation_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "conversationId is required.".to_owned(),
        ));
    }
    if body.provider_update_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerUpdateId is required.".to_owned(),
        ));
    }

    let inbox = resolve_inbox(&state.mongo, &body.agent_id).await?;
    let inbox_id = doc_object_id(&inbox, "_id")?;
    let tenant_id = doc_object_id(&inbox, "tenantId")?;

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
        return Ok(Json(DeliveredResp {
            conversation_id,
            message_id,
            deduped: true,
        }));
    }

    let contacts = state.mongo.collection::<Document>(CONTACTS_COLL);
    let contact = contacts
        .find_one(doc! {
            "tenantId": tenant_id,
            "socialIds": {
                "$elemMatch": {
                    "provider": PROVIDER,
                    "externalId": &body.conversation_id,
                },
            },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
        })?
        .ok_or_else(|| {
            ApiError::NotFound("No SabChat contact matches this GBM user.".to_owned())
        })?;
    let contact_id = doc_object_id(&contact, "_id")?;

    let conversation_id = latest_open_conversation(&state.mongo, &inbox_id, &contact_id)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound("No open SabChat conversation for this GBM contact.".to_owned())
        })?;

    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    let message_oid = ObjectId::new();
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let text = format!("Message delivered: {}", body.message_id);
    let provider_metadata = doc! {
        "channel": PROVIDER,
        "updateId": &body.provider_update_id,
        "agentId": &body.agent_id,
        "gbmConversationId": &body.conversation_id,
        "kind": "delivery_receipt",
        "messageId": &body.message_id,
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
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one(delivered)"))
    })?;

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
                anyhow::Error::new(e).context("sabchat_conversations.update_one(delivered)"),
            )
        })?;

    Ok(Json(DeliveredResp {
        conversation_id: conversation_id.to_hex(),
        message_id: message_oid.to_hex(),
        deduped: false,
    }))
}

async fn resolve_inbox(mongo: &MongoHandle, agent_id: &str) -> Result<Document> {
    let coll = mongo.collection::<Document>(INBOXES_COLL);
    coll.find_one(doc! {
        "channelType": PROVIDER,
        "channelConfig.settings.agentId": agent_id,
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
    .ok_or_else(|| ApiError::NotFound(format!("No gbm inbox configured for agentId {agent_id}.")))
}

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

async fn upsert_contact(
    mongo: &MongoHandle,
    tenant_id: &ObjectId,
    from_id: &str,
    from_name: Option<&str>,
) -> Result<ObjectId> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);

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

        let update_doc = doc! { "$set": update_set };
        coll.update_one(doc! { "_id": contact_oid }, update_doc)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.update_one"))
            })?;

        return Ok(contact_oid);
    }

    let contact_oid = ObjectId::new();
    let social = doc! {
        "provider": PROVIDER,
        "externalId": from_id,
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
    if let Some(name) = from_name.filter(|s| !s.is_empty()) {
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
    if let Some(url) = body.photo_url.as_deref().filter(|s| !s.is_empty()) {
        out.push(Bson::Document(doc! {
            "sabfileId": "",
            "url": url,
            "name": "photo.jpg",
            "mime": "image/jpeg",
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
