//! Multipart entrypoints for ad-manager Server Actions.
//!
//! Each `/from-form/*` route accepts the raw `FormData` posted from a
//! Next.js Server Action and dispatches to the appropriate handler.
//! The Next.js shim no longer reads any field — it forwards the entire
//! body and revalidates on the response.

use axum::{
    Json,
    extract::{Multipart, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use serde_json::Value;
use std::collections::HashMap;

use crate::{
    graph::{self, GraphProxyBody, GraphProxyResult, TokenKind},
    handlers::{QuickCreateBody, QuickCreateResult, quick_create_campaign_inner},
    state::AdManagerState,
};

async fn collect(mut mp: Multipart) -> Result<HashMap<String, String>> {
    let mut out = HashMap::new();
    while let Some(field) = mp
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(format!("multipart: {e}")))?
    {
        let name = field.name().unwrap_or("").to_owned();
        if name.is_empty() {
            continue;
        }
        let value = field
            .text()
            .await
            .map_err(|e| ApiError::BadRequest(format!("field '{name}': {e}")))?;
        out.insert(name, value);
    }
    Ok(out)
}

fn with_act_prefix(id: &str) -> String {
    if id.is_empty() {
        return id.to_owned();
    }
    if id.starts_with("act_") {
        id.to_owned()
    } else {
        format!("act_{id}")
    }
}

// ---------------------------------------------------------------------------
// Quick-create campaign — multi-step Graph + Mongo. Mirrors the legacy
// `handleCreateAdCampaign` server action verbatim.
// ---------------------------------------------------------------------------

pub async fn create_ad_campaign(
    user: AuthUser,
    State(s): State<AdManagerState>,
    multipart: Multipart,
) -> Result<Json<QuickCreateResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let f = collect(multipart).await?;

    let ad_account_id = f.get("adAccountId").cloned().unwrap_or_default();
    let facebook_page_id = f.get("facebookPageId").cloned().unwrap_or_default();
    let campaign_name = f.get("campaignName").cloned().unwrap_or_default();
    let daily_budget_minor = f
        .get("dailyBudget")
        .and_then(|s| s.parse::<f64>().ok())
        .map(|v| (v * 100.0) as i64)
        .unwrap_or(0);
    let ad_message = f.get("adMessage").cloned().unwrap_or_default();
    let destination_url = f.get("destinationUrl").cloned().unwrap_or_default();

    if ad_account_id.is_empty()
        || facebook_page_id.is_empty()
        || campaign_name.is_empty()
        || daily_budget_minor <= 0
        || ad_message.is_empty()
        || destination_url.is_empty()
    {
        return Ok(Json(QuickCreateResult {
            message: None,
            error: Some(
                "All fields are required, including Name, Objective, Status, and Budget."
                    .to_owned(),
            ),
        }));
    }

    let body = QuickCreateBody {
        ad_account_id: with_act_prefix(&ad_account_id),
        facebook_page_id,
        campaign_name,
        daily_budget_minor,
        ad_message,
        destination_url,
        objective: f
            .get("objective")
            .cloned()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "OUTCOME_TRAFFIC".to_owned()),
        status: f
            .get("status")
            .cloned()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "PAUSED".to_owned()),
        image_hash: f.get("imageHash").cloned().filter(|s| !s.is_empty()),
        target_country: f
            .get("targetCountry")
            .cloned()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "IN".to_owned()),
        min_age: f
            .get("minAge")
            .and_then(|s| s.parse::<i64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(18),
        max_age: f
            .get("maxAge")
            .and_then(|s| s.parse::<i64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(65),
    };

    Ok(Json(quick_create_campaign_inner(&s, oid, body).await))
}

