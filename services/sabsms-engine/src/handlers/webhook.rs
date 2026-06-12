use std::{collections::HashMap, sync::Arc};

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use chrono::Utc;
use mongodb::bson::{doc, Document};
use mongodb::options::ReturnDocument;
use serde_json::{json, Value};

use crate::{
    creds, db,
    errors::{EngineError, EngineResult},
    events::{self, EngineEvent},
    keywords,
    providers::{self, ProviderCreds, SmsProvider},
    state::AppState,
    types::{Channel, Direction, MessageStatus, ProviderId},
};

fn unsigned_webhooks_allowed() -> bool {
    std::env::var("SABSMS_ALLOW_UNSIGNED_WEBHOOKS").unwrap_or_default() == "true"
}

fn mock_mode() -> bool {
    std::env::var("SABSMS_PROVIDER_MOCK").unwrap_or_default() == "true"
}

/// Public POST endpoint that carriers invoke.
///
/// Twilio-only for now (multi-provider lands in a later phase); the mock
/// path is accepted when `SABSMS_PROVIDER_MOCK=true`.
pub async fn handle(
    State(state): State<Arc<AppState>>,
    Path((provider, direction)): Path<(String, String)>,
    headers: HeaderMap,
    body: Bytes,
) -> EngineResult<Json<Value>> {
    let provider_id = match provider.as_str() {
        "twilio" => ProviderId::Twilio,
        "mock" if mock_mode() => ProviderId::Mock,
        other => {
            return Err(EngineError::BadRequest(format!(
                "provider '{other}' not supported on webhooks yet"
            )))
        }
    };

    let adapter = providers::adapter_for(provider_id, state.http.clone())
        .ok_or_else(|| EngineError::BadRequest("provider has no adapter".into()))?;

    let header_map: HashMap<String, String> = headers
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|s| (k.as_str().to_string(), s.to_string())))
        .collect();

    // For signature verification we need the public URL — Next forwards
    // the original under X-Forwarded-Url, else fall back to a stub. In
    // dev we accept either.
    let url = header_map.get("x-forwarded-url").cloned().unwrap_or_else(|| {
        format!(
            "{}/webhook/{}/{direction}",
            state.cfg.app_callback_url,
            provider_id.as_str()
        )
    });

    match direction.as_str() {
        "inbound" => {
            handle_inbound(&state, provider_id, adapter.as_ref(), &url, &header_map, &body).await
        }
        "dlr" => handle_dlr(&state, provider_id, adapter.as_ref(), &url, &header_map, &body).await,
        _ => Err(EngineError::NotFound),
    }
}

/// Resolve creds + verify the provider signature. Bypassed entirely when
/// `SABSMS_ALLOW_UNSIGNED_WEBHOOKS=true` (dev). The mock provider checks
/// its own header and never needs stored creds.
#[allow(clippy::too_many_arguments)]
async fn verify_signature(
    state: &Arc<AppState>,
    provider_id: ProviderId,
    adapter: &dyn SmsProvider,
    url: &str,
    headers: &HashMap<String, String>,
    body: &[u8],
    workspace_id: &str,
    provider_account_id: Option<&str>,
) -> EngineResult<()> {
    if unsigned_webhooks_allowed() {
        return Ok(());
    }
    let empty_creds = ProviderCreds {
        blob: serde_json::json!({}),
    };
    let resolved;
    let provider_creds = if provider_id == ProviderId::Mock {
        &empty_creds
    } else {
        resolved = creds::resolve(state, workspace_id, provider_id, provider_account_id)
            .await
            .map_err(|e| {
                tracing::warn!(?e, workspace = %workspace_id, "webhook creds resolution failed");
                EngineError::Unauthorized
            })?;
        &resolved.creds
    };
    if !adapter.verify_webhook_signature(url, body, headers, provider_creds) {
        return Err(EngineError::Unauthorized);
    }
    Ok(())
}

/// E.164 lookup candidates: exact, plus normalized variants with and
/// without a leading "+".
fn e164_variants(raw: &str) -> Vec<String> {
    let mut out = vec![raw.to_string()];
    if let Some(stripped) = raw.strip_prefix('+') {
        out.push(stripped.to_string());
    } else {
        out.push(format!("+{raw}"));
    }
    out
}

