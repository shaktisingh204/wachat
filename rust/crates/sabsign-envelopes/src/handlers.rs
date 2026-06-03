use crate::mock_db::AppState;
use crate::models::{
    Document, Envelope, EnvelopeStatus, ExpireSettings, Recipient, ReminderSettings, RoutingOrder,
    SignaturePlacement,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct CreateEnvelopeReq {
    pub title: String,
    pub sender_id: Uuid,
}

pub async fn create_envelope(
    State(state): State<AppState>,
    Json(payload): Json<CreateEnvelopeReq>,
) -> (StatusCode, Json<Envelope>) {
    let envelope = Envelope {
        id: Uuid::new_v4(),
        title: payload.title,
        status: EnvelopeStatus::Draft,
        sender_id: payload.sender_id,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        sent_at: None,
        voided_at: None,
        void_reason: None,
        documents: vec![],
        recipients: vec![],
        routing_order: None,
        reminder_settings: None,
        expire_settings: None,
        custom_fields: vec![],
    };
    state.insert_envelope(envelope.clone()).await;
    (StatusCode::CREATED, Json(envelope))
}

pub async fn get_envelope(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Envelope>, StatusCode> {
    state
        .get_envelope(&id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_envelopes(State(state): State<AppState>) -> Json<Vec<Envelope>> {
    Json(state.list_envelopes().await)
}

#[derive(Deserialize)]
pub struct StatusQuery {
    pub status: Option<String>,
}

pub async fn filter_envelopes(
    State(state): State<AppState>,
    Query(query): Query<StatusQuery>,
) -> Json<Vec<Envelope>> {
    let all = state.list_envelopes().await;
    if let Some(s) = query.status {
        let status = match s.as_str() {
            "Draft" => EnvelopeStatus::Draft,
            "Sent" => EnvelopeStatus::Sent,
            "Delivered" => EnvelopeStatus::Delivered,
            "Completed" => EnvelopeStatus::Completed,
            "Declined" => EnvelopeStatus::Declined,
            "Voided" => EnvelopeStatus::Voided,
            _ => return Json(all),
        };
        Json(all.into_iter().filter(|e| e.status == status).collect())
    } else {
        Json(all)
    }
}

pub async fn delete_envelope(State(state): State<AppState>, Path(id): Path<Uuid>) -> StatusCode {
    if state.delete_envelope(&id).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

#[derive(Deserialize)]
pub struct AddDocumentReq {
    pub name: String,
    pub file_extension: String,
    pub size_bytes: u64,
    pub pages: u32,
    pub document_base64: Option<String>,
    pub order: i32,
}

pub async fn add_document(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
    Json(payload): Json<AddDocumentReq>,
) -> Result<Json<Envelope>, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let doc = Document {
        id: Uuid::new_v4(),
        envelope_id,
        name: payload.name,
        file_extension: payload.file_extension,
        size_bytes: payload.size_bytes,
        pages: payload.pages,
        document_base64: payload.document_base64,
        order: payload.order,
    };

    env.documents.push(doc);
    env.updated_at = Utc::now();
    state.update_envelope(&envelope_id, env.clone()).await;
    Ok(Json(env))
}

pub async fn list_documents(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
) -> Result<Json<Vec<Document>>, StatusCode> {
    let env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(env.documents))
}

pub async fn get_document(
    State(state): State<AppState>,
    Path((envelope_id, doc_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Document>, StatusCode> {
    let env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    env.documents
        .into_iter()
        .find(|d| d.id == doc_id)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete_document(
    State(state): State<AppState>,
    Path((envelope_id, doc_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    let initial_len = env.documents.len();
    env.documents.retain(|d| d.id != doc_id);
    if env.documents.len() < initial_len {
        env.updated_at = Utc::now();
        state.update_envelope(&envelope_id, env).await;
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn add_recipient(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
    Json(mut recipient): Json<Recipient>,
) -> Result<Json<Envelope>, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    recipient.id = Uuid::new_v4();
    recipient.envelope_id = envelope_id;
    env.recipients.push(recipient);
    env.updated_at = Utc::now();
    state.update_envelope(&envelope_id, env.clone()).await;
    Ok(Json(env))
}

pub async fn list_recipients(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
) -> Result<Json<Vec<Recipient>>, StatusCode> {
    let env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(env.recipients))
}

pub async fn delete_recipient(
    State(state): State<AppState>,
    Path((envelope_id, rec_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    let initial_len = env.recipients.len();
    env.recipients.retain(|r| r.id != rec_id);
    if env.recipients.len() < initial_len {
        env.updated_at = Utc::now();
        state.update_envelope(&envelope_id, env).await;
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn add_signature_placement(
    State(state): State<AppState>,
    Path((envelope_id, rec_id)): Path<(Uuid, Uuid)>,
    Json(mut placement): Json<SignaturePlacement>,
) -> Result<Json<Envelope>, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    if let Some(rec) = env.recipients.iter_mut().find(|r| r.id == rec_id) {
        placement.id = Uuid::new_v4();
        rec.signature_placements.push(placement);
        env.updated_at = Utc::now();
        state.update_envelope(&envelope_id, env.clone()).await;
        Ok(Json(env))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn send_envelope(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
) -> Result<Json<Envelope>, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    if env.status != EnvelopeStatus::Draft {
        return Err(StatusCode::BAD_REQUEST);
    }

    env.status = EnvelopeStatus::Sent;
    env.sent_at = Some(Utc::now());
    env.updated_at = Utc::now();

    // Sort recipients by routing order
    env.recipients.sort_by_key(|r| r.routing_order);

    // Initialize routing
    if let Some(first_rec) = env.recipients.first() {
        env.routing_order = Some(RoutingOrder {
            current_order: first_rec.routing_order,
            current_recipient_id: Some(first_rec.id),
            is_sequential: true,
        });
    }

    state.update_envelope(&envelope_id, env.clone()).await;
    Ok(Json(env))
}

#[derive(Deserialize)]
pub struct VoidReq {
    pub reason: String,
}

pub async fn void_envelope(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
    Json(payload): Json<VoidReq>,
) -> Result<Json<Envelope>, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    if env.status == EnvelopeStatus::Completed || env.status == EnvelopeStatus::Voided {
        return Err(StatusCode::BAD_REQUEST);
    }

    env.status = EnvelopeStatus::Voided;
    env.voided_at = Some(Utc::now());
    env.void_reason = Some(payload.reason);
    env.updated_at = Utc::now();

    state.update_envelope(&envelope_id, env.clone()).await;
    Ok(Json(env))
}

pub async fn calculate_routing(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
) -> Result<Json<RoutingOrder>, StatusCode> {
    let env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    if let Some(ro) = env.routing_order {
        Ok(Json(ro))
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}

pub async fn advance_routing(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
) -> Result<Json<Envelope>, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    if env.status != EnvelopeStatus::Sent && env.status != EnvelopeStatus::Delivered {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(mut ro) = env.routing_order {
        let current_order = ro.current_order;
        // find next recipient
        let next_rec = env
            .recipients
            .iter()
            .find(|r| r.routing_order > current_order);
        if let Some(next) = next_rec {
            ro.current_order = next.routing_order;
            ro.current_recipient_id = Some(next.id);
            env.routing_order = Some(ro);
            env.updated_at = Utc::now();
            state.update_envelope(&envelope_id, env.clone()).await;
            Ok(Json(env))
        } else {
            // Completed
            env.status = EnvelopeStatus::Completed;
            env.routing_order = None;
            env.updated_at = Utc::now();
            state.update_envelope(&envelope_id, env.clone()).await;
            Ok(Json(env))
        }
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}

pub async fn dispatch_reminders(State(state): State<AppState>) -> Json<usize> {
    let mut count = 0;
    let all = state.list_envelopes().await;
    for mut env in all {
        if env.status == EnvelopeStatus::Sent || env.status == EnvelopeStatus::Delivered {
            if let Some(settings) = &env.reminder_settings {
                if settings.reminder_enabled {
                    // Logic to send reminder...
                    count += 1;
                    env.updated_at = Utc::now();
                    let id = env.id;
                    state.update_envelope(&id, env).await;
                }
            }
        }
    }
    Json(count)
}

pub async fn set_reminder_settings(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
    Json(settings): Json<ReminderSettings>,
) -> Result<Json<Envelope>, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    env.reminder_settings = Some(settings);
    env.updated_at = Utc::now();
    state.update_envelope(&envelope_id, env.clone()).await;
    Ok(Json(env))
}

pub async fn set_expire_settings(
    State(state): State<AppState>,
    Path(envelope_id): Path<Uuid>,
    Json(settings): Json<ExpireSettings>,
) -> Result<Json<Envelope>, StatusCode> {
    let mut env = state
        .get_envelope(&envelope_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    env.expire_settings = Some(settings);
    env.updated_at = Utc::now();
    state.update_envelope(&envelope_id, env.clone()).await;
    Ok(Json(env))
}

pub async fn get_envelope_audit_trail(
    State(_state): State<AppState>,
    Path(_envelope_id): Path<Uuid>,
) -> Json<Vec<String>> {
    // Mocking audit trail
    Json(vec![
        "Envelope Created".into(),
        "Document Added".into(),
        "Recipient Added".into(),
        "Envelope Sent".into(),
    ])
}
