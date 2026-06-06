//! EXTERNAL SEAM — the **only** module that talks to `api.razorpay.com`.
//!
//! Every Razorpay REST call is funnelled through here using `reqwest` with
//! HTTP Basic auth (`keyId` : `keySecret`, read from
//! `projects.razorpaySettings`). Nothing here panics or unwraps a network
//! result: transport/decoding failures and non-2xx upstream responses are
//! mapped to [`ApiError::Internal`] (callers translate a *missing* config
//! into `ApiError::BadRequest` before ever reaching this module).
//!
//! Isolating the HTTP here keeps the handler layer pure (Mongo + validation
//! only) and gives the whole crate a single, mockable seam.

use sabnode_common::{ApiError, Result};
use serde_json::{Value, json};
use tracing::{instrument, warn};

const RAZORPAY_BASE: &str = "https://api.razorpay.com/v1";

/// Razorpay API credentials for a single project. Cheap to clone; carries no
/// long-lived handles. Construct via [`RazorpayCreds::from_settings`].
#[derive(Clone)]
pub struct RazorpayCreds {
    pub key_id: String,
    pub key_secret: String,
}

impl RazorpayCreds {
    /// Build creds from the project's `razorpaySettings` sub-doc. Returns
    /// `None` when the sub-doc is missing or either field is empty — the
    /// caller turns that into `ApiError::BadRequest("Razorpay not
    /// configured")`, so the seam itself never sees blank creds.
    pub fn from_settings(settings: Option<&bson::Document>) -> Option<Self> {
        let s = settings?;
        let key_id = s.get_str("keyId").ok()?.trim().to_owned();
        let key_secret = s.get_str("keySecret").ok()?.trim().to_owned();
        if key_id.is_empty() || key_secret.is_empty() {
            return None;
        }
        Some(Self { key_id, key_secret })
    }
}

/// Build a fresh `reqwest::Client`. Cheap enough per request for this
/// low-volume admin surface; constructing it cannot panic at this seam
/// because a builder failure is mapped to `ApiError::Internal`.
fn http_client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .build()
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("razorpay.client.build")))
}

/// Issue an authenticated GET and decode the JSON body. Non-2xx and
/// transport/decoding errors become `ApiError::Internal` (the upstream
/// body is logged, never surfaced to the client).
async fn get_json(creds: &RazorpayCreds, path: &str, count: u32) -> Result<Value> {
    let client = http_client()?;
    let url = format!("{RAZORPAY_BASE}{path}");
    let resp = client
        .get(&url)
        .basic_auth(&creds.key_id, Some(&creds.key_secret))
        .query(&[("count", count.to_string())])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("razorpay.get.send")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        warn!(%status, "razorpay GET {path} failed: {body}");
        return Err(ApiError::Internal(anyhow::anyhow!(
            "Razorpay API error ({status}) on {path}"
        )));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("razorpay.get.decode")))
}

/// Pull a list field out of a Razorpay collection response. Razorpay
/// returns `{ "entity": "collection", "count": N, "items": [...] }`; the
/// payment-link endpoint has historically also used `payment_links`, so we
/// accept either. Anything unexpected degrades to an empty list rather than
/// erroring.
fn extract_items(body: &Value) -> Vec<Value> {
    body.get("items")
        .or_else(|| body.get("payment_links"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

/// `GET /payments?count=N` — recent transactions for the project.
#[instrument(skip_all)]
pub async fn list_payments(creds: &RazorpayCreds, count: u32) -> Result<Vec<Value>> {
    let body = get_json(creds, "/payments", count).await?;
    Ok(extract_items(&body))
}

/// `GET /payment_links?count=N` — recent payment links for the project.
#[instrument(skip_all)]
pub async fn list_payment_links(creds: &RazorpayCreds, count: u32) -> Result<Vec<Value>> {
    let body = get_json(creds, "/payment_links", count).await?;
    Ok(extract_items(&body))
}

/// `POST /payment_links` — create a payment link.
///
/// `amount_paise` is the amount already converted to the smallest currency
/// unit. Returns `(id, short_url)`. A missing `short_url` in an otherwise-2xx
/// response is treated as an upstream error (`ApiError::Internal`).
#[instrument(skip_all)]
pub async fn create_payment_link(
    creds: &RazorpayCreds,
    amount_paise: i64,
    contact: &str,
    description: &str,
    name: Option<&str>,
    email: Option<&str>,
) -> Result<(String, String)> {
    let mut customer = json!({ "contact": contact });
    if let Some(n) = name.filter(|s| !s.is_empty()) {
        customer["name"] = json!(n);
    }
    if let Some(e) = email.filter(|s| !s.is_empty()) {
        customer["email"] = json!(e);
    }

    let payload = json!({
        "amount": amount_paise,
        "currency": "INR",
        "accept_partial": false,
        "description": description,
        "customer": customer,
        "notify": { "sms": true, "email": email.map(|e| !e.is_empty()).unwrap_or(false) },
        "reminder_enable": true,
    });

    let client = http_client()?;
    let url = format!("{RAZORPAY_BASE}/payment_links");
    let resp = client
        .post(&url)
        .basic_auth(&creds.key_id, Some(&creds.key_secret))
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("razorpay.payment_links.send"))
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        warn!(%status, "razorpay payment-link create failed: {body}");
        return Err(ApiError::Internal(anyhow::anyhow!(
            "Razorpay API error ({status}) creating payment link"
        )));
    }

    let body: Value = resp.json().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("razorpay.payment_links.decode"))
    })?;

    let id = body
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let short_url = body
        .get("short_url")
        .and_then(Value::as_str)
        .map(str::to_owned);

    match short_url {
        Some(url) if !url.is_empty() => Ok((id, url)),
        _ => Err(ApiError::Internal(anyhow::anyhow!(
            "Razorpay did not return a payment-link short_url"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creds_from_missing_settings_is_none() {
        assert!(RazorpayCreds::from_settings(None).is_none());
    }

    #[test]
    fn creds_from_empty_fields_is_none() {
        let d = bson::doc! { "keyId": "", "keySecret": "" };
        assert!(RazorpayCreds::from_settings(Some(&d)).is_none());
        let d2 = bson::doc! { "keyId": "rzp_test", "keySecret": "  " };
        assert!(RazorpayCreds::from_settings(Some(&d2)).is_none());
    }

    #[test]
    fn creds_from_present_fields_is_some() {
        let d = bson::doc! { "keyId": "rzp_test_abc", "keySecret": "sek_ret" };
        let creds = RazorpayCreds::from_settings(Some(&d)).expect("creds");
        assert_eq!(creds.key_id, "rzp_test_abc");
        assert_eq!(creds.key_secret, "sek_ret");
    }

    #[test]
    fn extract_items_reads_items_then_payment_links() {
        let a = json!({ "items": [{ "id": "pay_1" }] });
        assert_eq!(extract_items(&a).len(), 1);
        let b = json!({ "payment_links": [{ "id": "plink_1" }, { "id": "plink_2" }] });
        assert_eq!(extract_items(&b).len(), 2);
        let c = json!({ "entity": "collection" });
        assert!(extract_items(&c).is_empty());
    }
}
