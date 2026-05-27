//! Request DTOs for sabcheckout-sessions.

use serde::{Deserialize, Serialize};

use crate::types::{SabcheckoutSession, SelectedItem, SessionTotals};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub page_id: Option<String>,
    #[serde(default)]
    pub q: Option<String>,
}

/// Public (unauthenticated) create. The handler is responsible for
/// resolving the page from `pageSlug` and binding the new session to
/// the page's `userId`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCreateSessionInput {
    pub page_slug: String,
    #[serde(default)]
    pub payer_email: Option<String>,
    #[serde(default)]
    pub payer_name: Option<String>,
    #[serde(default)]
    pub payer_phone: Option<String>,
    #[serde(default)]
    pub custom_fields_json: Option<serde_json::Value>,
    #[serde(default)]
    pub selected_items: Vec<SelectedItem>,
    pub totals: SessionTotals,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResponse {
    pub id: String,
    pub session: SabcheckoutSession,
}

/// Public confirm callback — used by the gateway-return route to flip a
/// session from `pending` to `completed` / `failed`. In dev this is
/// fired directly by the Next.js layer using the MockGateway.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicConfirmSessionInput {
    pub session_id: String,
    pub status: String,
    #[serde(default)]
    pub payment_ref: Option<String>,
    #[serde(default)]
    pub provider_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmSessionResponse {
    pub session: SabcheckoutSession,
}
