use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Router,
};
use bson::doc;
use chrono::Utc;
use mongodb::options::{FindOneAndUpdateOptions, ReturnDocument, UpdateOptions};
use sabnode_db::MongoHandle;
use sabsms_types::{DlrEvent, SabsmsMessageStatus};
use tracing::{error, info};

#[derive(Clone)]
pub struct AppState {
    pub db: MongoHandle,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/dlr", post(handle_dlr))
}

#[derive(Debug, thiserror::Error)]
pub enum DlrError {
    #[error("Database error: {0}")]
    Db(#[from] mongodb::error::Error),
}

impl IntoResponse for DlrError {
    fn into_response(self) -> axum::response::Response {
        error!("DLR processing error: {}", self);
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response()
    }
}

pub async fn process_dlr(db: &MongoHandle, event: DlrEvent) -> Result<(), DlrError> {
    info!("Processing DLR for message {}", event.message_id);

    let messages_coll = db.collection::<bson::Document>("sms_messages");

    let filter = doc! { "id": event.message_id.to_string() };
    
    // Status string matching what we might expect, e.g., "Failed"
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

    let result = messages_coll.find_one_and_update(filter, update).with_options(opts).await?;

    if let Some(doc) = result {
        if matches!(event.status, SabsmsMessageStatus::Failed | SabsmsMessageStatus::Undelivered) {
            if let Ok(to) = doc.get_str("to") {
                let suppressions_coll = db.collection::<bson::Document>("sms_suppressions");
                let filter = doc! { "phone_number": to };
                let reason = event.error_code.unwrap_or_else(|| "Permanent failure".to_string());
                
                let update = doc! {
                    "$setOnInsert": {
                        "phone_number": to,
                        "created_at": bson::DateTime::from_millis(Utc::now().timestamp_millis()),
                        "reason": reason,
                    }
                };
                let update_opts = UpdateOptions::builder().upsert(true).build();
                suppressions_coll.update_one(filter, update).with_options(update_opts).await?;
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
    process_dlr(&state.db, payload).await?;
    Ok((StatusCode::OK, "OK"))
}
