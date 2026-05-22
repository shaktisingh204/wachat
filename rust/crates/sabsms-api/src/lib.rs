use axum::{
    extract::{Json, Path},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sabsms_types::{SabsmsMessage, SabsmsMessageStatus, SendRequest};
use uuid::Uuid;
use chrono::Utc;

pub fn router() -> Router {
    Router::new()
        .route("/v1/messages", post(send_message))
        .route("/v1/messages/:id", get(get_message))
        .route("/v1/campaigns", get(list_campaigns).post(create_campaign))
}

async fn send_message(
    Json(payload): Json<SendRequest>,
) -> impl IntoResponse {
    let msg = SabsmsMessage {
        id: Uuid::new_v4(),
        to: payload.to,
        from: payload.from,
        body: payload.body,
        status: SabsmsMessageStatus::Pending,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    (StatusCode::CREATED, Json(msg))
}

async fn get_message(
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let msg = SabsmsMessage {
        id,
        to: "+1234567890".to_string(),
        from: "SABNODE".to_string(),
        body: "Mock message".to_string(),
        status: SabsmsMessageStatus::Sent,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    (StatusCode::OK, Json(msg))
}

#[derive(Serialize, Deserialize)]
pub struct Campaign {
    pub id: Uuid,
    pub name: String,
    pub status: String,
}

#[derive(Deserialize)]
pub struct CreateCampaignRequest {
    pub name: String,
}

async fn list_campaigns() -> impl IntoResponse {
    let campaigns: Vec<Campaign> = vec![];
    (StatusCode::OK, Json(campaigns))
}

async fn create_campaign(
    Json(payload): Json<CreateCampaignRequest>,
) -> impl IntoResponse {
    let campaign = Campaign {
        id: Uuid::new_v4(),
        name: payload.name,
        status: "Draft".to_string(),
    };
    (StatusCode::CREATED, Json(campaign))
}
