//! Carrier webhook handlers.
//!
//! Two route families:
//!
//! 1. **Legacy** `POST /webhook/{provider}/{direction}` — Twilio (+ mock
//!    in test mode). The workspace is resolved from the destination
//!    number (inbound) or the original message (DLR), and the provider
//!    signature is verified with that workspace's credentials.
//!
//! 2. **Generic** `GET|POST /webhook/{provider}/{account_id}/{direction}`
//!    — multi-provider dispatch. The provider account doc is loaded by
//!    id (workspace comes from it) and the request is authenticated by
//!    EITHER the provider's signature scheme (Twilio HMAC-SHA1, Telnyx
//!    Ed25519) OR the per-account `?secret=<webhookSecret>` URL
//!    parameter (the only option for MSG91/Gupshup, which have no
//!    signature scheme). GET callbacks (Gupshup-style) are supported by
//!    treating the raw query string as the parse payload.

use std::{collections::HashMap, sync::Arc};

use axum::{
    body::Bytes,
    extract::{Path, RawQuery, State},
    http::HeaderMap,
    Json,
};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::options::ReturnDocument;
use serde_json::{json, Value};

use crate::{
    compliance, creds, db, errors_map,
    errors::{EngineError, EngineResult},
    events::{self, EngineEvent},
    keywords,
    providers::{registry, ProviderCreds, SmsProvider},
    state::AppState,
    types::{Channel, Direction, MessageStatus, ProviderId},
};

fn unsigned_webhooks_allowed() -> bool {
    std::env::var("SABSMS_ALLOW_UNSIGNED_WEBHOOKS").unwrap_or_default() == "true"
}

fn mock_mode() -> bool {
    std::env::var("SABSMS_PROVIDER_MOCK").unwrap_or_default() == "true"
}

fn header_map(headers: &HeaderMap) -> HashMap<String, String> {
    headers
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|s| (k.as_str().to_string(), s.to_string())))
        .collect()
}

fn parse_provider(provider: &str) -> EngineResult<ProviderId> {
    let provider_id = ProviderId::parse(provider)
        .ok_or_else(|| EngineError::BadRequest(format!("unknown provider '{provider}'")))?;
    if provider_id == ProviderId::Mock && !mock_mode() {
        return Err(EngineError::BadRequest(
            "mock provider webhooks require SABSMS_PROVIDER_MOCK=true".into(),
        ));
    }
    if registry::provider(provider_id).is_none() {
        return Err(EngineError::BadRequest(format!(
            "provider '{provider}' has no webhook adapter"
        )));
    }
    Ok(provider_id)
}

/// Legacy public POST endpoint (Twilio + mock). Kept for backwards
/// compatibility with webhook URLs already configured at Twilio.
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
                "provider '{other}' not supported on the legacy webhook route; use /webhook/{other}/{{accountId}}/{{direction}}"
            )))
        }
    };

    let adapter = registry::provider(provider_id)
        .ok_or_else(|| EngineError::BadRequest("provider has no adapter".into()))?;

    let header_map = header_map(&headers);

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
            handle_inbound(&state, provider_id, adapter, &url, &header_map, &body).await
        }
        "dlr" => handle_dlr(&state, provider_id, adapter, &url, &header_map, &body).await,
        _ => Err(EngineError::NotFound),
    }
}

