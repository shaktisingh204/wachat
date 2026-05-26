use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use bson::{doc, Document, oid::ObjectId};
use chrono::Utc;
use serde_json::Value;
use tracing::{error, info, warn};

use crate::state::TelegramBotApiState;

const BOTS: &str = "telegram_bots";
const DELIVERIES: &str = "telegram_webhook_deliveries";

pub async fn handle_webhook(
    State(s): State<TelegramBotApiState>,
    Path(bot_id): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<StatusCode, StatusCode> {
    let bot_oid = match ObjectId::parse_str(&bot_id) {
        Ok(oid) => oid,
        Err(_) => {
            warn!("Invalid bot_id format: {}", bot_id);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    // 1. Fetch bot to verify secret token
    let bot = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
    {
        Ok(Some(b)) => b,
        Ok(None) => {
            warn!("Bot not found: {}", bot_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            error!("Mongo error fetching bot {}: {}", bot_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let project_oid = match bot.get_object_id("projectId") {
        Ok(oid) => oid,
        Err(_) => {
            error!("Bot {} has no projectId", bot_id);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let expected_secret = bot.get_str("webhookSecret").unwrap_or("");
    
    // 2. Verify secret token if expected
    if !expected_secret.is_empty() {
        let provided_secret = headers
            .get("x-telegram-bot-api-secret-token")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("");
            
        if provided_secret != expected_secret {
            warn!("Secret token mismatch for bot {}", bot_id);
            return Err(StatusCode::UNAUTHORIZED);
        }
    }

    // 3. Extract event type and ID
    let update_id = payload.get("update_id").and_then(|v| v.as_i64()).unwrap_or(-1);
    
    let update_kinds = [
        "message", "edited_message", "channel_post", "edited_channel_post",
        "business_connection", "business_message", "edited_business_message",
        "deleted_business_messages", "message_reaction", "message_reaction_count",
        "inline_query", "chosen_inline_result", "callback_query", "shipping_query",
        "pre_checkout_query", "poll", "poll_answer", "my_chat_member",
        "chat_member", "chat_join_request", "chat_boost", "removed_chat_boost",
        "purchased_paid_media"
    ];
    
    let event_type = update_kinds
        .iter()
        .find(|&&k| payload.get(k).is_some())
        .copied()
        .unwrap_or("unknown");

    let event_obj = payload.get(event_type);
    
    let chat_id = event_obj
        .and_then(|v| v.get("chat"))
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_i64())
        .map(|id| id.to_string());
        
    let from_user_id = event_obj
        .and_then(|v| v.get("from"))
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_i64())
        .map(|id| id.to_string());

    let now = bson::DateTime::from_chrono(Utc::now());

    // 4. Log delivery to mongo
    let delivery_doc = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "updateId": update_id,
        "eventType": event_type,
        "chatId": chat_id.clone().unwrap_or_default(),
        "fromUserId": from_user_id.clone().unwrap_or_default(),
        "status": "received",
        "payload": bson::to_bson(&payload).unwrap_or(bson::Bson::Null),
        "receivedAt": now,
        "createdAt": now,
        "updatedAt": now,
    };

    if let Err(e) = s
        .mongo
        .collection::<Document>(DELIVERIES)
        .insert_one(delivery_doc)
        .await
    {
        error!("Failed to insert webhook delivery for bot {}: {}", bot_id, e);
    }
    
    info!("Processed Telegram webhook for bot {}, update_id: {}", bot_id, update_id);

    Ok(StatusCode::OK)
}
