//! Number search + provisioning (service-token routes).
//!
//! Credentials never leave the engine: the Next side calls these
//! endpoints and the engine talks to the provider APIs with the
//! workspace's resolved creds.
//!
//! - `POST /v1/numbers/search { workspaceId, provider, country, capabilities? }`
//!   Twilio: `GET /2010-04-01/Accounts/{sid}/AvailablePhoneNumbers/{country}/{Local|TollFree}.json`
//!   Telnyx: `GET /v2/available_phone_numbers?filter[country_code]=..&filter[features][]=sms`
//! - `POST /v1/numbers/provision { workspaceId, provider, phoneNumber }`
//!   Twilio: `POST .../IncomingPhoneNumbers.json` (PhoneNumber=…)
//!   Telnyx: `POST /v2/number_orders { phone_numbers: [{ phone_number }] }`
//!   On success the number is inserted into `sabsms_numbers`
//!   (status `active`).
//!
//! MSG91 / Gupshup have no number inventory — sender IDs are registered
//! manually (DLT headers); both endpoints return 400 for them.

use std::sync::Arc;

use axum::{extract::State, Json};
use chrono::Utc;
use mongodb::bson::{doc, Document};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    creds, db,
    errors::{EngineError, EngineResult},
    state::AppState,
    types::ProviderId,
};

/// Providers whose numbers are provisioned through an API.
fn purchasable(provider: ProviderId) -> bool {
    matches!(provider, ProviderId::Twilio | ProviderId::Telnyx)
}

fn manual_sender_error(provider: ProviderId) -> EngineError {
    EngineError::BadRequest(format!(
        "sender IDs are registered manually for this provider ({})",
        provider.as_str()
    ))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchNumbersBody {
    pub workspace_id: String,
    pub provider: ProviderId,
    /// ISO-3166 alpha-2, e.g. "US".
    pub country: String,
    #[serde(default)]
    pub capabilities: Option<Vec<String>>,
    #[serde(default)]
    pub provider_account_id: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NumberCapabilities {
    pub sms: bool,
    pub mms: bool,
    pub rcs: bool,
    pub voice: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableNumber {
    pub phone_number: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub friendly_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    /// "longcode" | "tollfree" | "mobile".
    pub r#type: String,
    pub capabilities: NumberCapabilities,
    /// Monthly cost in cents (USD) when the provider reports one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub monthly_cost: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchNumbersResponse {
    pub numbers: Vec<AvailableNumber>,
}

pub async fn search(
    State(state): State<Arc<AppState>>,
    Json(body): Json<SearchNumbersBody>,
) -> EngineResult<Json<SearchNumbersResponse>> {
    if body.workspace_id.is_empty() || body.country.is_empty() {
        return Err(EngineError::BadRequest(
            "workspaceId + country required".into(),
        ));
    }
    if !purchasable(body.provider) {
        return Err(manual_sender_error(body.provider));
    }
    let country = body.country.to_uppercase();
    let wants = |cap: &str| {
        body.capabilities
            .as_ref()
            .map(|caps| caps.iter().any(|c| c == cap))
            .unwrap_or(false)
    };

    let resolved = creds::resolve(
        &state,
        &body.workspace_id,
        body.provider,
        body.provider_account_id.as_deref(),
    )
    .await?;

    let numbers = match body.provider {
        ProviderId::Twilio => {
            twilio_search(&state, &resolved.creds.blob, &country, &body, wants("sms"), wants("mms"), wants("voice")).await?
        }
        ProviderId::Telnyx => {
            telnyx_search(&state, &resolved.creds.blob, &country, &body).await?
        }
        _ => unreachable!("guarded by purchasable()"),
    };

    Ok(Json(SearchNumbersResponse { numbers }))
}

fn twilio_base() -> String {
    std::env::var("SABSMS_TWILIO_API_BASE")
        .unwrap_or_else(|_| "https://api.twilio.com".to_string())
}

fn telnyx_base() -> String {
    std::env::var("SABSMS_TELNYX_API_BASE")
        .unwrap_or_else(|_| "https://api.telnyx.com".to_string())
}

fn blob_str<'a>(blob: &'a Value, key: &str) -> EngineResult<&'a str> {
    blob.get(key)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| EngineError::BadRequest(format!("provider credentials missing '{key}'")))
}

