use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabchat_types::SabChatContact;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use tracing::instrument;

use crate::dto::{
    AppendMessageBody, AppendMessageResponse, ContactResponse, ConversationResponse,
    CreateContactBody, DEFAULT_LIMIT, ListContactsQuery, ListContactsResponse,
    ListConversationsQuery, ListConversationsResponse, ListMessagesQuery, ListMessagesResponse,
    MAX_LIMIT, SCOPE_READ, SCOPE_WRITE,
};
use crate::state::SabChatPublicApiState;
use wachat_public_api::ApiKeyAuth;

const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";

// ===========================================================================
// Helpers
// ===========================================================================

fn parse_tenant(hex: &str) -> Result<ObjectId> {
    ObjectId::parse_str(hex)
        .map_err(|_| ApiError::Unauthorized("tenantId is not a valid ObjectId".to_owned()))
}

// ===========================================================================
// Contacts
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_contacts(
    ApiKeyAuth(auth): ApiKeyAuth,
    State(state): State<SabChatPublicApiState>,
    Query(query): Query<ListContactsQuery>,
) -> Result<Json<ListContactsResponse>> {
    if !auth.has_scope(SCOPE_READ) {
        return Err(ApiError::Forbidden(format!("requires {}", SCOPE_READ)));
    }
    let tenant = parse_tenant(&auth.tenant_id)?;
    let mut filter = doc! { "tenantId": tenant };

    if let Some(q) = query.q {
        if !q.trim().is_empty() {
            let regex_doc = doc! { "$regex": q.trim(), "$options": "i" };
            filter.insert(
                "$or",
                vec![
                    doc! { "name": regex_doc.clone() },
                    doc! { "emails": regex_doc.clone() },
                    doc! { "phones": regex_doc.clone() },
                ],
            );
        }
    }

    if let Some(tag) = query.tag {
        if !tag.trim().is_empty() {
            filter.insert("tags", tag.trim());
        }
    }

    if let Some(cursor) = query.cursor {
        if !cursor.trim().is_empty() {
            filter.insert("_id", doc! { "$lt": oid_from_str(&cursor)? });
        }
    }

    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<SabChatContact>(CONTACTS_COLL);
    let items: Vec<SabChatContact> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let next_cursor = if items.len() == limit as usize {
        items.last().map(|i| i.id.to_hex())
    } else {
        None
    };

    Ok(Json(ListContactsResponse { items, next_cursor }))
}

#[instrument(skip_all, fields(contact_id = %id))]
pub async fn get_contact(
    ApiKeyAuth(auth): ApiKeyAuth,
    State(state): State<SabChatPublicApiState>,
    Path(id): Path<String>,
) -> Result<Json<ContactResponse>> {
    if !auth.has_scope(SCOPE_READ) {
        return Err(ApiError::Forbidden(format!("requires {}", SCOPE_READ)));
    }
    let tenant = parse_tenant(&auth.tenant_id)?;
    let contact_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<SabChatContact>(CONTACTS_COLL);
    let contact = coll
        .find_one(doc! { "_id": contact_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("Contact not found".to_owned()))?;

    Ok(Json(ContactResponse { contact }))
}

#[instrument(skip_all)]
pub async fn create_contact(
    ApiKeyAuth(auth): ApiKeyAuth,
    State(state): State<SabChatPublicApiState>,
    Json(body): Json<CreateContactBody>,
) -> Result<Json<ContactResponse>> {
    if !auth.has_scope(SCOPE_WRITE) {
        return Err(ApiError::Forbidden(format!("requires {}", SCOPE_WRITE)));
    }
    let tenant = parse_tenant(&auth.tenant_id)?;

    if body.emails.is_empty() && body.phones.is_empty() && body.social_ids.is_empty() {
        return Err(ApiError::Validation(
            "Contact must have at least one email, phone, or social id.".to_owned(),
        ));
    }

    let now = Utc::now();
    let contact = SabChatContact {
        id: ObjectId::new(),
        tenant_id: tenant,
        name: body.name,
        avatar_url: body.avatar_url,
        emails: body.emails.into_iter().map(|e| e.to_lowercase()).collect(),
        phones: body.phones,
        social_ids: body.social_ids,
        attrs: body.attrs.unwrap_or(serde_json::Value::Null),
        tags: body.tags,
        last_seen_at: None,
        crm_contact_id: None,
        created_at: now,
        updated_at: now,
    };

    let coll = state.mongo.collection::<SabChatContact>(CONTACTS_COLL);
    coll.insert_one(&contact)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(ContactResponse { contact }))
}

// ===========================================================================
// Conversations
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_conversations(
    ApiKeyAuth(auth): ApiKeyAuth,
    State(state): State<SabChatPublicApiState>,
    Query(query): Query<ListConversationsQuery>,
) -> Result<Json<ListConversationsResponse>> {
    if !auth.has_scope(SCOPE_READ) {
        return Err(ApiError::Forbidden(format!("requires {}", SCOPE_READ)));
    }
    let tenant = parse_tenant(&auth.tenant_id)?;
    let mut filter = doc! { "tenantId": tenant };

    if let Some(inbox_id) = query.inbox_id {
        if !inbox_id.trim().is_empty() {
            filter.insert("inboxId", oid_from_str(inbox_id.trim())?);
        }
    }

    if let Some(status) = query.status {
        let status_val = serde_json::to_value(status).unwrap_or(serde_json::Value::Null);
        filter.insert(
            "status",
            bson::Bson::try_from(status_val).unwrap_or(bson::Bson::Null),
        );
    }

    if let Some(q) = query.q {
        if !q.trim().is_empty() {
            let regex_doc = doc! { "$regex": q.trim(), "$options": "i" };
            filter.insert("lastMessagePreview", regex_doc);
        }
    }

    if let Some(cursor) = query.cursor {
        if !cursor.trim().is_empty() {
            filter.insert("_id", doc! { "$lt": oid_from_str(&cursor)? });
        }
    }

    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let items: Vec<Document> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let next_cursor = if items.len() == limit as usize {
        items
            .last()
            .and_then(|doc| doc.get_object_id("_id").ok())
            .map(|id| id.to_hex())
    } else {
        None
    };

    let conversations = items.into_iter().map(document_to_clean_json).collect();

    Ok(Json(ListConversationsResponse {
        conversations,
        next_cursor,
    }))
}