// ---------------------------------------------------------------------------
// Automated rule — POST /{act_X}/adrules_library with rule-spec JSON.
// Mirrors `createAutomatedRule` from `ad-manager-features.actions.ts`.
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormActionResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn create_automated_rule(
    user: AuthUser,
    State(s): State<AdManagerState>,
    multipart: Multipart,
) -> Result<Json<FormActionResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let f = collect(multipart).await?;

    let ad_account_id = f.get("adAccountId").cloned().unwrap_or_default();
    let name = f.get("name").cloned().unwrap_or_default();
    let action_type = f
        .get("actionType")
        .cloned()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "PAUSE".to_owned());
    let metric_field = f
        .get("metricField")
        .cloned()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "spend".to_owned());
    let operator = f
        .get("operator")
        .cloned()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "GREATER_THAN".to_owned());
    let value_str = f.get("value").cloned().unwrap_or_default();

    if ad_account_id.is_empty() || name.is_empty() || value_str.is_empty() {
        return Ok(Json(FormActionResult {
            error: Some("Name, entity type, and threshold are required.".to_owned()),
            message: None,
        }));
    }
    let value: f64 = value_str.parse().unwrap_or(0.0);

    let proxy_body = GraphProxyBody {
        path: format!("{}/adrules_library", with_act_prefix(&ad_account_id)),
        method: "POST".to_owned(),
        params: serde_json::Map::new(),
        body: Some(
            serde_json::json!({
                "name": name,
                "evaluation_spec": {
                    "evaluation_type": "SCHEDULE",
                    "filters": [{ "field": metric_field, "operator": operator, "value": value }],
                },
                "execution_spec": { "execution_type": action_type },
                "schedule_spec": { "schedule_type": "SEMI_HOURLY" },
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
        token_kind: TokenKind::AdManager,
    };
    let res: GraphProxyResult = graph::proxy(&s, oid, proxy_body).await?;
    if let Some(err) = res.error {
        return Ok(Json(FormActionResult {
            error: Some(err),
            message: None,
        }));
    }
    Ok(Json(FormActionResult {
        message: Some(format!("Rule \"{name}\" created.")),
        error: None,
    }))
}

// ---------------------------------------------------------------------------
// Custom conversion — POST /{act_X}/customconversions.
// Mirrors `createCustomConversion` from `ad-manager-features.actions.ts`.
// ---------------------------------------------------------------------------

pub async fn create_custom_conversion(
    user: AuthUser,
    State(s): State<AdManagerState>,
    multipart: Multipart,
) -> Result<Json<FormActionResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let f = collect(multipart).await?;

    let ad_account_id = f.get("adAccountId").cloned().unwrap_or_default();
    let name = f.get("name").cloned().unwrap_or_default();
    let pixel_id = f.get("pixelId").cloned().unwrap_or_default();
    let event_name = f
        .get("eventName")
        .cloned()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "PURCHASE".to_owned());
    let url_rule = f.get("urlRule").cloned().filter(|s| !s.is_empty());
    let default_value = f.get("defaultValue").and_then(|s| s.parse::<f64>().ok());

    if ad_account_id.is_empty() || name.is_empty() || pixel_id.is_empty() {
        return Ok(Json(FormActionResult {
            error: Some("Name and pixel are required.".to_owned()),
            message: None,
        }));
    }

    let mut body = serde_json::Map::new();
    body.insert("name".to_owned(), Value::String(name.clone()));
    body.insert("pixel_id".to_owned(), Value::String(pixel_id));
    body.insert("custom_event_type".to_owned(), Value::String(event_name));
    if let Some(rule) = url_rule {
        body.insert(
            "rule".to_owned(),
            serde_json::json!({ "url": { "i_contains": rule } }),
        );
    }
    if let Some(v) = default_value {
        body.insert(
            "default_conversion_value".to_owned(),
            serde_json::Number::from_f64(v)
                .map(Value::Number)
                .unwrap_or(Value::Null),
        );
    }

    let proxy_body = GraphProxyBody {
        path: format!("{}/customconversions", with_act_prefix(&ad_account_id)),
        method: "POST".to_owned(),
        params: serde_json::Map::new(),
        body: Some(body),
        token_kind: TokenKind::AdManager,
    };
    let res: GraphProxyResult = graph::proxy(&s, oid, proxy_body).await?;
    if let Some(err) = res.error {
        return Ok(Json(FormActionResult {
            error: Some(err),
            message: None,
        }));
    }
    Ok(Json(FormActionResult {
        message: Some(format!("Custom conversion \"{name}\" created.")),
        error: None,
    }))
}