async fn twilio_search(
    state: &Arc<AppState>,
    blob: &Value,
    country: &str,
    body: &SearchNumbersBody,
    sms: bool,
    mms: bool,
    voice: bool,
) -> EngineResult<Vec<AvailableNumber>> {
    let sid = blob_str(blob, "accountSid")?;
    let token = blob_str(blob, "authToken")?;

    let mut out = Vec::new();
    for (kind, ty) in [("Local", "longcode"), ("TollFree", "tollfree")] {
        let mut url = format!(
            "{}/2010-04-01/Accounts/{}/AvailablePhoneNumbers/{}/{}.json?PageSize=20",
            twilio_base(),
            sid,
            country,
            kind
        );
        if sms || body.capabilities.is_none() {
            url.push_str("&SmsEnabled=true");
        }
        if mms {
            url.push_str("&MmsEnabled=true");
        }
        if voice {
            url.push_str("&VoiceEnabled=true");
        }
        let resp = state
            .http
            .get(&url)
            .basic_auth(sid, Some(token))
            .send()
            .await
            .map_err(|e| EngineError::Provider(format!("twilio search: {e}")))?;
        let status = resp.status();
        let raw = resp
            .text()
            .await
            .map_err(|e| EngineError::Provider(format!("twilio search body: {e}")))?;
        if !status.is_success() {
            // Toll-free search is unsupported in some countries — skip
            // silently when Local already produced results.
            if kind == "TollFree" && !out.is_empty() {
                continue;
            }
            return Err(EngineError::Provider(format!("twilio search {status}: {raw}")));
        }
        let parsed: Value = serde_json::from_str(&raw)
            .map_err(|e| EngineError::Provider(format!("twilio search decode: {e}")))?;
        if let Some(items) = parsed.get("available_phone_numbers").and_then(|v| v.as_array()) {
            for item in items {
                let caps = item.get("capabilities").cloned().unwrap_or(Value::Null);
                let cap = |k1: &str, k2: &str| {
                    caps.get(k1)
                        .or_else(|| caps.get(k2))
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false)
                };
                out.push(AvailableNumber {
                    phone_number: item
                        .get("phone_number")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string(),
                    friendly_name: item
                        .get("friendly_name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    region: item
                        .get("region")
                        .and_then(|v| v.as_str())
                        .filter(|s| !s.is_empty())
                        .map(|s| s.to_string()),
                    r#type: ty.to_string(),
                    capabilities: NumberCapabilities {
                        sms: cap("SMS", "sms"),
                        mms: cap("MMS", "mms"),
                        rcs: false,
                        voice: cap("voice", "Voice"),
                    },
                    // Twilio's AvailablePhoneNumbers API doesn't return
                    // pricing — surface the well-known list prices.
                    monthly_cost: Some(if ty == "tollfree" { 215 } else { 115 }),
                    currency: Some("USD".to_string()),
                });
            }
        }
    }
    out.retain(|n| !n.phone_number.is_empty());
    Ok(out)
}

