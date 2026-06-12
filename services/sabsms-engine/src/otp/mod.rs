//! Engine-native OTP/Verify (V2.7, architecture decision 8).
//!
//! Endpoints (all service-token):
//!   - `POST /v1/otp/send`   — fraud pre-check → rate limits → generate
//!     + store hashed code → enqueue through the NORMAL worker pipeline
//!     (message doc category `otp` + LPUSH, via the shared
//!     `handlers::send::enqueue_message`).
//!   - `POST /v1/otp/verify` — constant-time compare; success records a
//!     CONVERSION for (account, country, prefix) so the router ranks
//!     the `otp` category by conversion rate instead of DLR rate.
//!   - `POST /v1/otp/resend` — cooldown + budget check, re-sends the
//!     SAME code (industry standard).
//!   - `GET  /v1/otp/stats`  — merged conversion window per (country,
//!     prefix) for the dashboard.
//!   - `POST /v1/lookup`     — thin Twilio/Telnyx line-type lookup
//!     pass-through (plan-gated Next-side), 24h Redis cache.

pub mod fraud;
pub mod store;

use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use mongodb::bson::{doc, Document};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    creds, db,
    errors::{EngineError, EngineResult},
    events::{self, EngineEvent},
    handlers::send::{enqueue_message, normalise_e164},
    routing::{self, health},
    state::AppState,
    types::{Channel, EnqueueSendInput, MessageCategory, MessageStatus, ProviderId},
};

/// Per-workspace OTP send cap per minute.
pub const WORKSPACE_SENDS_PER_MINUTE: i64 = 60;

