use axum::{
    extract::{Form, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Router,
};
use bson::{doc, DateTime as BsonDateTime};
use chrono::Utc;
use mongodb::{options::UpdateOptions, Client as MongoClient};
use redis::AsyncCommands;
use sabsms_providers::twilio::verify_twilio_signature;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tracing::{error, info};


#[derive(Clone)]
pub struct AppState {
    pub mongo_client: MongoClient,
    pub redis_client: redis::Client,
    pub twilio_auth_token: String,
    pub webhook_url: String, // The public URL configured in Twilio
}

#[derive(Debug, Deserialize)]
pub struct TwilioInboundSms {
    #[serde(rename = "MessageSid")]
    pub message_sid: String,
    #[serde(rename = "From")]
    pub from: String,
    #[serde(rename = "To")]
    pub to: String,
    #[serde(rename = "Body")]
    pub body: String,
    #[serde(rename = "AccountSid")]
    pub account_sid: String,
}

#[derive(Debug, Serialize)]
pub struct MessageReceivedEvent {
    pub event: String,
    pub message_sid: String,
    pub from: String,
    pub to: String,
    pub body: String,
    pub received_at: chrono::DateTime<Utc>,
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/inbound", post(handle_inbound_sms))
        .with_state(state)
}

async fn handle_inbound_sms(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(payload): Form<BTreeMap<String, String>>,
) -> impl IntoResponse {
    // 1. Signature Verification
    let signature = match headers.get("x-twilio-signature") {
        Some(sig) => sig.to_str().unwrap_or(""),
        None => {
            error!("Missing Twilio signature");
            return StatusCode::UNAUTHORIZED;
        }
    };

    // Convert payload to BTreeMap<&str, &str> for verification
    let mut post_params: BTreeMap<&str, &str> = BTreeMap::new();
    for (k, v) in &payload {
        post_params.insert(k.as_str(), v.as_str());
    }

    if !verify_twilio_signature(
        &state.twilio_auth_token,
        signature,
        &state.webhook_url,
        &post_params,
    ) {
        error!("Invalid Twilio signature");
        return StatusCode::UNAUTHORIZED;
    }

    // 2. Extract Data
    let from = payload.get("From").cloned().unwrap_or_default();
    let to = payload.get("To").cloned().unwrap_or_default();
    let body = payload.get("Body").cloned().unwrap_or_default();
    let message_sid = payload.get("MessageSid").cloned().unwrap_or_default();

    if from.is_empty() || message_sid.is_empty() {
        error!("Missing required fields in Twilio payload");
        return StatusCode::BAD_REQUEST;
    }

    // 3. `sabsms_conversations` upserts
    let db = state.mongo_client.database("sabsms");
    let conversations = db.collection::<bson::Document>("sabsms_conversations");

    let now = Utc::now();
    let bson_now = BsonDateTime::from_chrono(now);

    let filter = doc! { "contact_number": &from, "twilio_number": &to };
    let update = doc! {
        "$set": {
            "last_message": &body,
            "last_message_sid": &message_sid,
            "updated_at": bson_now,
        },
        "$setOnInsert": {
            "created_at": bson_now,
        }
    };
    let options = UpdateOptions::builder().upsert(true).build();

    if let Err(e) = conversations.update_one(filter, update).with_options(options).await {
        error!("Failed to upsert conversation: {}", e);
        return StatusCode::INTERNAL_SERVER_ERROR;
    }

    info!("Upserted conversation for contact: {}", from);

    // 4. Trigger `sabsms.message.received` event
    let event = MessageReceivedEvent {
        event: "sabsms.message.received".to_string(),
        message_sid,
        from: from.clone(),
        to: to.clone(),
        body: body.clone(),
        received_at: now,
    };

    let mut redis_conn = match state.redis_client.get_multiplexed_async_connection().await {
        Ok(conn) => conn,
        Err(e) => {
            error!("Failed to get redis connection: {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    };

    let payload_str = match serde_json::to_string(&event) {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to serialize event: {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    };

    if let Err(e) = redis_conn
        .publish::<_, _, ()>("sabsms.message.received", payload_str)
        .await
    {
        error!("Failed to publish event to redis: {}", e);
        return StatusCode::INTERNAL_SERVER_ERROR;
    }

    info!("Published sabsms.message.received event for contact: {}", from);

    StatusCode::OK
}