async fn telnyx_search(
    state: &Arc<AppState>,
    blob: &Value,
    country: &str,
    body: &SearchNumbersBody,
) -> EngineResult<Vec<AvailableNumber>> {
    let api_key = blob_str(blob, "apiKey")?;
    let mut url = format!(
        "{}/v2/available_phone_numbers?filter[country_code]={}&filter[limit]=20",
        telnyx_base(),
        country
    );
    for cap in body.capabilities.clone().unwrap_or_else(|| vec!["sms".into()]) {
        match cap.as_str() {
            "sms" => url.push_str("&filter[features][]=sms"),
            "mms" => url.push_str("&filter[features][]=mms"),
            "voice" => url.push_str("&filter[features][]=voice"),
            _ => {}
        }
    }
    let resp = state
        .http
        .get(&url)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| EngineError::Provider(format!("telnyx search: {e}")))?;
    let status = resp.status();
    let raw = resp
        .text()
        .await
        .map_err(|e| EngineError::Provider(format!("telnyx search body: {e}")))?;
    if !status.is_success() {
        return Err(EngineError::Provider(format!("telnyx search {status}: {raw}")));
    }
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|e| EngineError::Provider(format!("telnyx search decode: {e}")))?;

    let mut out = Vec::new();
    if let Some(items) = parsed.get("data").and_then(|v| v.as_array()) {
        for item in items {
            let features: Vec<String> = item
                .get("features")
                .and_then(|f| f.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|f| f.get("name").and_then(|n| n.as_str()))
                        .map(|s| s.to_string())
                        .collect()
                })
                .unwrap_or_default();
            let has = |name: &str| features.iter().any(|f| f == name);
            let phone_type = item
                .get("phone_number_type")
                .and_then(|v| v.as_str())
                .unwrap_or("local");
            let ty = match phone_type {
                "toll_free" | "toll-free" => "tollfree",
                "mobile" => "mobile",
                _ => "longcode",
            };
            // cost_information: {"monthly_cost":"1.10","upfront_cost":"1.10","currency":"USD"}
            let cost_info = item.get("cost_information").cloned().unwrap_or(Value::Null);
            let monthly_cost = cost_info
                .get("monthly_cost")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .map(|d| (d * 100.0).round() as i64);
            let currency = cost_info
                .get("currency")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            out.push(AvailableNumber {
                phone_number: item
                    .get("phone_number")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                friendly_name: None,
                region: item
                    .get("region_information")
                    .and_then(|r| r.get(0))
                    .and_then(|r| r.get("region_name"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                r#type: ty.to_string(),
                capabilities: NumberCapabilities {
                    sms: has("sms"),
                    mms: has("mms"),
                    rcs: false,
                    voice: has("voice"),
                },
                monthly_cost,
                currency,
            });
        }
    }
    out.retain(|n| !n.phone_number.is_empty());
    Ok(out)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionNumberBody {
    pub workspace_id: String,
    pub provider: ProviderId,
    pub phone_number: String,
    #[serde(default)]
    pub provider_account_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionNumberResponse {
    pub ok: bool,
    /// Hex `_id` of the inserted `sabsms_numbers` doc.
    pub number_id: String,
    pub e164: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_number_id: Option<String>,
    pub capabilities: NumberCapabilities,
}

pub async fn provision(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ProvisionNumberBody>,
) -> EngineResult<Json<ProvisionNumberResponse>> {
    if body.workspace_id.is_empty() || body.phone_number.is_empty() {
        return Err(EngineError::BadRequest(
            "workspaceId + phoneNumber required".into(),
        ));
    }
    if !purchasable(body.provider) {
        return Err(manual_sender_error(body.provider));
    }

    let resolved = creds::resolve(
        &state,
        &body.workspace_id,
        body.provider,
        body.provider_account_id.as_deref(),
    )
    .await?;

    let (provider_number_id, capabilities) = match body.provider {
        ProviderId::Twilio => twilio_provision(&state, &resolved.creds.blob, &body.phone_number).await?,
        ProviderId::Telnyx => telnyx_provision(&state, &resolved.creds.blob, &body.phone_number).await?,
        _ => unreachable!("guarded by purchasable()"),
    };

    // Persist into sabsms_numbers (status active).
    let country = country_of(&body.phone_number);
    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    let number_type = if body.phone_number.starts_with("+1800")
        || body.phone_number.starts_with("+1888")
        || body.phone_number.starts_with("+1877")
        || body.phone_number.starts_with("+1866")
        || body.phone_number.starts_with("+1855")
        || body.phone_number.starts_with("+1844")
        || body.phone_number.starts_with("+1833")
    {
        "tollfree"
    } else {
        "longcode"
    };
    let mut number_doc = doc! {
        "workspaceId": &body.workspace_id,
        "e164": &body.phone_number,
        "country": &country,
        "type": number_type,
        "provider": body.provider.as_str(),
        "capabilities": {
            "sms": capabilities.sms,
            "mms": capabilities.mms,
            "rcs": capabilities.rcs,
            "voice": capabilities.voice,
        },
        "status": "active",
        "createdAt": now,
    };
    if let Some(pid) = &provider_number_id {
        number_doc.insert("providerNumberId", pid);
    }
    if let Some(account_id) = resolved.account_id.clone() {
        number_doc.insert("providerAccountId", account_id);
    }

    let numbers = state.mongo.collection::<Document>(db::COL_NUMBERS);
    let inserted = numbers.insert_one(number_doc).await?;
    let number_id = inserted
        .inserted_id
        .as_object_id()
        .map(|oid| oid.to_hex())
        .unwrap_or_default();

    Ok(Json(ProvisionNumberResponse {
        ok: true,
        number_id,
        e164: body.phone_number.clone(),
        provider_number_id,
        capabilities,
    }))
}

async fn twilio_provision(
    state: &Arc<AppState>,
    blob: &Value,
    phone_number: &str,
) -> EngineResult<(Option<String>, NumberCapabilities)> {
    let sid = blob_str(blob, "accountSid")?;
    let token = blob_str(blob, "authToken")?;
    let url = format!(
        "{}/2010-04-01/Accounts/{}/IncomingPhoneNumbers.json",
        twilio_base(),
        sid
    );
    let resp = state
        .http
        .post(&url)
        .basic_auth(sid, Some(token))
        .form(&[("PhoneNumber", phone_number)])
        .send()
        .await
        .map_err(|e| EngineError::Provider(format!("twilio provision: {e}")))?;
    let status = resp.status();
    let raw = resp
        .text()
        .await
        .map_err(|e| EngineError::Provider(format!("twilio provision body: {e}")))?;
    if !status.is_success() {
        return Err(EngineError::Provider(format!(
            "twilio provision {status}: {raw}"
        )));
    }
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|e| EngineError::Provider(format!("twilio provision decode: {e}")))?;
    let provider_number_id = parsed
        .get("sid")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let caps = parsed.get("capabilities").cloned().unwrap_or(Value::Null);
    let cap = |k1: &str, k2: &str| {
        caps.get(k1)
            .or_else(|| caps.get(k2))
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    };
    Ok((
        provider_number_id,
        NumberCapabilities {
            sms: cap("sms", "SMS"),
            mms: cap("mms", "MMS"),
            rcs: false,
            voice: cap("voice", "Voice"),
        },
    ))
}