async fn handle_inbound(
    state: &Arc<AppState>,
    provider_id: ProviderId,
    adapter: &dyn SmsProvider,
    url: &str,
    headers: &HashMap<String, String>,
    body: &[u8],
) -> EngineResult<Json<Value>> {
    // 1. Parse first — parsing never needs creds.
    let parsed = adapter
        .parse_inbound(body)
        .map_err(|e| EngineError::Provider(e.to_string()))?;

    // 2. Resolve the workspace from the destination number.
    let numbers = state.mongo.collection::<Document>(db::COL_NUMBERS);
    let number_doc = numbers
        .find_one(doc! { "e164": { "$in": e164_variants(&parsed.to) } })
        .await?;
    let number_doc = match number_doc {
        Some(d) => d,
        None => {
            tracing::warn!(to = %parsed.to, provider = provider_id.as_str(), "inbound webhook for unknown destination number");
            return Err(EngineError::BadRequest("unknown destination number".into()));
        }
    };
    let workspace_id = number_doc.get_str("workspaceId").unwrap_or("").to_string();
    if workspace_id.is_empty() {
        return Err(EngineError::BadRequest("unknown destination number".into()));
    }
    let provider_account_id = number_doc
        .get_str("providerAccountId")
        .ok()
        .map(|s| s.to_string());

    // 3. Verify the signature with the workspace's creds.
    verify_signature(
        state,
        provider_id,
        adapter,
        url,
        headers,
        body,
        &workspace_id,
        provider_account_id.as_deref(),
    )
    .await?;

    let now = Utc::now();
    let now_bson = mongodb::bson::DateTime::from_millis(now.timestamp_millis());

    // 4. Upsert the conversation thread for this peer.
    let preview: String = parsed.body.chars().take(160).collect();
    let conversations = state.mongo.collection::<Document>(db::COL_CONVERSATIONS);
    let convo = conversations
        .find_one_and_update(
            doc! {
                "workspaceId": &workspace_id,
                "phone": &parsed.from,
                "channel": Channel::Sms.serialize_as_str(),
            },
            doc! {
                "$set": {
                    "lastMessagePreview": &preview,
                    "lastMessageAt": now_bson,
                    "updatedAt": now_bson,
                },
                "$inc": { "unreadCount": 1 },
                "$setOnInsert": {
                    "workspaceId": &workspace_id,
                    "phone": &parsed.from,
                    "channel": Channel::Sms.serialize_as_str(),
                    "status": "open",
                    "createdAt": now_bson,
                },
            },
        )
        .upsert(true)
        .return_document(ReturnDocument::After)
        .await?;
    let conversation_id = convo
        .as_ref()
        .and_then(|c| c.get_object_id("_id").ok())
        .map(|oid| oid.to_hex());

    // 5. Insert the inbound message with the REAL workspace id.
    let messages = state.mongo.collection::<Document>(db::COL_MESSAGES);
    let mut msg = doc! {
        "workspaceId": &workspace_id,
        "direction": Direction::Inbound.serialize_as_str(),
        "channel": Channel::Sms.serialize_as_str(),
        "from": &parsed.from,
        "to": &parsed.to,
        "body": &parsed.body,
        "status": MessageStatus::Delivered.as_str(),
        "provider": provider_id.as_str(),
        "providerMessageId": &parsed.provider_message_id,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };
    if let Some(cid) = &conversation_id {
        msg.insert("conversationId", cid);
    }
    if let Some(account_id) = &provider_account_id {
        msg.insert("providerAccountId", account_id);
    }
    // Idempotent on providerMessageId via the unique partial index — a
    // duplicate-key no-op means this is a provider webhook RETRY, so we
    // must skip the event emit + keyword side effects too.
    match messages.insert_one(msg).await {
        Ok(inserted) => {
            let message_id = inserted
                .inserted_id
                .as_object_id()
                .map(|oid| oid.to_hex())
                .unwrap_or_default();

            // 6. Event-stream bridge (best-effort).
            let mut redis = state.redis.clone();
            events::emit(
                &mut redis,
                &EngineEvent::MessageInbound {
                    workspace_id: workspace_id.clone(),
                    message_id,
                    conversation_id: conversation_id.clone().unwrap_or_default(),
                    from: parsed.from.clone(),
                    body: parsed.body.clone(),
                },
            )
            .await;

            // 7. STOP/START/HELP keyword interceptor — failures must
            // never fail the webhook ack.
            if let Err(e) = keywords::handle_inbound_keywords(
                state,
                &workspace_id,
                &parsed.from,
                &parsed.to,
                &number_doc,
                provider_id,
                &parsed.body,
            )
            .await
            {
                tracing::warn!(?e, workspace = %workspace_id, "keyword interceptor failed");
            }
        }
        Err(e) if db::is_duplicate_key_error(&e) => {
            tracing::debug!(
                provider_message_id = %parsed.provider_message_id,
                "duplicate inbound webhook delivery; skipping side effects"
            );
        }
        Err(e) => return Err(e.into()),
    }
    Ok(Json(json!({ "ok": true, "kind": "inbound" })))
}