/// Generic multi-provider endpoint:
/// `GET|POST /webhook/{provider}/{account_id}/{direction}[?secret=...]`.
pub async fn handle_account(
    State(state): State<Arc<AppState>>,
    Path((provider, account_id, direction)): Path<(String, String, String)>,
    RawQuery(raw_query): RawQuery,
    headers: HeaderMap,
    body: Bytes,
) -> EngineResult<Json<Value>> {
    let provider_id = parse_provider(&provider)?;
    let adapter = registry::provider(provider_id)
        .ok_or_else(|| EngineError::BadRequest("provider has no adapter".into()))?;

    // 1. Load the provider account — it pins workspace + secret.
    let accounts = state.mongo.collection::<Document>(db::COL_PROVIDER_ACCOUNTS);
    let id_filter = match ObjectId::parse_str(&account_id) {
        Ok(oid) => doc! { "_id": oid },
        Err(_) => doc! { "_id": &account_id },
    };
    let account = accounts
        .find_one(id_filter)
        .await?
        .ok_or(EngineError::NotFound)?;
    if account.get_str("provider").unwrap_or_default() != provider_id.as_str() {
        return Err(EngineError::BadRequest(
            "account does not belong to this provider".into(),
        ));
    }
    let workspace_id = account.get_str("workspaceId").unwrap_or("").to_string();
    if workspace_id.is_empty() {
        return Err(EngineError::BadRequest("account without workspace".into()));
    }

    let header_map = header_map(&headers);
    let url = header_map.get("x-forwarded-url").cloned().unwrap_or_else(|| {
        format!(
            "{}/webhook/{}/{account_id}/{direction}{}",
            state.cfg.app_callback_url,
            provider_id.as_str(),
            raw_query
                .as_deref()
                .map(|q| format!("?{q}"))
                .unwrap_or_default(),
        )
    });

    // GET-style callbacks (Gupshup DLR/inbound) carry everything in the
    // query string — treat it as the parse payload when the body is empty.
    let query_params: HashMap<String, String> = raw_query
        .as_deref()
        .and_then(|q| serde_urlencoded::from_str(q).ok())
        .unwrap_or_default();
    let payload: Vec<u8> = if body.is_empty() {
        raw_query.clone().unwrap_or_default().into_bytes()
    } else {
        body.to_vec()
    };

    // 2. Authenticate: provider signature OR per-account URL secret.
    if !unsigned_webhooks_allowed() {
        let signature_ok = match resolve_account_creds(
            &state,
            provider_id,
            &workspace_id,
            &account_id,
        )
        .await
        {
            Some(provider_creds) => {
                adapter.verify_webhook_signature(&url, &payload, &header_map, &provider_creds)
            }
            None => false,
        };
        if !signature_ok {
            let doc_secret = account.get_str("webhookSecret").unwrap_or_default();
            let given = query_params.get("secret").map(|s| s.as_str()).unwrap_or("");
            if doc_secret.is_empty() || given.is_empty() || doc_secret != given {
                return Err(EngineError::Unauthorized);
            }
        }
    }

    // 3. Dispatch.
    match direction.as_str() {
        "inbound" => {
            let parsed = adapter
                .parse_inbound(&payload)
                .map_err(|e| EngineError::Provider(e.to_string()))?;
            // The destination-number doc (when registered) supplies the
            // keyword auto-reply context; the account doc already pins
            // the workspace, so a missing number doc is not fatal.
            let numbers = state.mongo.collection::<Document>(db::COL_NUMBERS);
            let number_doc = numbers
                .find_one(doc! {
                    "workspaceId": &workspace_id,
                    "e164": { "$in": e164_variants(&parsed.to) },
                })
                .await?
                .unwrap_or_else(|| doc! { "provider": provider_id.as_str(), "providerAccountId": &account_id });
            inbound_core(
                &state,
                provider_id,
                parsed,
                &workspace_id,
                Some(account_id.clone()),
                &number_doc,
            )
            .await
        }
        "dlr" => {
            let evt = adapter
                .parse_dlr(&payload)
                .map_err(|e| EngineError::Provider(e.to_string()))?;
            let messages = state.mongo.collection::<Document>(db::COL_MESSAGES);
            // Scope the lookup to the authenticated workspace — without
            // this filter, a tenant with any valid provider account + its
            // URL secret could forge DLRs for another workspace's message
            // (cross-workspace IDOR) just by observing a providerMessageId.
            let original = messages
                .find_one(doc! {
                    "providerMessageId": &evt.provider_message_id,
                    "workspaceId": &workspace_id,
                })
                .await?;
            let original = match original {
                Some(d) => d,
                None => {
                    tracing::warn!(provider_message_id = %evt.provider_message_id, "DLR for unknown providerMessageId");
                    return Ok(Json(json!({ "ok": true, "kind": "dlr", "matched": false })));
                }
            };
            dlr_core(&state, provider_id, evt, original).await
        }
        _ => Err(EngineError::NotFound),
    }
}