#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn get_conversation(
    ApiKeyAuth(auth): ApiKeyAuth,
    State(state): State<SabChatPublicApiState>,
    Path(id): Path<String>,
) -> Result<Json<ConversationResponse>> {
    if !auth.has_scope(SCOPE_READ) {
        return Err(ApiError::Forbidden(format!("requires {}", SCOPE_READ)));
    }
    let tenant = parse_tenant(&auth.tenant_id)?;
    let conversation_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let doc = coll
        .find_one(doc! { "_id": conversation_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("Conversation not found".to_owned()))?;

    Ok(Json(ConversationResponse {
        conversation: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// Messages
// ===========================================================================

#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn list_messages(
    ApiKeyAuth(auth): ApiKeyAuth,
    State(state): State<SabChatPublicApiState>,
    Path(id): Path<String>,
    Query(query): Query<ListMessagesQuery>,
) -> Result<Json<ListMessagesResponse>> {
    if !auth.has_scope(SCOPE_READ) {
        return Err(ApiError::Forbidden(format!("requires {}", SCOPE_READ)));
    }
    let tenant = parse_tenant(&auth.tenant_id)?;
    let conversation_oid = oid_from_str(&id)?;

    // verify access to conversation
    let conv_coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let conv_exists = conv_coll
        .count_documents(doc! { "_id": conversation_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if conv_exists == 0 {
        return Err(ApiError::NotFound("Conversation not found".to_owned()));
    }

    let mut filter = doc! { "conversationId": conversation_oid };

    if let Some(before_id) = query.before_id {
        if !before_id.trim().is_empty() {
            filter.insert("_id", doc! { "$lt": oid_from_str(&before_id)? });
        }
    }

    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let mut items: Vec<Document> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    items.reverse();

    let messages = items.into_iter().map(document_to_clean_json).collect();

    Ok(Json(ListMessagesResponse { messages }))
}

#[instrument(skip_all, fields(conversation_id = %id))]
pub async fn append_message(
    ApiKeyAuth(auth): ApiKeyAuth,
    State(state): State<SabChatPublicApiState>,
    Path(id): Path<String>,
    Json(body): Json<AppendMessageBody>,
) -> Result<Json<AppendMessageResponse>> {
    if !auth.has_scope(SCOPE_WRITE) {
        return Err(ApiError::Forbidden(format!("requires {}", SCOPE_WRITE)));
    }
    let tenant = parse_tenant(&auth.tenant_id)?;
    let conversation_oid = oid_from_str(&id)?;

    let conv_coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let _conv_doc = conv_coll
        .find_one(doc! { "_id": conversation_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("Conversation not found".to_owned()))?;

    let now = bson::DateTime::from_chrono(Utc::now());
    let msg_id = ObjectId::new();

    let mut doc = doc! {
        "_id": msg_id,
        "conversationId": conversation_oid,
        "senderType": "bot",
        "content": bson::to_document(&body.content).unwrap_or_default(),
        "createdAt": now,
        "updatedAt": now,
        "private": body.private,
    };

    if let Some(sender_id) = body.sender_id {
        if !sender_id.trim().is_empty() {
            doc.insert("senderId", sender_id.trim());
        }
    }

    let msg_coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    msg_coll
        .insert_one(&doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    // Update conversation lastMessagePreview
    // A simplified snippet
    let preview = match &body.content {
        sabchat_types::ContentBlock::Text { text } => text.chars().take(50).collect::<String>(),
        sabchat_types::ContentBlock::Image { .. } => "[Image]".to_string(),
        sabchat_types::ContentBlock::File { .. } => "[File]".to_string(),
        sabchat_types::ContentBlock::Voice { .. } => "[Voice]".to_string(),
        sabchat_types::ContentBlock::Card { title, .. } => format!("[Card] {}", title),
        sabchat_types::ContentBlock::Carousel { .. } => "[Carousel]".to_string(),
        sabchat_types::ContentBlock::Form { .. } => "[Form]".to_string(),
        sabchat_types::ContentBlock::Payment { .. } => "[Payment]".to_string(),
        sabchat_types::ContentBlock::Location { .. } => "[Location]".to_string(),
        sabchat_types::ContentBlock::System { text } => text.chars().take(50).collect::<String>(),
    };

    let _ = conv_coll
        .update_one(
            doc! { "_id": conversation_oid },
            doc! {
                "$set": {
                    "lastMessagePreview": preview,
                    "lastMessageAt": now,
                    "updatedAt": now,
                }
            },
        )
        .await;

    Ok(Json(AppendMessageResponse {
        message: document_to_clean_json(doc),
    }))
}