async fn handle_dlr(
    state: &Arc<AppState>,
    provider_id: ProviderId,
    adapter: &dyn SmsProvider,
    url: &str,
    headers: &HashMap<String, String>,
    body: &[u8],
) -> EngineResult<Json<Value>> {
    // 1. Parse first.
    let evt = adapter
        .parse_dlr(body)
        .map_err(|e| EngineError::Provider(e.to_string()))?;

    // 2. Find the original outbound message to learn its workspace.
    let messages = state.mongo.collection::<Document>(db::COL_MESSAGES);
    let original = messages
        .find_one(doc! { "providerMessageId": &evt.provider_message_id })
        .await?;
    let original = match original {
        Some(d) => d,
        None => {
            // Carriers retry on 5xx — acknowledge unknown ids instead.
            tracing::warn!(provider_message_id = %evt.provider_message_id, "DLR for unknown providerMessageId");
            return Ok(Json(json!({ "ok": true, "kind": "dlr", "matched": false })));
        }
    };
    let workspace_id = original.get_str("workspaceId").unwrap_or("").to_string();
    let provider_account_id = original
        .get_str("providerAccountId")
        .ok()
        .map(|s| s.to_string());
    // Prefer the provider recorded on the doc (covers SABSMS_PROVIDER_MOCK
    // test mode where the path may differ from the doc field).
    let doc_provider = original
        .get_str("provider")
        .ok()
        .and_then(ProviderId::parse)
        .unwrap_or(provider_id);

    // 3. Verify with the owning workspace's creds.
    verify_signature(
        state,
        doc_provider,
        adapter,
        url,
        headers,
        body,
        &workspace_id,
        provider_account_id.as_deref(),
    )
    .await?;

    // 4. Apply the status update. The `$ne` status guard makes carrier
    //    DLR retries idempotent — a repeat of the same status modifies
    //    nothing, so campaign stats below can't double-count.
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
    let update_res = messages
        .update_one(
            doc! {
                "providerMessageId": &evt.provider_message_id,
                "status": { "$ne": evt.status.as_str() },
            },
            doc! { "$set": set },
        )
        .await?;

    // Campaign stats denormalisation: a DLR moves the message out of
    // the `sent` bucket into `delivered` / `failed`. Only bump when the
    // update actually transitioned the doc AND it was sitting in `sent`
    // beforehand (so out-of-order or repeated DLRs can't skew counts).
    if update_res.modified_count == 1 {
        if let Ok(campaign_id) = original.get_str("campaignId") {
            let was_sent = matches!(original.get_str("status"), Ok("sent") | Ok("sending"));
            if was_sent {
                let bucket = match evt.status {
                    MessageStatus::Delivered => Some("delivered"),
                    MessageStatus::Failed | MessageStatus::Undelivered => Some("failed"),
                    _ => None,
                };
                if let Some(bucket) = bucket {
                    crate::campaigns::bump_stats(state, campaign_id, Some("sent"), bucket).await;
                }
            }
        }
    }

    // Event-stream bridge (best-effort).
    if matches!(evt.status, MessageStatus::Delivered) {
        let message_id = original
            .get_object_id("_id")
            .map(|oid| oid.to_hex())
            .unwrap_or_default();
        let mut redis = state.redis.clone();
        events::emit(
            &mut redis,
            &EngineEvent::MessageDelivered {
                workspace_id: workspace_id.clone(),
                message_id,
            },
        )
        .await;
    }
    Ok(Json(json!({ "ok": true, "kind": "dlr", "matched": true })))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn e164_variants_cover_plus_and_bare() {
        assert_eq!(e164_variants("+15551234567"), vec!["+15551234567", "15551234567"]);
        assert_eq!(e164_variants("15551234567"), vec!["15551234567", "+15551234567"]);
    }
}