/// Resolve an account's decrypted creds for webhook signature checks.
/// `None` when resolution fails (missing/disabled account, bad key…) —
/// the caller then falls back to the URL secret.
async fn resolve_account_creds(
    state: &Arc<AppState>,
    provider_id: ProviderId,
    workspace_id: &str,
    account_id: &str,
) -> Option<ProviderCreds> {
    if provider_id == ProviderId::Mock {
        return Some(ProviderCreds {
            blob: serde_json::json!({}),
        });
    }
    match creds::resolve(state, workspace_id, provider_id, Some(account_id)).await {
        Ok(resolved) => Some(resolved.creds.clone()),
        Err(e) => {
            tracing::debug!(?e, workspace = %workspace_id, "webhook creds resolution failed; falling back to URL secret");
            None
        }
    }
}

/// Resolve creds + verify the provider signature (legacy route). Bypassed
/// entirely when `SABSMS_ALLOW_UNSIGNED_WEBHOOKS=true` (dev). The mock
/// provider checks its own header and never needs stored creds.
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

    inbound_core(
        state,
        provider_id,
        parsed,
        &workspace_id,
        provider_account_id,
        &number_doc,
    )
    .await
}

/// Shared inbound pipeline (post-verification): conversation upsert,
/// idempotent message insert, event emit, keyword interception.
async fn inbound_core(
    state: &Arc<AppState>,
    provider_id: ProviderId,
    parsed: crate::providers::InboundMessage,
    workspace_id: &str,
    provider_account_id: Option<String>,
    number_doc: &Document,
) -> EngineResult<Json<Value>> {
    let now = Utc::now();
    let now_bson = mongodb::bson::DateTime::from_millis(now.timestamp_millis());

    // Upsert the conversation thread for this peer.
    let preview: String = parsed.body.chars().take(160).collect();
    let conversations = state.mongo.collection::<Document>(db::COL_CONVERSATIONS);
    let convo = conversations
        .find_one_and_update(
            doc! {
                "workspaceId": workspace_id,
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
                    "workspaceId": workspace_id,
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

    // Insert the inbound message with the REAL workspace id.
    let messages = state.mongo.collection::<Document>(db::COL_MESSAGES);
    let mut msg = doc! {
        "workspaceId": workspace_id,
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
    if !parsed.media_urls.is_empty() {
        msg.insert("mediaUrls", &parsed.media_urls);
    }
    // V2.11 — RCS suggestion-postback taps carry the suggestion's
    // postback data; stored on the doc so the inbox can badge them.
    if let Some(postback) = &parsed.postback_data {
        msg.insert("postbackData", postback);
    }
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

            // Event-stream bridge (best-effort).
            let mut redis = state.redis.clone();
            events::emit(
                &mut redis,
                &EngineEvent::MessageInbound {
                    workspace_id: workspace_id.to_string(),
                    message_id,
                    conversation_id: conversation_id.clone().unwrap_or_default(),
                    from: parsed.from.clone(),
                    body: parsed.body.clone(),
                    postback_data: parsed.postback_data.clone(),
                },
            )
            .await;

            // STOP/START/HELP keyword interceptor — failures must
            // never fail the webhook ack.
            if let Err(e) = keywords::handle_inbound_keywords(
                state,
                workspace_id,
                &parsed.from,
                &parsed.to,
                number_doc,
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

    dlr_core(state, doc_provider, evt, original).await
}

/// Shared DLR pipeline (post-verification): idempotent status update,
/// normalized error code + suppression, campaign stats, event emit.
async fn dlr_core(
    state: &Arc<AppState>,
    provider_for_normalize: ProviderId,
    evt: crate::providers::DlrEvent,
    original: Document,
) -> EngineResult<Json<Value>> {
    let messages = state.mongo.collection::<Document>(db::COL_MESSAGES);
    let workspace_id = original.get_str("workspaceId").unwrap_or("").to_string();

    // Apply the status update. The `$ne` status guard makes carrier
    // DLR retries idempotent — a repeat of the same status modifies
    // nothing, so campaign stats below can't double-count.
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
    // Normalized error code stored alongside the raw provider code.
    let normalized = evt
        .error_code
        .as_deref()
        .map(|raw| errors_map::normalize_error(provider_for_normalize, raw));
    if let Some(code) = &evt.error_code {
        set.insert("errorCode", code);
    }
    if let Some(nm) = normalized {
        set.insert("normalizedCode", nm.code);
    }
    if let Some(msg) = &evt.error_message {
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

    // V2.6 routing health: feed the per-(account, country) rolling
    // window + circuit breaker. Gated on `modified_count == 1` so
    // carrier DLR retries can't double-count an outcome.
    if update_res.modified_count == 1 {
        if let Ok(acct) = original.get_str("providerAccountId") {
            if !acct.is_empty() {
                let dest_country = original
                    .get_str("to")
                    .map(crate::routing::country_of)
                    .unwrap_or_else(|_| "UNK".into());
                let mut redis = state.redis.clone();
                match evt.status {
                    MessageStatus::Delivered => {
                        let latency_ms = original
                            .get_datetime("sentAt")
                            .ok()
                            .map(|s| Utc::now().timestamp_millis() - s.timestamp_millis())
                            .filter(|ms| *ms >= 0);
                        crate::routing::note_delivery(&mut redis, acct, &dest_country, latency_ms)
                            .await;
                    }
                    MessageStatus::Failed | MessageStatus::Undelivered => {
                        crate::routing::note_failure(&mut redis, acct, &dest_country).await;
                    }
                    _ => {}
                }
            }
        }
    }

    // Permanent destination failures (invalid number, landline, STOP
    // block) feed the suppression list.
    if let Some(nm) = normalized {
        if nm.suppress {
            if let Ok(to) = original.get_str("to") {
                suppress_from_dlr(state, &workspace_id, to, nm.code).await;
            }
        }
    }

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

/// Suppression upsert from a DLR-normalized permanent failure.
async fn suppress_from_dlr(
    state: &Arc<AppState>,
    workspace_id: &str,
    to_e164: &str,
    normalized_code: &str,
) {
    let phone_hash = compliance::hash_phone(to_e164);
    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    let suppressions = state.mongo.collection::<Document>(db::COL_SUPPRESSIONS);
    let res = suppressions
        .update_one(
            doc! { "workspaceId": workspace_id, "phoneHash": &phone_hash },
            doc! { "$setOnInsert": {
                "workspaceId": workspace_id,
                "phoneHash": &phone_hash,
                "reason": normalized_code,
                "source": "carrier_block",
                "createdAt": now,
            }},
        )
        .upsert(true)
        .await;
    match res {
        Ok(_) => {}
        Err(e) if db::is_duplicate_key_error(&e) => {}
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "failed to add DLR suppression");
        }
    }
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

    #[test]
    fn parse_provider_accepts_registry_backed_providers() {
        assert_eq!(parse_provider("twilio").unwrap(), ProviderId::Twilio);
        assert_eq!(parse_provider("telnyx").unwrap(), ProviderId::Telnyx);
        assert_eq!(parse_provider("msg91").unwrap(), ProviderId::Msg91);
        assert_eq!(parse_provider("gupshup").unwrap(), ProviderId::Gupshup);
        assert!(parse_provider("vonage").is_err());
        assert!(parse_provider("nope").is_err());
    }
}
