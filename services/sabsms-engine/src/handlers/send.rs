use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId};

use crate::{
    compliance, db,
    errors::{EngineError, EngineResult},
    events::{self, EngineEvent},
    providers,
    queue,
    state::AppState,
    types::{
        Channel, Direction, EnqueueSendInput, EnqueueSendResult, MessageDoc, MessageStatus,
        ProviderId,
    },
};

fn normalise_e164(raw: &str) -> EngineResult<String> {
    use phonenumber::country;
    let parsed = phonenumber::parse(Some(country::Id::US), raw)
        .map_err(|e| EngineError::BadRequest(format!("invalid phone: {e}")))?;
    if !phonenumber::is_valid(&parsed) {
        return Err(EngineError::BadRequest("invalid phone".into()));
    }
    Ok(parsed.format().mode(phonenumber::Mode::E164).to_string())
}

pub async fn enqueue(
    State(state): State<Arc<AppState>>,
    Json(input): Json<EnqueueSendInput>,
) -> EngineResult<Json<EnqueueSendResult>> {
    if input.workspace_id.is_empty() || input.body.is_empty() {
        return Err(EngineError::BadRequest("workspaceId + body required".into()));
    }

    let to = normalise_e164(&input.to)?;

    // Cheap synchronous suppression check only — the full compliance
    // kernel (quiet hours, consent, 10DLC) runs in the worker.
    if compliance::is_suppressed(&state, &input.workspace_id, &to).await? {
        tracing::info!(workspace = %input.workspace_id, "send blocked: recipient suppressed");
        return Ok(Json(EnqueueSendResult {
            id: String::new(),
            status: MessageStatus::Suppressed,
            segments: None,
            estimated_cost: None,
        }));
    }

    let provider = input.provider.unwrap_or(ProviderId::Twilio);
    let channel = input.channel.unwrap_or(Channel::Sms);
    let segments = providers::estimate_segments(&input.body);

    let now = Utc::now();
    let doc_value = MessageDoc {
        workspace_id: input.workspace_id.clone(),
        idempotency_key: input.idempotency_key.clone(),
        direction: Direction::Outbound,
        channel,
        from: input.from.clone().unwrap_or_default(),
        to: to.clone(),
        body: input.body.clone(),
        media: input.media.clone(),
        category: input.category,
        status: MessageStatus::Queued,
        error_code: None,
        error_message: None,
        provider,
        provider_account_id: input.provider_account_id.clone(),
        provider_message_id: None,
        template_id: input.template_id.clone(),
        campaign_id: input.campaign_id.clone(),
        contact_id: input.contact_id.clone(),
        event_key: input.event_key.clone(),
        segments_count: Some(segments),
        price: None,
        cost: None,
        tags: input.tags.clone(),
        queued_at: now,
        sent_at: None,
        delivered_at: None,
        failed_at: None,
        created_at: now,
        updated_at: now,
    };

    let bson = mongodb::bson::to_document(&doc_value)
        .map_err(|e| EngineError::Internal(anyhow::anyhow!(e)))?;
    let messages = state.mongo.collection::<mongodb::bson::Document>(db::COL_MESSAGES);
    let insert = messages.insert_one(bson).await?;
    let id = insert
        .inserted_id
        .as_object_id()
        .map(|oid: ObjectId| oid.to_hex())
        .unwrap_or_default();

    // Enqueue for the worker.
    let mut redis = state.redis.clone();
    queue::enqueue_send(&mut redis, &id).await?;

    // Event-stream bridge — best-effort, never fails the request.
    events::emit(
        &mut redis,
        &EngineEvent::MessageQueued {
            workspace_id: input.workspace_id.clone(),
            message_id: id.clone(),
        },
    )
    .await;

    Ok(Json(EnqueueSendResult {
        id,
        status: MessageStatus::Queued,
        segments: Some(segments),
        // Cost estimation lives in Phase 7 (pricing tables); phase-1
        // returns None so the customer is charged actual cost.
        estimated_cost: None,
    }))
}

pub async fn get_one(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> EngineResult<Json<serde_json::Value>> {
    let oid =
        ObjectId::parse_str(&id).map_err(|_| EngineError::BadRequest("invalid id".into()))?;
    let messages = state.mongo.collection::<mongodb::bson::Document>(db::COL_MESSAGES);
    let found = messages
        .find_one(doc! { "_id": oid })
        .await?
        .ok_or(EngineError::NotFound)?;
    let value = mongodb::bson::Bson::Document(found).into_relaxed_extjson();
    Ok(Json(value))
}