async fn telnyx_provision(
    state: &Arc<AppState>,
    blob: &Value,
    phone_number: &str,
) -> EngineResult<(Option<String>, NumberCapabilities)> {
    let api_key = blob_str(blob, "apiKey")?;
    let url = format!("{}/v2/number_orders", telnyx_base());
    let mut body = serde_json::json!({
        "phone_numbers": [{ "phone_number": phone_number }],
    });
    if let Some(profile) = blob.get("messagingProfileId").and_then(|v| v.as_str()) {
        if !profile.is_empty() {
            body["messaging_profile_id"] = serde_json::json!(profile);
        }
    }
    let resp = state
        .http
        .post(&url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| EngineError::Provider(format!("telnyx provision: {e}")))?;
    let status = resp.status();
    let raw = resp
        .text()
        .await
        .map_err(|e| EngineError::Provider(format!("telnyx provision body: {e}")))?;
    if !status.is_success() {
        return Err(EngineError::Provider(format!(
            "telnyx provision {status}: {raw}"
        )));
    }
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|e| EngineError::Provider(format!("telnyx provision decode: {e}")))?;
    // The order id is the durable handle for the purchased number.
    let provider_number_id = parsed
        .get("data")
        .and_then(|d| d.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    Ok((
        provider_number_id,
        NumberCapabilities {
            sms: true,
            mms: false,
            rcs: false,
            voice: false,
        },
    ))
}

/// Best-effort ISO-3166 country guess from an E.164 number.
fn country_of(e164: &str) -> String {
    use phonenumber::country;
    match phonenumber::parse(Some(country::Id::US), e164) {
        Ok(p) => p
            .country()
            .id()
            .map(|c| format!("{:?}", c))
            .unwrap_or_else(|| "UNK".into()),
        Err(_) => "UNK".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn purchasable_matrix() {
        assert!(purchasable(ProviderId::Twilio));
        assert!(purchasable(ProviderId::Telnyx));
        assert!(!purchasable(ProviderId::Msg91));
        assert!(!purchasable(ProviderId::Gupshup));
        assert!(!purchasable(ProviderId::Mock));
    }

    #[test]
    fn available_number_serializes_camel_case() {
        let n = AvailableNumber {
            phone_number: "+14155551234".into(),
            friendly_name: Some("(415) 555-1234".into()),
            region: Some("CA".into()),
            r#type: "longcode".into(),
            capabilities: NumberCapabilities {
                sms: true,
                mms: true,
                rcs: false,
                voice: true,
            },
            monthly_cost: Some(115),
            currency: Some("USD".into()),
        };
        let v = serde_json::to_value(&n).unwrap();
        assert_eq!(v["phoneNumber"], "+14155551234");
        assert_eq!(v["friendlyName"], "(415) 555-1234");
        assert_eq!(v["type"], "longcode");
        assert_eq!(v["capabilities"]["sms"], true);
        assert_eq!(v["monthlyCost"], 115);
    }

    #[test]
    fn country_of_guesses_from_e164() {
        assert_eq!(country_of("+14155551234"), "US");
        assert_eq!(country_of("+919876543210"), "IN");
    }
}
