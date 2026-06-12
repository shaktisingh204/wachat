//! Service-token-protected internal endpoints (called by the Next.js
//! side, never by browsers or carriers).

use std::sync::Arc;

use axum::{extract::State, Json};
use mongodb::bson::{doc, oid::ObjectId, Document};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    creds, db,
    errors::{EngineError, EngineResult},
    routing,
    state::AppState,
    types::ProviderId,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidateCredsBody {
    pub workspace_id: String,
}

/// POST /v1/internal/creds/invalidate — drop every cached credential
/// entry for a workspace (the TS side calls this after editing a
/// provider account).
pub async fn invalidate_creds(
    State(state): State<Arc<AppState>>,
    Json(body): Json<InvalidateCredsBody>,
) -> EngineResult<Json<Value>> {
    creds::invalidate_workspace(&state, &body.workspace_id).await;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidateRoutingBody {
    pub workspace_id: String,
}

/// POST /v1/internal/routing/invalidate — drop the cached routing
/// policy for a workspace (the TS side calls this after every policy
/// save so rule edits apply within one message, not one cache TTL).
pub async fn invalidate_routing(
    State(state): State<Arc<AppState>>,
    Json(body): Json<InvalidateRoutingBody>,
) -> EngineResult<Json<Value>> {
    routing::policy::invalidate_workspace(&state, &body.workspace_id).await;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidateOtpConfigBody {
    pub workspace_id: String,
}

/// POST /v1/internal/otp/configs/invalidate — drop the cached OTP
/// config for a workspace (the TS side calls this after every
/// `sabsms_otp_configs` save so dashboard edits apply on the NEXT send,
/// not one 60s cache TTL later).
pub async fn invalidate_otp_config(
    State(_state): State<Arc<AppState>>,
    Json(body): Json<InvalidateOtpConfigBody>,
) -> EngineResult<Json<Value>> {
    crate::otp::store::invalidate_config(&body.workspace_id).await;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRouteBody {
    pub workspace_id: String,
    /// Destination number (E.164 or close enough to parse).
    pub to: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub channel: Option<String>,
}

/// POST /v1/internal/routing/preview — "where would this message
/// route?" Runs the REAL selector (policy + health ordering + sticky +
/// circuit annotations) without sending anything. The fallback
/// candidate mirrors an enqueue without an explicit provider (Twilio
/// default, workspace default account).
pub async fn preview_route(
    State(state): State<Arc<AppState>>,
    Json(body): Json<PreviewRouteBody>,
) -> EngineResult<Json<Value>> {
    if body.workspace_id.is_empty() || body.to.is_empty() {
        return Err(EngineError::BadRequest("workspaceId + to required".into()));
    }
    let country = routing::country_of(&body.to);
    let category = body
        .category
        .clone()
        .unwrap_or_else(|| "transactional".to_string());
    let channel = body.channel.clone().unwrap_or_else(|| "sms".to_string());
    let ctx = routing::RoutingContext {
        workspace_id: &body.workspace_id,
        to_e164: &body.to,
        country: &country,
        category: &category,
        channel: &channel,
        doc_provider: Some(ProviderId::Twilio),
        doc_provider_account_id: None,
    };
    let candidates = routing::select(&state, &ctx).await;

    let mut redis = state.redis.clone();
    let mut out = Vec::with_capacity(candidates.len());
    for c in &candidates {
        let (score, circuit) = match c.provider_account_id.as_deref() {
            Some(acct) => {
                let (score, _) = routing::health::score_and_volume(&mut redis, acct, &country).await;
                let circuit = routing::circuit::current_state(&mut redis, acct, &country).await;
                (Some(score), circuit.as_str())
            }
            None => (None, "closed"),
        };
        out.push(json!({
            "providerAccountId": c.provider_account_id,
            "provider": c.provider.as_str(),
            "fromOverride": c.from_override,
            "source": c.source.as_str(),
            "ruleId": c.rule_id,
            "score": score,
            "circuit": circuit,
        }));
    }
    Ok(Json(json!({
        "country": country,
        "candidates": out,
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestProviderBody {
    pub workspace_id: String,
    pub account_id: String,
}

/// POST /v1/internal/providers/test — resolve the account's creds and
/// hit a cheap read-only provider API to prove the credentials work.
///
/// Always answers 200 with `{ ok, provider, detail?/error? }` for
/// provider-level outcomes; 4xx only for malformed requests / unknown
/// accounts.
pub async fn test_provider(
    State(state): State<Arc<AppState>>,
    Json(body): Json<TestProviderBody>,
) -> EngineResult<Json<Value>> {
    if body.workspace_id.is_empty() || body.account_id.is_empty() {
        return Err(EngineError::BadRequest(
            "workspaceId + accountId required".into(),
        ));
    }

    // The account doc tells us which provider to test.
    let accounts = state.mongo.collection::<Document>(db::COL_PROVIDER_ACCOUNTS);
    let id_filter = match ObjectId::parse_str(&body.account_id) {
        Ok(oid) => doc! { "_id": oid, "workspaceId": &body.workspace_id },
        Err(_) => doc! { "_id": &body.account_id, "workspaceId": &body.workspace_id },
    };
    let account = accounts
        .find_one(id_filter)
        .await?
        .ok_or(EngineError::NotFound)?;
    let provider = account
        .get_str("provider")
        .ok()
        .and_then(ProviderId::parse)
        .ok_or_else(|| EngineError::BadRequest("account has an unknown provider".into()))?;

    // Drop any cached entry first so a just-saved credential is the one
    // being tested.
    creds::invalidate_workspace(&state, &body.workspace_id).await;

    let resolved = match creds::resolve(
        &state,
        &body.workspace_id,
        provider,
        Some(&body.account_id),
    )
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return Ok(Json(json!({
                "ok": false,
                "provider": provider.as_str(),
                "error": format!("credential resolution failed: {e}"),
            })))
        }
    };

    let outcome = match provider {
        ProviderId::Twilio => test_twilio(&state, &resolved.creds.blob).await,
        ProviderId::Telnyx => test_telnyx(&state, &resolved.creds.blob).await,
        ProviderId::Msg91 => test_msg91(&state, &resolved.creds.blob).await,
        ProviderId::Gupshup => test_gupshup(&state, &resolved.creds.blob).await,
        ProviderId::Mock => Ok("mock provider always passes".to_string()),
        other => Err(format!(
            "provider '{}' has no test-connection probe",
            other.as_str()
        )),
    };

    Ok(Json(match outcome {
        Ok(detail) => json!({ "ok": true, "provider": provider.as_str(), "detail": detail }),
        Err(error) => json!({ "ok": false, "provider": provider.as_str(), "error": error }),
    }))
}

fn blob_str<'a>(blob: &'a Value, key: &str) -> Result<&'a str, String> {
    blob.get(key)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("credentials missing '{key}'"))
}

fn base(env: &str, default: &str) -> String {
    std::env::var(env).unwrap_or_else(|_| default.to_string())
}

/// Twilio: GET the account resource itself.
async fn test_twilio(state: &Arc<AppState>, blob: &Value) -> Result<String, String> {
    let sid = blob_str(blob, "accountSid")?;
    let token = blob_str(blob, "authToken")?;
    let url = format!(
        "{}/2010-04-01/Accounts/{}.json",
        base("SABSMS_TWILIO_API_BASE", "https://api.twilio.com"),
        sid
    );
    let resp = state
        .http
        .get(&url)
        .basic_auth(sid, Some(token))
        .send()
        .await
        .map_err(|e| format!("network: {e}"))?;
    if resp.status().is_success() {
        let v: Value = resp.json().await.unwrap_or(Value::Null);
        let name = v
            .get("friendly_name")
            .and_then(|f| f.as_str())
            .unwrap_or("account");
        Ok(format!("authenticated as {name}"))
    } else {
        Err(format!("twilio responded {}", resp.status()))
    }
}

/// Telnyx: GET /v2/whoami.
async fn test_telnyx(state: &Arc<AppState>, blob: &Value) -> Result<String, String> {
    let api_key = blob_str(blob, "apiKey")?;
    let url = format!(
        "{}/v2/whoami",
        base("SABSMS_TELNYX_API_BASE", "https://api.telnyx.com")
    );
    let resp = state
        .http
        .get(&url)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| format!("network: {e}"))?;
    if resp.status().is_success() {
        Ok("API key accepted".to_string())
    } else {
        Err(format!("telnyx responded {}", resp.status()))
    }
}

/// MSG91: classic balance endpoint (`GET /api/balance.php?type=4`) —
/// a numeric body means the key is live; anything else is the error text.
async fn test_msg91(state: &Arc<AppState>, blob: &Value) -> Result<String, String> {
    let auth_key = blob_str(blob, "authKey")?;
    let url = format!(
        "{}/api/balance.php?authkey={}&type=4",
        base("SABSMS_MSG91_API_BASE", "https://control.msg91.com"),
        auth_key
    );
    let resp = state
        .http
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("network: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    let trimmed = text.trim();
    if status.is_success() && trimmed.parse::<f64>().is_ok() {
        Ok(format!("balance: {trimmed}"))
    } else {
        Err(format!("msg91 responded {status}: {trimmed}"))
    }
}

/// Gupshup Enterprise has no dedicated credential probe. We call the
/// Gateway with `method=SendMessage` and NO `send_to`: auth failures
/// come back as error ids 101/102; any other error id (e.g. 105 missing
/// params) proves the userid/password were accepted.
async fn test_gupshup(state: &Arc<AppState>, blob: &Value) -> Result<String, String> {
    let userid = blob_str(blob, "userid")?;
    let password = blob_str(blob, "password")?;
    let url = format!(
        "{}/GatewayAPI/rest",
        base("SABSMS_GUPSHUP_API_BASE", "https://enterprise.smsgupshup.com")
    );
    let resp = state
        .http
        .post(&url)
        .form(&[
            ("method", "SendMessage"),
            ("userid", userid),
            ("password", password),
            ("auth_scheme", "plain"),
            ("v", "1.1"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|e| format!("network: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("gupshup responded {status}"));
    }
    let v: Value = serde_json::from_str(&text)
        .map_err(|_| format!("gupshup returned a non-JSON body: {text}"))?;
    let id = v
        .get("response")
        .and_then(|r| r.get("id"))
        .map(|i| match i {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            _ => String::new(),
        })
        .unwrap_or_default();
    let resp_status = v
        .get("response")
        .and_then(|r| r.get("status"))
        .and_then(|s| s.as_str())
        .unwrap_or("");
    if id == "101" || id == "102" {
        Err("authentication failed (invalid userid or password)".to_string())
    } else if resp_status == "success" || !id.is_empty() {
        Ok("credentials accepted (gateway reachable)".to_string())
    } else {
        Err(format!("unexpected gupshup response: {text}"))
    }
}
