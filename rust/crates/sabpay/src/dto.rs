//! Request/response DTOs for the SabPay surface.
//!
//! Output structs serialize to the exact camelCase shapes the Next.js client
//! (`src/lib/sabpay/types.ts`) already consumes, so the TS types are reused
//! verbatim. Input structs accept the same camelCase the dashboard + public
//! routes send.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/* ── Output: payment ─────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
pub struct CustomerOut {
    pub name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderMetaOut {
    #[serde(rename = "paymentMode")]
    pub payment_mode: Option<String>,
    #[serde(rename = "bankRefNum")]
    pub bank_ref_num: Option<String>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentOut {
    pub id: String,
    pub mode: String,
    pub status: String,
    pub amount: i64,
    pub currency: String,
    pub description: String,
    pub customer: CustomerOut,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancel_url: Option<String>,
    pub checkout_url: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_txn_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_payment_id: Option<String>,
    pub provider_meta: ProviderMetaOut,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paid_at: Option<String>,
}

/* ── Output: merchant ────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantOut {
    pub business_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brand_color: Option<String>,
    pub mode: String,
    pub default_currency: String,
    pub created_at: String,
}

/* ── Output: api key ─────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyOut {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub mode: String,
    pub display: String,
    pub revoked: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    pub created_at: String,
    /// Present exactly once, on create.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret: Option<String>,
}

/* ── Output: webhook endpoint + delivery ─────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookEndpointOut {
    #[serde(rename = "_id")]
    pub id: String,
    pub url: String,
    pub events: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub active: bool,
    pub failure_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_delivery_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_status: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    /// Present exactly once, on create / rotate.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret: Option<String>,
    pub has_secret: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookDeliveryOut {
    #[serde(rename = "_id")]
    pub id: String,
    pub endpoint_id: String,
    pub url: String,
    pub event: String,
    pub payment_id: String,
    pub success: bool,
    pub status: Option<i64>,
    pub attempts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebhookDataOut {
    pub endpoints: Vec<WebhookEndpointOut>,
    pub deliveries: Vec<WebhookDeliveryOut>,
}

/* ── Output: stats + overview ────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
pub struct StatsPoint {
    pub date: String,
    pub volume: i64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsOut {
    pub total_volume: i64,
    pub total_count: i64,
    pub succeeded_count: i64,
    pub failed_count: i64,
    pub created_count: i64,
    pub success_rate: i64,
    pub series: Vec<StatsPoint>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OverviewOut {
    pub merchant: MerchantOut,
    pub stats: StatsOut,
    pub recent: Vec<PaymentOut>,
}

/* ── Output: hosted-checkout view ────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
pub struct CheckoutBusiness {
    pub name: String,
    #[serde(rename = "logoUrl", skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    #[serde(rename = "brandColor")]
    pub brand_color: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutView {
    pub payment_id: String,
    pub mode: String,
    pub status: String,
    pub amount: i64,
    pub currency: String,
    pub description: String,
    pub customer_name: String,
    pub customer_email: String,
    pub customer_phone: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancel_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
    pub business: CheckoutBusiness,
}

/// Result of building a signed PayU session: the form `action` + fields the
/// browser auto-submits.
#[derive(Debug, Clone, Serialize)]
pub struct PayuSessionOut {
    pub action: String,
    pub fields: std::collections::BTreeMap<String, String>,
}

/// Result of finalizing a payment (callback / simulate): the merchant redirect.
#[derive(Debug, Clone, Serialize)]
pub struct FinalizeOut {
    pub status: String,
    #[serde(rename = "paymentId")]
    pub payment_id: String,
    #[serde(rename = "redirectUrl", skip_serializing_if = "Option::is_none")]
    pub redirect_url: Option<String>,
}

/* ── Input bodies ────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Deserialize)]
pub struct CustomerIn {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentBody {
    pub amount: i64,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub customer: Option<CustomerIn>,
    #[serde(default)]
    pub metadata: Option<Value>,
    #[serde(default)]
    pub success_url: Option<String>,
    #[serde(default)]
    pub cancel_url: Option<String>,
    /// Mode to stamp on the payment. Omitted by the dashboard (uses the
    /// merchant's mode); set by the public API from the key prefix.
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMerchantBody {
    #[serde(default)]
    pub business_name: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub brand_color: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateKeyBody {
    pub name: String,
    pub mode: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateWebhookBody {
    pub url: String,
    pub events: Vec<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateWebhookBody {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub events: Option<Vec<String>>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PayuSessionBody {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub phone: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SimulateBody {
    /// `"success"` finalizes succeeded; anything else fails the payment.
    pub outcome: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
}

/// Generic `{ success: true }` ack.
#[derive(Debug, Clone, Serialize)]
pub struct Ack {
    pub success: bool,
}

impl Ack {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
