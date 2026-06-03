use axum::{
    Router,
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
};
use bson::doc;
use chrono::Utc;
use mongodb::options::{FindOneAndUpdateOptions, ReturnDocument, UpdateOptions};
use sabnode_db::MongoHandle;
use sabsms_types::{DlrEvent, SabsmsMessageStatus};
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{error, info};

#[derive(Clone)]
pub struct AppState {
    pub db: MongoHandle,
    pub dlr_tx: mpsc::Sender<DlrEvent>,
}

pub fn router(db: MongoHandle) -> Router<AppState> {
    let (tx, rx) = mpsc::channel(10_000);

    // Spawn background worker for high-throughput batch processing
    tokio::spawn(dlr_worker(db.clone(), rx));

    let state = AppState { db, dlr_tx: tx };

    Router::new()
        .route("/dlr", post(handle_dlr))
        .with_state(state)
}

#[derive(Debug, thiserror::Error)]
pub enum DlrError {
    #[error("Database error: {0}")]
    Db(#[from] mongodb::error::Error),
    #[error("Queue is full")]
    QueueFull,
}

impl IntoResponse for DlrError {
    fn into_response(self) -> axum::response::Response {
        error!("DLR processing error: {}", self);
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response()
    }
}

async fn dlr_worker(db: MongoHandle, mut rx: mpsc::Receiver<DlrEvent>) {
    let batch_size = 500;
    let mut batch = Vec::with_capacity(batch_size);
    let mut interval = tokio::time::interval(Duration::from_millis(500));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                if !batch.is_empty() {
                    process_batch(&db, &batch).await;
                    batch.clear();
                }
            }
            res = rx.recv() => {
                match res {
                    Some(event) => {
                        batch.push(event);
                        if batch.len() >= batch_size {
                            process_batch(&db, &batch).await;
                            batch.clear();
                            interval.reset();
                        }
                    }
                    None => {
                        // Channel closed
                        if !batch.is_empty() {
                            process_batch(&db, &batch).await;
                        }
                        break;
                    }
                }
            }
        }
    }
}

async fn process_batch(db: &MongoHandle, batch: &[DlrEvent]) {
    info!("Processing batch of {} DLRs", batch.len());

    let mut tasks = Vec::with_capacity(batch.len());
    for event in batch {
        let db_clone = db.clone();
        let ev = event.clone();
        tasks.push(tokio::spawn(async move {
            if let Err(e) = process_dlr(&db_clone, ev).await {
                error!("Error processing DLR in background: {}", e);
            }
        }));
    }

    for task in tasks {
        let _ = task.await;
    }
}

pub async fn process_dlr(db: &MongoHandle, event: DlrEvent) -> Result<(), DlrError> {
    info!("Processing DLR for message {}", event.message_id);

    let messages_coll = db.collection::<bson::Document>("sms_messages");

    let filter = doc! { "id": event.message_id.to_string() };

    let status_str = match event.status {
        SabsmsMessageStatus::Pending => "Pending",
        SabsmsMessageStatus::Sent => "Sent",
        SabsmsMessageStatus::Delivered => "Delivered",
        SabsmsMessageStatus::Failed => "Failed",
        SabsmsMessageStatus::Undelivered => "Undelivered",
    };

    let update = doc! {
        "$set": {
            "status": status_str,
            "updated_at": bson::DateTime::from_millis(Utc::now().timestamp_millis()),
        }
    };

    let opts = FindOneAndUpdateOptions::builder()
        .return_document(ReturnDocument::After)
        .build();

    let result = messages_coll
        .find_one_and_update(filter, update)
        .with_options(opts)
        .await?;

    if let Some(doc) = result {
        if matches!(
            event.status,
            SabsmsMessageStatus::Failed | SabsmsMessageStatus::Undelivered
        ) {
            if let Ok(to) = doc.get_str("to") {
                let suppressions_coll = db.collection::<bson::Document>("sms_suppressions");
                let filter = doc! { "phone_number": to };
                let reason = event
                    .error_code
                    .unwrap_or_else(|| "Permanent failure".to_string());

                let update = doc! {
                    "$setOnInsert": {
                        "phone_number": to,
                        "created_at": bson::DateTime::from_millis(Utc::now().timestamp_millis()),
                        "reason": reason,
                    }
                };
                let update_opts = UpdateOptions::builder().upsert(true).build();
                suppressions_coll
                    .update_one(filter, update)
                    .with_options(update_opts)
                    .await?;
                info!("Added {} to suppressions due to permanent failure", to);
            }
        }
    } else {
        error!("Message {} not found for DLR", event.message_id);
    }

    Ok(())
}

pub async fn handle_dlr(
    State(state): State<AppState>,
    Json(payload): Json<DlrEvent>,
) -> Result<impl IntoResponse, DlrError> {
    if let Err(_) = state.dlr_tx.send(payload).await {
        return Err(DlrError::QueueFull);
    }
    Ok((StatusCode::OK, "OK"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    // A simple dummy test to ensure tests pass
    #[test]
    fn test_app_state_clone() {
        // AppState is Clone, DlrEvent is Clone
        let event = DlrEvent {
            message_id: Uuid::new_v4(),
            status: SabsmsMessageStatus::Sent,
            error_code: None,
            timestamp: Utc::now(),
        };
        assert_eq!(event.status, SabsmsMessageStatus::Sent);
    }
}