// ---------------------------------------------------------------------------
// DTOs (camelCase wire convention)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpSendInput {
    pub workspace_id: String,
    pub to: String,
    #[serde(default)]
    pub channel: Option<Channel>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpSendResult {
    /// The Redis key suffix (`{workspaceId}:{phoneE164}`).
    pub otp_id: String,
    /// Epoch seconds.
    pub expires_at: i64,
    /// Epoch seconds — earliest allowed resend.
    pub resend_after: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpVerifyInput {
    pub workspace_id: String,
    pub to: String,
    pub code: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpVerifyResult {
    pub verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<&'static str>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpResendInput {
    pub workspace_id: String,
    pub to: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupInput {
    pub workspace_id: String,
    pub to: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LookupResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub carrier_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mobile_country_code: Option<String>,
    /// Which provider answered ("twilio" | "telnyx" | "cache").
    pub source: String,
}

fn status_json(status: StatusCode, body: Value) -> Response {
    (status, Json(body)).into_response()
}

// ---------------------------------------------------------------------------
// POST /v1/otp/send
// ---------------------------------------------------------------------------

pub async fn send(
    State(state): State<Arc<AppState>>,
    Json(input): Json<OtpSendInput>,
) -> EngineResult<Response> {
    if input.workspace_id.is_empty() {
        return Err(EngineError::BadRequest("workspaceId required".into()));
    }
    let to = normalise_e164(&input.to)?;
    let country = routing::country_of(&to);
    let prefix = fraud::prefix8(&to);

    // 1. Fraud pre-check (default ON; monitor mode demotes to Flag).
    match fraud::pre_check(&state, &input.workspace_id, &to, &country).await {
        fraud::Verdict::Block { code } => {
            return Ok(status_json(
                StatusCode::FORBIDDEN,
                json!({ "error": "fraud_blocked", "code": code }),
            ));
        }
        fraud::Verdict::Flag { code } => {
            tracing::info!(workspace = %input.workspace_id, code, "otp send flagged (allowed)");
        }
        fraud::Verdict::Allow => {}
    }

    let mut redis = state.redis.clone();
    let now = chrono::Utc::now();

    // 2. Per-workspace per-minute cap.
    let minute = now.timestamp().div_euclid(60);
    let rate_key = format!("sabsms:otp:wsrate:{}:{minute}", input.workspace_id);
    let ws_sends: i64 = {
        let res: redis::RedisResult<i64> = async {
            let n: i64 = redis.incr(&rate_key, 1).await?;
            let _: bool = redis.expire(&rate_key, 60).await?;
            Ok(n)
        }
        .await;
        res.unwrap_or(0) // fail open on Redis hiccup
    };
    if ws_sends > WORKSPACE_SENDS_PER_MINUTE {
        return Ok(status_json(
            StatusCode::TOO_MANY_REQUESTS,
            json!({ "error": "rate_limited", "scope": "workspace_per_minute" }),
        ));
    }

    let cfg = store::load_config(&state, &input.workspace_id).await;
    let key = store::otp_key(&input.workspace_id, &to);

    // 3. Per-phone resend cooldown via the stored hash.
    if let Some(existing) = store::get(&mut redis, &key).await? {
        if now.timestamp() < existing.expires_at {
            let retry_at = existing.last_sent_at_ms / 1000 + cfg.resend_cooldown_secs;
            if now.timestamp() < retry_at {
                return Ok(status_json(
                    StatusCode::TOO_MANY_REQUESTS,
                    json!({ "error": "cooldown", "resendAfter": retry_at }),
                ));
            }
        }
    }

    // 4. Generate (rejection-sampled uniform digits) + store hashed.
    // ThreadRng is !Send — keep it inside a sync block.
    let (code, salt) = {
        let mut rng = rand::thread_rng();
        (
            store::generate_code(&mut rng, cfg.code_length),
            store::generate_salt(&mut rng),
        )
    };
    let account_id = predict_account(&state, &input.workspace_id, &to, &country).await;
    let rec = store::OtpRecord {
        code_hash: store::hash_code(&code, &salt),
        salt,
        code_enc: store::seal_code(&code, &key),
        attempts: 0,
        max_attempts: cfg.max_attempts,
        resends: 0,
        max_resends: cfg.max_resends,
        expires_at: now.timestamp() + cfg.ttl_secs,
        last_sent_at_ms: now.timestamp_millis(),
        account_id: account_id.clone(),
        country: country.clone(),
        prefix: prefix.clone(),
        created_at_ms: now.timestamp_millis(),
    };
    store::put(&mut redis, &key, &rec, cfg.ttl_secs).await?;

    // 5. Render + enqueue through the normal worker pipeline.
    let body = store::render_template(&cfg.template_body, &code, cfg.brand_name.as_deref());
    let result = enqueue_message(
        &state,
        otp_enqueue_input(&input.workspace_id, &to, body, input.channel, &cfg, &account_id),
    )
    .await?;
    if result.status == MessageStatus::Suppressed {
        store::delete(&mut redis, &key).await;
        return Ok(status_json(
            StatusCode::BAD_REQUEST,
            json!({ "error": "suppressed" }),
        ));
    }

    // 6. Conversion-stat `sent++` at ENQUEUE time + event.
    health::record_otp_sent(&mut redis, &account_id, &country, &prefix).await;
    events::emit(
        &mut redis,
        &EngineEvent::OtpSent {
            workspace_id: input.workspace_id.clone(),
            to_prefix: prefix,
        },
    )
    .await;

    Ok(Json(OtpSendResult {
        otp_id: format!("{}:{}", input.workspace_id, to),
        expires_at: rec.expires_at,
        resend_after: now.timestamp() + cfg.resend_cooldown_secs,
        message_id: (!result.id.is_empty()).then_some(result.id),
    })
    .into_response())
}

fn otp_enqueue_input(
    workspace_id: &str,
    to: &str,
    body: String,
    channel: Option<Channel>,
    cfg: &store::OtpConfig,
    account_id: &str,
) -> EnqueueSendInput {
    EnqueueSendInput {
        workspace_id: workspace_id.to_string(),
        to: to.to_string(),
        body,
        category: MessageCategory::Otp,
        channel,
        from: None,
        provider_account_id: (account_id != "default").then(|| account_id.to_string()),
        provider: None,
        sender_id: cfg.sender_id.clone(),
        template_id: None,
        template_prefix: None,
        campaign_id: None,
        contact_id: None,
        event_key: None,
        media: None,
        media_urls: None,
        dlt_entity_id: None,
        dlt_template_id: None,
        idempotency_key: None,
        tags: Some(vec!["otp".to_string()]),
    }
}

/// Predict which provider account will carry this OTP — the router's
/// top candidate (conversion-ranked for the otp category), resolved
/// down to a concrete account id like the worker would. Conversion
/// stats key on this; a later failover makes the attribution
/// approximate, which is acceptable for a 2h sliding window.
async fn predict_account(
    state: &Arc<AppState>,
    workspace_id: &str,
    to: &str,
    country: &str,
) -> String {
    let doc_provider = if std::env::var("SABSMS_PROVIDER_MOCK").unwrap_or_default() == "true" {
        ProviderId::Mock
    } else {
        ProviderId::Twilio
    };
    let ctx = routing::RoutingContext {
        workspace_id,
        to_e164: to,
        country,
        category: "otp",
        channel: "sms",
        doc_provider: Some(doc_provider),
        doc_provider_account_id: None,
    };
    let candidates = routing::select(state, &ctx).await;
    let Some(top) = candidates.first() else {
        return "default".to_string();
    };
    if let Some(acct) = top.provider_account_id.clone() {
        return acct;
    }
    // Default-account candidate — resolve it like the worker does.
    match creds::resolve(state, workspace_id, top.provider, None).await {
        Ok(rc) => rc.account_id.clone().unwrap_or_else(|| "default".to_string()),
        Err(_) => "default".to_string(),
    }
}

// ---------------------------------------------------------------------------
// POST /v1/otp/verify
// ---------------------------------------------------------------------------

pub async fn verify(
    State(state): State<Arc<AppState>>,
    Json(input): Json<OtpVerifyInput>,
) -> EngineResult<Json<OtpVerifyResult>> {
    if input.workspace_id.is_empty() || input.code.trim().is_empty() {
        return Err(EngineError::BadRequest("workspaceId + code required".into()));
    }
    let to = normalise_e164(&input.to)?;
    let key = store::otp_key(&input.workspace_id, &to);
    let mut redis = state.redis.clone();

    let Some(rec) = store::get(&mut redis, &key).await? else {
        return Ok(Json(OtpVerifyResult {
            verified: false,
            reason: Some("expired"),
        }));
    };

    let now = chrono::Utc::now();
    match store::decide_verify(&rec, input.code.trim(), now.timestamp()) {
        store::VerifyDecision::Verified => {
            store::delete(&mut redis, &key).await;
            // The conversion signal the router ranks the otp category by.
            health::record_conversion(&mut redis, &rec.account_id, &rec.country, &rec.prefix)
                .await;
            events::emit(
                &mut redis,
                &EngineEvent::OtpVerified {
                    workspace_id: input.workspace_id.clone(),
                    to_prefix: rec.prefix.clone(),
                    elapsed_ms: (now.timestamp_millis() - rec.created_at_ms).max(0),
                },
            )
            .await;
            Ok(Json(OtpVerifyResult {
                verified: true,
                reason: None,
            }))
        }
        store::VerifyDecision::WrongCode => {
            store::bump_attempts(&mut redis, &key).await;
            Ok(Json(OtpVerifyResult {
                verified: false,
                reason: Some("wrong_code"),
            }))
        }
        store::VerifyDecision::MaxAttempts => {
            store::delete(&mut redis, &key).await;
            Ok(Json(OtpVerifyResult {
                verified: false,
                reason: Some("max_attempts"),
            }))
        }
        store::VerifyDecision::Expired => {
            store::delete(&mut redis, &key).await;
            Ok(Json(OtpVerifyResult {
                verified: false,
                reason: Some("expired"),
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /v1/otp/resend
// ---------------------------------------------------------------------------

pub async fn resend(
    State(state): State<Arc<AppState>>,
    Json(input): Json<OtpResendInput>,
) -> EngineResult<Response> {
    if input.workspace_id.is_empty() {
        return Err(EngineError::BadRequest("workspaceId required".into()));
    }
    let to = normalise_e164(&input.to)?;
    let key = store::otp_key(&input.workspace_id, &to);
    let mut redis = state.redis.clone();

    let Some(rec) = store::get(&mut redis, &key).await? else {
        return Ok(status_json(
            StatusCode::BAD_REQUEST,
            json!({ "error": "expired" }),
        ));
    };

    let cfg = store::load_config(&state, &input.workspace_id).await;
    let now = chrono::Utc::now();
    match store::decide_resend(&rec, now.timestamp(), cfg.resend_cooldown_secs) {
        store::ResendDecision::Expired => {
            store::delete(&mut redis, &key).await;
            return Ok(status_json(
                StatusCode::BAD_REQUEST,
                json!({ "error": "expired" }),
            ));
        }
        store::ResendDecision::MaxResends => {
            return Ok(status_json(
                StatusCode::TOO_MANY_REQUESTS,
                json!({ "error": "max_resends" }),
            ));
        }
        store::ResendDecision::Cooldown { retry_at_secs } => {
            return Ok(status_json(
                StatusCode::TOO_MANY_REQUESTS,
                json!({ "error": "cooldown", "resendAfter": retry_at_secs }),
            ));
        }
        store::ResendDecision::Ok => {}
    }

    // A resend is a real SMS — it goes through the fraud guard too.
    let country = rec.country.clone();
    match fraud::pre_check(&state, &input.workspace_id, &to, &country).await {
        fraud::Verdict::Block { code } => {
            return Ok(status_json(
                StatusCode::FORBIDDEN,
                json!({ "error": "fraud_blocked", "code": code }),
            ));
        }
        fraud::Verdict::Flag { .. } | fraud::Verdict::Allow => {}
    }

    // Same code (industry standard). If the sealed copy can't be
    // recovered (key rotation), the record is unusable — expire it so
    // the caller falls back to a fresh /send.
    let Some(code) = store::unseal_code(&rec.code_enc, &key) else {
        tracing::warn!(workspace = %input.workspace_id, "otp resend unseal failed; expiring record");
        store::delete(&mut redis, &key).await;
        return Ok(status_json(
            StatusCode::BAD_REQUEST,
            json!({ "error": "expired" }),
        ));
    };

    let body = store::render_template(&cfg.template_body, &code, cfg.brand_name.as_deref());
    let result = enqueue_message(
        &state,
        otp_enqueue_input(&input.workspace_id, &to, body, None, &cfg, &rec.account_id),
    )
    .await?;
    if result.status == MessageStatus::Suppressed {
        return Ok(status_json(
            StatusCode::BAD_REQUEST,
            json!({ "error": "suppressed" }),
        ));
    }

    store::bump_resends(&mut redis, &key, now.timestamp_millis()).await;
    health::record_otp_sent(&mut redis, &rec.account_id, &country, &rec.prefix).await;
    events::emit(
        &mut redis,
        &EngineEvent::OtpSent {
            workspace_id: input.workspace_id.clone(),
            to_prefix: rec.prefix.clone(),
        },
    )
    .await;

    Ok(Json(OtpSendResult {
        otp_id: format!("{}:{}", input.workspace_id, to),
        expires_at: rec.expires_at,
        resend_after: now.timestamp() + cfg.resend_cooldown_secs,
        message_id: (!result.id.is_empty()).then_some(result.id),
    })
    .into_response())
}

// ---------------------------------------------------------------------------
// GET /v1/otp/stats?workspaceId=
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpStatsQuery {
    pub workspace_id: String,
}

/// Merged conversion window per (country, prefix), aggregated across
/// the workspace's provider accounts. Reads the same Redis otpstats
/// keys the fraud ticker scans.
pub async fn stats(
    State(state): State<Arc<AppState>>,
    Query(q): Query<OtpStatsQuery>,
) -> EngineResult<Json<Value>> {
    if q.workspace_id.is_empty() {
        return Err(EngineError::BadRequest("workspaceId required".into()));
    }

    // Account ids owned by this workspace (any status — stats are
    // historical) — otpstats keys from other tenants are filtered out.
    let col = state.mongo.collection::<Document>(db::COL_PROVIDER_ACCOUNTS);
    let mut accounts: Vec<String> = Vec::new();
    let mut cursor = col.find(doc! { "workspaceId": &q.workspace_id }).await?;
    while cursor.advance().await? {
        let d: Document = cursor.deserialize_current()?;
        let id = d
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .or_else(|_| d.get_str("_id").map(|s| s.to_string()));
        if let Ok(id) = id {
            accounts.push(id);
        }
    }

    let mut redis = state.redis.clone();
    let mut totals: std::collections::HashMap<(String, String), (u64, u64)> =
        std::collections::HashMap::new();
    for acct in &accounts {
        let pattern = format!("sabsms:otpstats:{acct}:*");
        let mut cursor: u64 = 0;
        loop {
            let res: redis::RedisResult<(u64, Vec<String>)> = redis::cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(&pattern)
                .arg("COUNT")
                .arg(200)
                .query_async(&mut redis)
                .await;
            let (next, keys) = match res {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!(?e, acct, "otp stats scan failed");
                    break;
                }
            };
            for key in keys {
                let Some((_acct, country, prefix)) = fraud::parse_otpstats_key(&key) else {
                    continue;
                };
                let map: std::collections::HashMap<String, String> =
                    redis.hgetall(&key).await.unwrap_or_default();
                let get = |f: &str| map.get(f).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                let entry = totals.entry((country, prefix)).or_insert((0, 0));
                entry.0 += get("sent");
                entry.1 += get("converted");
            }
            cursor = next;
            if cursor == 0 {
                break;
            }
        }
    }

    let mut rows: Vec<Value> = totals
        .into_iter()
        .map(|((country, prefix), (sent, converted))| {
            let rate = if sent > 0 {
                converted as f64 / sent as f64
            } else {
                0.0
            };
            json!({
                "country": country,
                "prefix": prefix,
                "sent": sent,
                "converted": converted,
                "rate": rate,
            })
        })
        .collect();
    rows.sort_by(|a, b| {
        b["sent"]
            .as_u64()
            .unwrap_or(0)
            .cmp(&a["sent"].as_u64().unwrap_or(0))
    });

    Ok(Json(json!({
        "fraudMode": fraud::FraudMode::from_env().as_str(),
        "windowSecs": 2 * health::OTP_BUCKET_SECS,
        "rows": rows,
    })))
}

// ---------------------------------------------------------------------------
// POST /v1/lookup — Twilio Lookup v2 / Telnyx number lookup
// ---------------------------------------------------------------------------

const LOOKUP_CACHE_SECS: u64 = 24 * 3600;

/// Normalize a Twilio Lookup v2 payload (pure, fixture-tested).
pub fn normalize_twilio_lookup(v: &Value) -> LookupResult {
    let lti = &v["line_type_intelligence"];
    LookupResult {
        line_type: lti["type"].as_str().map(str::to_string),
        carrier_name: lti["carrier_name"].as_str().map(str::to_string),
        mobile_country_code: lti["mobile_country_code"]
            .as_str()
            .map(str::to_string)
            .or_else(|| lti["mobile_country_code"].as_i64().map(|n| n.to_string())),
        source: "twilio".to_string(),
    }
}

/// Normalize a Telnyx number-lookup payload (pure, fixture-tested).
pub fn normalize_telnyx_lookup(v: &Value) -> LookupResult {
    let carrier = &v["data"]["carrier"];
    LookupResult {
        line_type: carrier["type"].as_str().map(str::to_string),
        carrier_name: carrier["name"].as_str().map(str::to_string),
        mobile_country_code: carrier["mobile_country_code"].as_str().map(str::to_string),
        source: "telnyx".to_string(),
    }
}

pub async fn lookup(
    State(state): State<Arc<AppState>>,
    Json(input): Json<LookupInput>,
) -> EngineResult<Json<LookupResult>> {
    if input.workspace_id.is_empty() {
        return Err(EngineError::BadRequest("workspaceId required".into()));
    }
    let to = normalise_e164(&input.to)?;

    // 24h cache.
    let cache_key = format!("sabsms:lookup:{to}");
    let mut redis = state.redis.clone();
    let cached: Option<String> = redis.get(&cache_key).await.unwrap_or(None);
    if let Some(raw) = cached {
        if let Ok(mut hit) = serde_json::from_str::<LookupResult>(&raw) {
            hit.source = "cache".to_string();
            return Ok(Json(hit));
        }
    }

    // Twilio first, Telnyx second; neither → BadRequest (thin
    // pass-through — plan gating happens Next-side).
    let result = if let Ok(rc) =
        creds::resolve(&state, &input.workspace_id, ProviderId::Twilio, None).await
    {
        let sid = rc
            .creds
            .blob
            .get("accountSid")
            .and_then(|v| v.as_str())
            .ok_or_else(|| EngineError::BadRequest("twilio account missing accountSid".into()))?
            .to_string();
        let token = rc
            .creds
            .blob
            .get("authToken")
            .and_then(|v| v.as_str())
            .ok_or_else(|| EngineError::BadRequest("twilio account missing authToken".into()))?
            .to_string();
        let base = std::env::var("SABSMS_TWILIO_LOOKUP_BASE")
            .unwrap_or_else(|_| "https://lookups.twilio.com".to_string());
        let url = format!(
            "{}/v2/PhoneNumbers/{}?Fields=line_type_intelligence",
            base.trim_end_matches('/'),
            to
        );
        let resp = state
            .http
            .get(&url)
            .basic_auth(&sid, Some(&token))
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(EngineError::Provider(format!(
                "twilio lookup {}",
                resp.status()
            )));
        }
        normalize_twilio_lookup(&resp.json::<Value>().await?)
    } else if let Ok(rc) =
        creds::resolve(&state, &input.workspace_id, ProviderId::Telnyx, None).await
    {
        let api_key = rc
            .creds
            .blob
            .get("apiKey")
            .and_then(|v| v.as_str())
            .ok_or_else(|| EngineError::BadRequest("telnyx account missing apiKey".into()))?
            .to_string();
        let base = std::env::var("SABSMS_TELNYX_LOOKUP_BASE")
            .unwrap_or_else(|_| "https://api.telnyx.com".to_string());
        let url = format!(
            "{}/v2/number_lookup/{}?type=carrier",
            base.trim_end_matches('/'),
            to
        );
        let resp = state.http.get(&url).bearer_auth(&api_key).send().await?;
        if !resp.status().is_success() {
            return Err(EngineError::Provider(format!(
                "telnyx lookup {}",
                resp.status()
            )));
        }
        normalize_telnyx_lookup(&resp.json::<Value>().await?)
    } else {
        return Err(EngineError::BadRequest(
            "number lookup needs a Twilio or Telnyx provider account".into(),
        ));
    };

    // Best-effort cache write.
    if let Ok(raw) = serde_json::to_string(&result) {
        let res: redis::RedisResult<()> = redis.set_ex(&cache_key, raw, LOOKUP_CACHE_SECS).await;
        if let Err(e) = res {
            tracing::warn!(?e, "lookup cache write failed");
        }
    }

    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn twilio_lookup_normalizes_line_type_intelligence() {
        let v = json!({
            "phone_number": "+14155552671",
            "line_type_intelligence": {
                "type": "mobile",
                "carrier_name": "T-Mobile USA, Inc.",
                "mobile_country_code": "310",
                "error_code": null,
            },
        });
        let out = normalize_twilio_lookup(&v);
        assert_eq!(out.line_type.as_deref(), Some("mobile"));
        assert_eq!(out.carrier_name.as_deref(), Some("T-Mobile USA, Inc."));
        assert_eq!(out.mobile_country_code.as_deref(), Some("310"));
        assert_eq!(out.source, "twilio");
        // Numeric MCC is normalized to a string too.
        let v = json!({ "line_type_intelligence": { "mobile_country_code": 310 } });
        assert_eq!(
            normalize_twilio_lookup(&v).mobile_country_code.as_deref(),
            Some("310")
        );
    }

    #[test]
    fn telnyx_lookup_normalizes_carrier_block() {
        let v = json!({
            "data": {
                "phone_number": "+14155552671",
                "carrier": {
                    "name": "Verizon Wireless",
                    "type": "mobile",
                    "mobile_country_code": "311",
                },
            },
        });
        let out = normalize_telnyx_lookup(&v);
        assert_eq!(out.line_type.as_deref(), Some("mobile"));
        assert_eq!(out.carrier_name.as_deref(), Some("Verizon Wireless"));
        assert_eq!(out.mobile_country_code.as_deref(), Some("311"));
        assert_eq!(out.source, "telnyx");
    }

    #[test]
    fn lookup_normalizers_tolerate_missing_fields() {
        let twilio = normalize_twilio_lookup(&json!({}));
        assert_eq!(twilio.line_type, None);
        assert_eq!(twilio.carrier_name, None);
        let telnyx = normalize_telnyx_lookup(&json!({ "data": {} }));
        assert_eq!(telnyx.line_type, None);
        assert_eq!(telnyx.mobile_country_code, None);
    }

    #[test]
    fn otp_send_result_serializes_camel_case() {
        let r = OtpSendResult {
            otp_id: "ws1:+14155552671".into(),
            expires_at: 1_000_300,
            resend_after: 1_000_030,
            message_id: Some("m1".into()),
        };
        let v = serde_json::to_value(&r).unwrap();
        assert_eq!(v["otpId"], "ws1:+14155552671");
        assert_eq!(v["expiresAt"], 1_000_300);
        assert_eq!(v["resendAfter"], 1_000_030);
        assert_eq!(v["messageId"], "m1");
    }

    #[test]
    fn verify_result_omits_reason_when_verified() {
        let v = serde_json::to_value(OtpVerifyResult {
            verified: true,
            reason: None,
        })
        .unwrap();
        assert_eq!(v["verified"], true);
        assert!(v.get("reason").is_none());
        let v = serde_json::to_value(OtpVerifyResult {
            verified: false,
            reason: Some("max_attempts"),
        })
        .unwrap();
        assert_eq!(v["reason"], "max_attempts");
    }
}
