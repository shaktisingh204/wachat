use axum::{
    extract::{Path, Query, State},
    Json,
};
use bson::{doc, oid::ObjectId};
use chrono::Utc;
use futures::stream::StreamExt;
use mongodb::options::FindOptions;
use rand::Rng;
use serde_json::Value;

use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::document_to_clean_json;

use sabchat_types::{
    audit::{AuditAction, SabChatAuditEvent},
    content::ContentBlock,
    message::{MessageDirection, SabChatMessage, SenderType},
};

use crate::{
    dto::{
        EndCobrowseResponse, ListCobrowseQuery, ListCobrowseResponse, RequestCobrowseResponse,
    },
    state::SabChatCobrowseState,
};

#[tracing::instrument(skip(state, auth))]
pub async fn request_session(
    State(state): State<SabChatCobrowseState>,
    auth: AuthUser,
    Path(conversation_id): Path<String>,
) -> Result<Json<RequestCobrowseResponse>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::BadRequest("Invalid tenant_id".into()))?;
    let conv_id = ObjectId::parse_str(&conversation_id)
        .map_err(|_| ApiError::BadRequest("Invalid conversation_id".into()))?;
    let agent_id = ObjectId::parse_str(&auth.user_id)
        .map_err(|_| ApiError::BadRequest("Invalid user_id".into()))?;

    // Verify conversation belongs to tenant and extract contactId
    let conv_coll = state.mongo.db.collection::<bson::Document>("sabchat_conversations");
    let conv_doc = conv_coll
        .find_one(doc! { "_id": conv_id, "tenantId": tenant_id })
        .await
        .map_err(ApiError::Internal)?
        .ok_or_else(|| ApiError::NotFound("Conversation not found".into()))?;

    let contact_id = conv_doc
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("Missing contactId on conversation")))?;

    // Generate 32-byte (64 hex char) visitor token
    let mut rng = rand::thread_rng();
    let token_bytes: [u8; 32] = rng.gen();
    let visitor_token = hex::encode(token_bytes);

    let session_id = ObjectId::new();
    let now = Utc::now();

    let session_doc = doc! {
        "_id": session_id,
        "tenantId": tenant_id,
        "conversationId": conv_id,
        "contactId": contact_id,
        "visitorToken": &visitor_token,
        "agentId": agent_id,
        "status": "pending",
        "consentGranted": false,
        "maskPasswordFields": true,
        "createdAt": bson::DateTime::from_chrono(now),
    };

    let sessions_coll = state
        .mongo
        .db
        .collection::<bson::Document>("sabchat_cobrowse_sessions");
    sessions_coll
        .insert_one(session_doc)
        .await
        .map_err(ApiError::Internal)?;

    Ok(Json(RequestCobrowseResponse {
        session_id: session_id.to_hex(),
        visitor_token,
        status: "pending".into(),
    }))
}

#[tracing::instrument(skip(state, auth))]
pub async fn end_session(
    State(state): State<SabChatCobrowseState>,
    auth: AuthUser,
    Path(session_id): Path<String>,
) -> Result<Json<EndCobrowseResponse>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::BadRequest("Invalid tenant_id".into()))?;
    let sess_id = ObjectId::parse_str(&session_id)
        .map_err(|_| ApiError::BadRequest("Invalid session_id".into()))?;
    let agent_id = ObjectId::parse_str(&auth.user_id)
        .map_err(|_| ApiError::BadRequest("Invalid user_id".into()))?;

    let sessions_coll = state
        .mongo
        .db
        .collection::<bson::Document>("sabchat_cobrowse_sessions");
    
    let now = Utc::now();

    // End session
    let res = sessions_coll
        .find_one_and_update(
            doc! { "_id": sess_id, "tenantId": tenant_id },
            doc! { "$set": { "status": "ended", "endedAt": bson::DateTime::from_chrono(now) } }
        )
        .await
        .map_err(ApiError::Internal)?
        .ok_or_else(|| ApiError::NotFound("Session not found".into()))?;

    // Extract necessary info for the audit/system message
    let conv_id = res
        .get_object_id("conversationId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("Missing conversationId")))?;
    let contact_id = res
        .get_object_id("contactId")
        .unwrap_or(ObjectId::new()); // Fallback just in case

    // We need inbox_id for the message. Fetch it from the conversation.
    let conv_coll = state.mongo.db.collection::<bson::Document>("sabchat_conversations");
    let conv_doc = conv_coll
        .find_one(doc! { "_id": conv_id, "tenantId": tenant_id })
        .await
        .map_err(ApiError::Internal)?
        .ok_or_else(|| ApiError::NotFound("Conversation not found".into()))?;
    
    let inbox_id = conv_doc
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("Missing inboxId on conversation")))?;

    let msg_id = ObjectId::new();
    let message = SabChatMessage {
        id: msg_id,
        tenant_id,
        conversation_id: conv_id,
        inbox_id,
        contact_id,
        sender_type: SenderType::System,
        sender_id: None,
        direction: MessageDirection::Outbound,
        content: ContentBlock::System {
            text: "Co-browse session ended".to_string(),
        },
        attachments: vec![],
        provider_metadata: serde_json::json!({}),
        private: false,
        created_at: now,
    };

    let msgs_coll = state.mongo.db.collection::<bson::Document>("sabchat_messages");
    let msg_doc = bson::to_document(&message).map_err(ApiError::Internal)?;
    msgs_coll.insert_one(msg_doc).await.map_err(ApiError::Internal)?;

    // Audit event
    let event = SabChatAuditEvent {
        id: ObjectId::new(),
        tenant_id,
        conversation_id: Some(conv_id),
        contact_id: Some(contact_id),
        inbox_id: Some(inbox_id),
        action: AuditAction::MessageSent,
        actor_type: "agent".to_string(),
        actor_id: Some(agent_id),
        before: serde_json::json!({}),
        after: serde_json::json!({ "messageId": msg_id.to_hex() }),
        created_at: now,
    };

    let audit_coll = state.mongo.db.collection::<bson::Document>("sabchat_audit_log");
    let audit_doc = bson::to_document(&event).map_err(ApiError::Internal)?;
    audit_coll.insert_one(audit_doc).await.map_err(ApiError::Internal)?;

    Ok(Json(EndCobrowseResponse::ok()))
}

#[tracing::instrument(skip(state, auth))]
pub async fn list_sessions(
    State(state): State<SabChatCobrowseState>,
    auth: AuthUser,
    Query(query): Query<ListCobrowseQuery>,
) -> Result<Json<ListCobrowseResponse>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::BadRequest("Invalid tenant_id".into()))?;

    let mut filter = doc! { "tenantId": tenant_id };
    
    if let Some(cid_str) = query.conversation_id {
        let cid = ObjectId::parse_str(&cid_str)
            .map_err(|_| ApiError::BadRequest("Invalid conversation_id".into()))?;
        filter.insert("conversationId", cid);
    }

    let sessions_coll = state
        .mongo
        .db
        .collection::<bson::Document>("sabchat_cobrowse_sessions");
    
    let options = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();

    let mut cursor = sessions_coll
        .find(filter)
        .with_options(options)
        .await
        .map_err(ApiError::Internal)?;

    let mut items = Vec::new();
    while let Some(doc_res) = cursor.next().await {
        let doc = doc_res.map_err(ApiError::Internal)?;
        items.push(document_to_clean_json(doc));
    }

    Ok(Json(ListCobrowseResponse { items }))
}
