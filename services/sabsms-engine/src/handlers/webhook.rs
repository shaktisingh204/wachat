use std::{collections::HashMap, sync::Arc};

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use chrono::Utc;
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::{
    db,
    errors::{EngineError, EngineResult},
    providers::{self, twilio::TwilioProvider, SmsProvider},
    state::AppState,
    types::{Channel, Direction, MessageStatus, ProviderId},
};

/// Public POST endpoint that carriers invoke.
///
/// Phase-1 supports Twilio only; other providers route 501.
pub async fn handle(
    State(state): State<Arc<AppState>>,
    Path((provider, direction)): Path<(String, String)>,
    headers: HeaderMap,
    body: Bytes,
) -> EngineResult<Json<Value>> {
    if provider != "twilio" {
        return Err(EngineError::BadRequest(format!(
            "provider '{provider}' not yet supported in phase 1"
        )));
    }

    let header_map: HashMap<String, String> = headers
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|s| (k.as_str().to_string(), s.to_string())))
        .collect();

    // For signature verification we need the public URL — Next forwards
    // the original under X-Forwarded-Url, else fall back to a stub. In
    // dev we accept either.
    let url = header_map
        .get("x-forwarded-url")
        .cloned()
        .unwrap_or_else(|| format!("{}/webhook/twilio/{direction}", state.cfg.app_callback_url));

    // Phase-1 lookup: the engine doesn't yet have a "default Twilio
    // creds per workspace" lookup wired in (that's Phase-1 + half of
    // Phase-7). For the smoke path we read creds from env so the admin
    // debug page works end-to-end with a single Twilio account.
    let creds = providers::ProviderCreds {
        blob: serde_json::json!({
            "accountSid": std::env::var("SABSMS_TWILIO_ACCOUNT_SID").unwrap_or_default(),
            "authToken":  std::env::var("SABSMS_TWILIO_AUTH_TOKEN").unwrap_or_default(),
        }),
    };

    let twilio = TwilioProvider::new(state.http.clone());

    let signature_ok = twilio.verify_webhook_signature(&url, &body, &header_map, &creds);
    if !signature_ok
        && std::env::var("SABSMS_ALLOW_UNSIGNED_WEBHOOKS").unwrap_or_default() != "true"
    {
        return Err(EngineError::Unauthorized);
    }

    match direction.as_str() {
        "inbound" => handle_inbound(&state, &twilio, &body).await,
        "dlr" => handle_dlr(&state, &twilio, &body).await,
        _ => Err(EngineError::NotFound),
    }
}

async fn handle_inbound(
    state: &Arc<AppState>,
    twilio: &TwilioProvider,
    body: &[u8],
) -> EngineResult<Json<Value>> {
    let parsed = twilio
        .parse_inbound(body)
        .map_err(|e| EngineError::Provider(e.to_string()))?;

    let messages = state.mongo.collection::<mongodb::bson::Document>(db::COL_MESSAGES);
    let now = Utc::now();
    let doc = doc! {
        "workspaceId": std::env::var("SABSMS_DEFAULT_WORKSPACE").unwrap_or_else(|_| "default".into()),
        "direction": Direction::Inbound.serialize_as_str(),
        "channel": Channel::Sms.serialize_as_str(),
        "from": &parsed.from,
        "to": &parsed.to,
        "body": &parsed.body,
        "status": MessageStatus::Delivered.as_str(),
        "provider": ProviderId::Twilio.as_str(),
        "providerMessageId": &parsed.provider_message_id,
        "createdAt": mongodb::bson::DateTime::from_millis(now.timestamp_millis()),
        "updatedAt": mongodb::bson::DateTime::from_millis(now.timestamp_millis()),
    };
    // Idempotent on providerMessageId via the unique partial index.
    let _ = messages.insert_one(doc).await;
    Ok(Json(json!({ "ok": true, "kind": "inbound" })))
}

async fn handle_dlr(
    state: &Arc<AppState>,
    twilio: &TwilioProvider,
    body: &[u8],
) -> EngineResult<Json<Value>> {
    let evt = twilio
        .parse_dlr(body)
        .map_err(|e| EngineError::Provider(e.to_string()))?;

    let messages = state.mongo.collection::<mongodb::bson::Document>(db::COL_MESSAGES);
    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    let mut set = doc! {
        "status": evt.status.as_str(),
        "updatedAt": now,
    };
    if matches!(evt.status, MessageStatus::Delivered) {
        set.insert("deliveredAt", now);
    } else if matches!(evt.status, MessageStatus::Failed | MessageStatus::Undelivered) {
        set.insert("failedAt", now);
    }
    if let Some(code) = evt.error_code {
        set.insert("errorCode", code);
    }
    if let Some(msg) = evt.error_message {
        set.insert("errorMessage", msg);
    }
    messages
        .update_one(
            doc! { "provider": ProviderId::Twilio.as_str(), "providerMessageId": &evt.provider_message_id },
            doc! { "$set": set },
        )
        .await?;
    Ok(Json(json!({ "ok": true, "kind": "dlr" })))
}

// Small helpers so we can write the enum to BSON as a plain string
// without falling through serde's tagged Enum representation.
impl Direction {
    fn serialize_as_str(self) -> &'static str {
        match self {
            Direction::Outbound => "outbound",
            Direction::Inbound => "inbound",
        }
    }
}
impl Channel {
    fn serialize_as_str(self) -> &'static str {
        match self {
            Channel::Sms => "sms",
            Channel::Mms => "mms",
            Channel::Rcs => "rcs",
        }
    }
}
