//! Multi-tenant Telegram Payments handlers.
//!
//! Every route is scoped by `projectId` and enforced via
//! [`require_project`]. Provider tokens live in
//! `telegram_payment_providers`, reusable invoice payloads in
//! `telegram_payment_invoice_templates`, sent invoices/links in
//! `telegram_payment_invoices`, and completed payments in
//! `telegram_payments`.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::state::TelegramPaymentsState;

// ---------------------------------------------------------------------------
//  Constants & collection names
// ---------------------------------------------------------------------------

pub(crate) const PROJECTS: &str = "projects";
pub(crate) const BOTS: &str = "telegram_bots";
pub(crate) const PROVIDERS: &str = "telegram_payment_providers";
pub(crate) const TEMPLATES: &str = "telegram_payment_invoice_templates";
pub(crate) const INVOICES: &str = "telegram_payment_invoices";
pub(crate) const PAYMENTS: &str = "telegram_payments";

pub(crate) const TG_BASE: &str = "https://api.telegram.org";

// ---------------------------------------------------------------------------
//  Generic ack envelope
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "invoiceLink")]
    pub invoice_link: Option<String>,
}

fn ok_msg(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: true,
        message: Some(msg.into()),
        ..Default::default()
    })
}
fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  Tenancy helpers
// ---------------------------------------------------------------------------

pub(crate) fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
pub(crate) fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
pub(crate) fn dt(o: Option<bson::DateTime>) -> DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}

/// Verifies the authenticated user owns `project_id`. Returns the
/// project's `ObjectId` for downstream filtering.
pub(crate) async fn require_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ObjectId, String> {
    let project_oid = parse_oid(project_id).ok_or_else(|| "invalid project id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Project not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Project not found.".to_owned());
    }
    Ok(project_oid)
}

/// Find a bot belonging to a project. Returns the bot's document.
pub(crate) async fn require_bot_in_project(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_id: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id).ok_or_else(|| "invalid bot id".to_owned())?;
    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    Ok(bot)
}

pub(crate) fn csv_escape(v: &str) -> String {
    if v.contains(',') || v.contains('"') || v.contains('\n') {
        let escaped = v.replace('"', "\"\"");
        format!("\"{escaped}\"")
    } else {
        v.to_owned()
    }
}

fn mask_provider_token(token: &str) -> String {
    let n = token.chars().count();
    if n <= 4 {
        return "•".repeat(n);
    }
    let tail: String = token
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    let hidden = n.saturating_sub(4);
    format!("{}{tail}", "•".repeat(hidden.min(12)))
}

// ===========================================================================
//                          PROVIDER TOKENS — CRUD
// ===========================================================================

#[derive(Debug, Clone, Serialize)]
pub struct ProviderRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub label: String,
    #[serde(rename = "providerTokenMasked")]
    pub provider_token_masked: String,
    pub currency: String,
    #[serde(rename = "testMode")]
    pub test_mode: bool,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
}

fn provider_doc_to_row(d: &Document) -> Option<ProviderRow> {
    Some(ProviderRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        label: d.get_str("label").unwrap_or("").to_owned(),
        provider_token_masked: mask_provider_token(d.get_str("providerToken").unwrap_or("")),
        currency: d.get_str("currency").unwrap_or("USD").to_owned(),
        test_mode: d.get_bool("testMode").unwrap_or(false),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListProvidersResp {
    pub providers: Vec<ProviderRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_providers(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Query(q): Query<ProjectQuery>,
) -> Json<ListProvidersResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListProvidersResp {
                providers: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListProvidersResp {
                providers: vec![],
                error: Some(e),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(PROVIDERS)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListProvidersResp {
                providers: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListProvidersResp {
                providers: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    Json(ListProvidersResp {
        providers: docs.iter().filter_map(provider_doc_to_row).collect(),
        error: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProviderBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub label: String,
    #[serde(rename = "providerToken")]
    pub provider_token: String,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default, rename = "testMode")]
    pub test_mode: Option<bool>,
}

pub async fn create_provider(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Json(body): Json<CreateProviderBody>,
) -> Json<AckResult> {
    if body.label.trim().is_empty() {
        return err("label is required");
    }
    if body.provider_token.trim().is_empty() {
        return err("providerToken is required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let bot = match require_bot_in_project(&s.mongo, project_oid, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = bot
        .get_object_id("_id")
        .map_err(|_| "bot missing _id")
        .unwrap();

    let now = bson::DateTime::now();
    let doc = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "label": body.label.trim(),
        // NOTE: stored plain — sabnode-common has no encryption module.
        // See INTEGRATION NOTES.
        "providerToken": body.provider_token.trim(),
        "currency": body.currency.unwrap_or_else(|| "USD".to_owned()),
        "testMode": body.test_mode.unwrap_or(false),
        "createdAt": now,
        "updatedAt": now,
    };
    match s
        .mongo
        .collection::<Document>(PROVIDERS)
        .insert_one(doc)
        .await
    {
        Ok(r) => {
            let id = r
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                id: Some(id),
                message: Some("Provider saved.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProviderBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default, rename = "providerToken")]
    pub provider_token: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default, rename = "testMode")]
    pub test_mode: Option<bool>,
}

pub async fn update_provider(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Path(provider_id): Path<String>,
    Json(body): Json<UpdateProviderBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let pid = match parse_oid(&provider_id) {
        Some(o) => o,
        None => return err("invalid provider id"),
    };
    let mut set = doc! { "updatedAt": bson::DateTime::now() };
    if let Some(v) = body.label {
        set.insert("label", v.trim());
    }
    if let Some(v) = body.provider_token {
        if !v.trim().is_empty() {
            set.insert("providerToken", v.trim());
        }
    }
    if let Some(v) = body.currency {
        set.insert("currency", v);
    }
    if let Some(v) = body.test_mode {
        set.insert("testMode", v);
    }
    match s
        .mongo
        .collection::<Document>(PROVIDERS)
        .update_one(
            doc! { "_id": pid, "projectId": project_oid },
            doc! { "$set": set },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Provider not found."),
        Ok(_) => ok_msg("Provider updated."),
        Err(e) => err(format!("mongo: {e}")),
    }
}

pub async fn delete_provider(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Path(provider_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let pid = match parse_oid(&provider_id) {
        Some(o) => o,
        None => return err("invalid provider id"),
    };
    match s
        .mongo
        .collection::<Document>(PROVIDERS)
        .delete_one(doc! { "_id": pid, "projectId": project_oid })
        .await
    {
        Ok(r) if r.deleted_count == 0 => err("Provider not found."),
        Ok(_) => ok_msg("Provider deleted."),
        Err(e) => err(format!("mongo: {e}")),
    }
}

/// `POST /providers/{provider_id}/test` — verifies the bot token via
/// `getMe` and ensures the stored provider token is non-empty.
pub async fn test_provider(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Path(provider_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let pid = match parse_oid(&provider_id) {
        Some(o) => o,
        None => return err("invalid provider id"),
    };
    let provider = match s
        .mongo
        .collection::<Document>(PROVIDERS)
        .find_one(doc! { "_id": pid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Provider not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let token = provider.get_str("providerToken").unwrap_or("");
    if token.trim().is_empty() {
        return err("Provider token is empty.");
    }
    let bot_oid = match provider.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("Provider has no linked bot."),
    };
    let bot = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Linked bot not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let bot_token = bot.get_str("token").unwrap_or("");
    if bot_token.is_empty() {
        return err("Bot has no token configured.");
    }
    // Verify the bot token works (getMe).
    let url = format!("{TG_BASE}/bot{bot_token}/getMe");
    let resp: serde_json::Value = match s.http.get(url).send().await {
        Ok(r) => match r.json().await {
            Ok(j) => j,
            Err(e) => return err(format!("decode: {e}")),
        },
        Err(e) => return err(format!("network: {e}")),
    };
    if !resp.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        let d = resp
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Telegram getMe failed");
        return err(d.to_owned());
    }
    ok_msg("Provider OK.")
}

// ===========================================================================
//                       INVOICE TEMPLATES — CRUD
// ===========================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceItem {
    pub label: String,
    /// Smallest unit of the currency (cents for fiat, integer for XTR).
    #[serde(rename = "amountCents")]
    pub amount_cents: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ShippingOptionConfig {
    pub id: String,
    pub title: String,
    pub prices: Vec<PriceItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TemplateRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub title: String,
    pub description: String,
    pub payload: String,
    pub currency: String,
    pub prices: Vec<PriceItem>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "photoUrl")]
    pub photo_url: Option<String>,
    #[serde(rename = "needName")]
    pub need_name: bool,
    #[serde(rename = "needPhone")]
    pub need_phone: bool,
    #[serde(rename = "needEmail")]
    pub need_email: bool,
    #[serde(rename = "needShipping")]
    pub need_shipping: bool,
    #[serde(rename = "isFlexible")]
    pub is_flexible: bool,
    #[serde(skip_serializing_if = "Option::is_none", rename = "providerId")]
    pub provider_id: Option<String>,
    #[serde(default, rename = "shippingOptions")]
    pub shipping_options: Vec<ShippingOptionConfig>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
}

fn bson_to_prices(b: Option<&Bson>) -> Vec<PriceItem> {
    match b {
        Some(Bson::Array(arr)) => arr
            .iter()
            .filter_map(|v| {
                if let Bson::Document(d) = v {
                    Some(PriceItem {
                        label: d.get_str("label").unwrap_or("").to_owned(),
                        amount_cents: d
                            .get_i64("amountCents")
                            .or_else(|_| d.get_i32("amountCents").map(i64::from))
                            .unwrap_or(0),
                    })
                } else {
                    None
                }
            })
            .collect(),
        _ => vec![],
    }
}

fn bson_to_shipping_options(b: Option<&Bson>) -> Vec<ShippingOptionConfig> {
    match b {
        Some(Bson::Array(arr)) => arr
            .iter()
            .filter_map(|v| {
                if let Bson::Document(d) = v {
                    Some(ShippingOptionConfig {
                        id: d.get_str("id").unwrap_or("").to_owned(),
                        title: d.get_str("title").unwrap_or("").to_owned(),
                        prices: bson_to_prices(d.get("prices")),
                    })
                } else {
                    None
                }
            })
            .collect(),
        _ => vec![],
    }
}

fn template_doc_to_row(d: &Document) -> Option<TemplateRow> {
    Some(TemplateRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("").to_owned(),
        title: d.get_str("title").unwrap_or("").to_owned(),
        description: d.get_str("description").unwrap_or("").to_owned(),
        payload: d.get_str("payload").unwrap_or("").to_owned(),
        currency: d.get_str("currency").unwrap_or("XTR").to_owned(),
        prices: bson_to_prices(d.get("prices")),
        photo_url: d.get_str("photoUrl").ok().map(str::to_owned),
        need_name: d.get_bool("needName").unwrap_or(false),
        need_phone: d.get_bool("needPhone").unwrap_or(false),
        need_email: d.get_bool("needEmail").unwrap_or(false),
        need_shipping: d.get_bool("needShipping").unwrap_or(false),
        is_flexible: d.get_bool("isFlexible").unwrap_or(false),
        provider_id: d.get_object_id("providerId").ok().map(|o| o.to_hex()),
        shipping_options: bson_to_shipping_options(d.get("shippingOptions")),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListTemplatesResp {
    pub templates: Vec<TemplateRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_templates(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Query(q): Query<ProjectQuery>,
) -> Json<ListTemplatesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListTemplatesResp {
                templates: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListTemplatesResp {
                templates: vec![],
                error: Some(e),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(TEMPLATES)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListTemplatesResp {
                templates: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListTemplatesResp {
                templates: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    Json(ListTemplatesResp {
        templates: docs.iter().filter_map(template_doc_to_row).collect(),
        error: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertTemplateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub title: String,
    pub description: String,
    pub payload: String,
    pub currency: String,
    pub prices: Vec<PriceItem>,
    #[serde(default, rename = "photoUrl")]
    pub photo_url: Option<String>,
    #[serde(default, rename = "needName")]
    pub need_name: Option<bool>,
    #[serde(default, rename = "needPhone")]
    pub need_phone: Option<bool>,
    #[serde(default, rename = "needEmail")]
    pub need_email: Option<bool>,
    #[serde(default, rename = "needShipping")]
    pub need_shipping: Option<bool>,
    #[serde(default, rename = "isFlexible")]
    pub is_flexible: Option<bool>,
    #[serde(default, rename = "providerId")]
    pub provider_id: Option<String>,
    #[serde(default, rename = "shippingOptions")]
    pub shipping_options: Option<Vec<ShippingOptionConfig>>,
}

fn prices_to_bson(items: &[PriceItem]) -> Bson {
    Bson::Array(
        items
            .iter()
            .map(|p| {
                Bson::Document(doc! {
                    "label": &p.label,
                    "amountCents": p.amount_cents,
                })
            })
            .collect(),
    )
}

fn shipping_options_to_bson(items: &[ShippingOptionConfig]) -> Bson {
    Bson::Array(
        items
            .iter()
            .map(|o| {
                Bson::Document(doc! {
                    "id": &o.id,
                    "title": &o.title,
                    "prices": prices_to_bson(&o.prices),
                })
            })
            .collect(),
    )
}

fn build_template_set(
    body: &UpsertTemplateBody,
    project_oid: ObjectId,
) -> Result<Document, String> {
    if body.name.trim().is_empty() {
        return Err("name is required".to_owned());
    }
    if body.title.trim().is_empty() {
        return Err("title is required".to_owned());
    }
    if body.description.trim().is_empty() {
        return Err("description is required".to_owned());
    }
    if body.payload.trim().is_empty() {
        return Err("payload is required".to_owned());
    }
    if body.currency.trim().is_empty() {
        return Err("currency is required".to_owned());
    }
    if body.prices.is_empty() {
        return Err("at least one price line is required".to_owned());
    }
    let mut set = doc! {
        "projectId": project_oid,
        "name": body.name.trim(),
        "title": body.title.trim(),
        "description": body.description.trim(),
        "payload": body.payload.trim(),
        "currency": body.currency.trim(),
        "prices": prices_to_bson(&body.prices),
        "needName": body.need_name.unwrap_or(false),
        "needPhone": body.need_phone.unwrap_or(false),
        "needEmail": body.need_email.unwrap_or(false),
        "needShipping": body.need_shipping.unwrap_or(false),
        "isFlexible": body.is_flexible.unwrap_or(false),
        "shippingOptions": shipping_options_to_bson(
            body.shipping_options.as_deref().unwrap_or(&[]),
        ),
        "updatedAt": bson::DateTime::now(),
    };
    if let Some(u) = &body.photo_url {
        set.insert("photoUrl", u);
    }
    if let Some(p) = &body.provider_id {
        if let Some(oid) = parse_oid(p) {
            set.insert("providerId", oid);
        }
    }
    Ok(set)
}

pub async fn create_template(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Json(body): Json<UpsertTemplateBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let mut set = match build_template_set(&body, project_oid) {
        Ok(d) => d,
        Err(e) => return err(e),
    };
    set.insert("createdAt", bson::DateTime::now());
    match s
        .mongo
        .collection::<Document>(TEMPLATES)
        .insert_one(set)
        .await
    {
        Ok(r) => {
            let id = r
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                id: Some(id),
                message: Some("Template saved.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

pub async fn update_template(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Path(template_id): Path<String>,
    Json(body): Json<UpsertTemplateBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let tid = match parse_oid(&template_id) {
        Some(o) => o,
        None => return err("invalid template id"),
    };
    let set = match build_template_set(&body, project_oid) {
        Ok(d) => d,
        Err(e) => return err(e),
    };
    match s
        .mongo
        .collection::<Document>(TEMPLATES)
        .update_one(
            doc! { "_id": tid, "projectId": project_oid },
            doc! { "$set": set },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Template not found."),
        Ok(_) => ok_msg("Template updated."),
        Err(e) => err(format!("mongo: {e}")),
    }
}

pub async fn delete_template(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Path(template_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let tid = match parse_oid(&template_id) {
        Some(o) => o,
        None => return err("invalid template id"),
    };
    match s
        .mongo
        .collection::<Document>(TEMPLATES)
        .delete_one(doc! { "_id": tid, "projectId": project_oid })
        .await
    {
        Ok(r) if r.deleted_count == 0 => err("Template not found."),
        Ok(_) => ok_msg("Template deleted."),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ===========================================================================
//                  SEND INVOICE / CREATE INVOICE LINK
// ===========================================================================

#[derive(Debug, Clone, Deserialize, Default)]
pub struct InvoiceOverrides {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub payload: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub prices: Option<Vec<PriceItem>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendInvoiceBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "templateId")]
    pub template_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(default)]
    pub overrides: Option<InvoiceOverrides>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InvoiceLinkBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "templateId")]
    pub template_id: String,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub overrides: Option<InvoiceOverrides>,
}

/// Merge a template with overrides into the Telegram invoice payload.
fn build_invoice_payload(t: &TemplateRow, ov: Option<&InvoiceOverrides>) -> serde_json::Value {
    let title = ov
        .and_then(|o| o.title.clone())
        .unwrap_or_else(|| t.title.clone());
    let description = ov
        .and_then(|o| o.description.clone())
        .unwrap_or_else(|| t.description.clone());
    let payload = ov
        .and_then(|o| o.payload.clone())
        .unwrap_or_else(|| t.payload.clone());
    let currency = ov
        .and_then(|o| o.currency.clone())
        .unwrap_or_else(|| t.currency.clone());
    let prices_src: Vec<PriceItem> = ov
        .and_then(|o| o.prices.clone())
        .unwrap_or_else(|| t.prices.clone());
    let prices: Vec<serde_json::Value> = prices_src
        .iter()
        .map(|p| serde_json::json!({ "label": p.label, "amount": p.amount_cents }))
        .collect();
    let mut v = serde_json::json!({
        "title": title,
        "description": description,
        "payload": payload,
        "currency": currency,
        "prices": prices,
        "need_name": t.need_name,
        "need_phone_number": t.need_phone,
        "need_email": t.need_email,
        "need_shipping_address": t.need_shipping,
        "is_flexible": t.is_flexible,
    });
    if let Some(photo) = &t.photo_url {
        v["photo_url"] = serde_json::Value::String(photo.clone());
    }
    v
}

async fn lookup_provider_token(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    provider_id_hex: Option<&str>,
) -> Option<String> {
    let pid = parse_oid(provider_id_hex.unwrap_or(""))?;
    let d = mongo
        .collection::<Document>(PROVIDERS)
        .find_one(doc! { "_id": pid, "projectId": project_oid })
        .await
        .ok()
        .flatten()?;
    d.get_str("providerToken").ok().map(str::to_owned)
}

pub async fn send_invoice(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Json(body): Json<SendInvoiceBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let tid = match parse_oid(&body.template_id) {
        Some(o) => o,
        None => return err("invalid template id"),
    };
    let template_doc = match s
        .mongo
        .collection::<Document>(TEMPLATES)
        .find_one(doc! { "_id": tid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Template not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let template = match template_doc_to_row(&template_doc) {
        Some(t) => t,
        None => return err("Template is malformed."),
    };
    let bot = match require_bot_in_project(&s.mongo, project_oid, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_token = bot.get_str("token").unwrap_or("");
    if bot_token.is_empty() {
        return err("Bot token missing.");
    }

    let mut payload = build_invoice_payload(&template, body.overrides.as_ref());
    payload["chat_id"] = serde_json::Value::String(body.chat_id.clone());

    // Provider token required for non-XTR currencies.
    let currency = payload
        .get("currency")
        .and_then(|v| v.as_str())
        .unwrap_or("XTR")
        .to_owned();
    if currency != "XTR" {
        let pt =
            lookup_provider_token(&s.mongo, project_oid, template.provider_id.as_deref()).await;
        if let Some(tok) = pt {
            payload["provider_token"] = serde_json::Value::String(tok);
        } else {
            return err("Template has no provider token linked but currency is not XTR.");
        }
    }

    let url = format!("{TG_BASE}/bot{bot_token}/sendInvoice");
    let resp: serde_json::Value = match s.http.post(url).json(&payload).send().await {
        Ok(r) => match r.json().await {
            Ok(j) => j,
            Err(e) => return err(format!("decode: {e}")),
        },
        Err(e) => return err(format!("network: {e}")),
    };
    if !resp.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        let d = resp
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Telegram returned ok=false");
        return err(d.to_owned());
    }
    let message_id = resp
        .get("result")
        .and_then(|r| r.get("message_id"))
        .and_then(|v| v.as_i64());

    let bot_oid = bot
        .get_object_id("_id")
        .map_err(|_| "bot missing _id")
        .unwrap();
    let now = bson::DateTime::now();
    let mut doc_in = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "templateId": tid,
        "chatId": &body.chat_id,
        "title": &template.title,
        "currency": &currency,
        "amount": template.prices.iter().map(|p| p.amount_cents).sum::<i64>(),
        "payload": payload.get("payload").and_then(|v| v.as_str()).unwrap_or("").to_owned(),
        "status": "sent",
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(mid) = message_id {
        doc_in.insert("messageId", mid);
    }
    let inserted = s
        .mongo
        .collection::<Document>(INVOICES)
        .insert_one(doc_in)
        .await;
    let id = match inserted {
        Ok(r) => r
            .inserted_id
            .as_object_id()
            .map(|o| o.to_hex())
            .unwrap_or_default(),
        Err(e) => return err(format!("mongo: {e}")),
    };
    Json(AckResult {
        success: true,
        id: Some(id),
        message: Some("Invoice sent.".to_owned()),
        ..Default::default()
    })
}

pub async fn create_invoice_link(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Json(body): Json<InvoiceLinkBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let tid = match parse_oid(&body.template_id) {
        Some(o) => o,
        None => return err("invalid template id"),
    };
    let template_doc = match s
        .mongo
        .collection::<Document>(TEMPLATES)
        .find_one(doc! { "_id": tid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Template not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let template = match template_doc_to_row(&template_doc) {
        Some(t) => t,
        None => return err("Template is malformed."),
    };

    // For createInvoiceLink we still need a bot token; pick the bot
    // from the explicit `botId` if supplied, otherwise pick any bot in
    // the project (matching the convenience of the previous handler).
    let bot_doc = if let Some(b) = body.bot_id.as_deref() {
        match require_bot_in_project(&s.mongo, project_oid, b).await {
            Ok(d) => d,
            Err(e) => return err(e),
        }
    } else {
        match s
            .mongo
            .collection::<Document>(BOTS)
            .find_one(doc! { "projectId": project_oid })
            .await
        {
            Ok(Some(d)) => d,
            Ok(None) => return err("No bots found in this project."),
            Err(e) => return err(format!("mongo: {e}")),
        }
    };
    let bot_token = bot_doc.get_str("token").unwrap_or("");
    if bot_token.is_empty() {
        return err("Bot token missing.");
    }

    let mut payload = build_invoice_payload(&template, body.overrides.as_ref());
    let currency = payload
        .get("currency")
        .and_then(|v| v.as_str())
        .unwrap_or("XTR")
        .to_owned();
    if currency != "XTR" {
        if let Some(tok) =
            lookup_provider_token(&s.mongo, project_oid, template.provider_id.as_deref()).await
        {
            payload["provider_token"] = serde_json::Value::String(tok);
        } else {
            return err("Template has no provider token linked but currency is not XTR.");
        }
    }

    let url = format!("{TG_BASE}/bot{bot_token}/createInvoiceLink");
    let resp: serde_json::Value = match s.http.post(url).json(&payload).send().await {
        Ok(r) => match r.json().await {
            Ok(j) => j,
            Err(e) => return err(format!("decode: {e}")),
        },
        Err(e) => return err(format!("network: {e}")),
    };
    if !resp.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        let d = resp
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Telegram returned ok=false");
        return err(d.to_owned());
    }
    let invoice_link = resp
        .get("result")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();

    let bot_oid = bot_doc
        .get_object_id("_id")
        .map_err(|_| "bot missing _id")
        .unwrap();
    let now = bson::DateTime::now();
    let doc_in = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "templateId": tid,
        "title": &template.title,
        "currency": &currency,
        "amount": template.prices.iter().map(|p| p.amount_cents).sum::<i64>(),
        "payload": payload.get("payload").and_then(|v| v.as_str()).unwrap_or("").to_owned(),
        "invoiceLink": &invoice_link,
        "status": "link_created",
        "createdAt": now,
        "updatedAt": now,
    };
    let inserted = s
        .mongo
        .collection::<Document>(INVOICES)
        .insert_one(doc_in)
        .await;
    let id = match inserted {
        Ok(r) => r
            .inserted_id
            .as_object_id()
            .map(|o| o.to_hex())
            .unwrap_or_default(),
        Err(e) => return err(format!("mongo: {e}")),
    };
    Json(AckResult {
        success: true,
        id: Some(id),
        invoice_link: Some(invoice_link),
        message: Some("Invoice link created.".to_owned()),
        ..Default::default()
    })
}

// ===========================================================================
//                          INVOICES LIST
// ===========================================================================

#[derive(Debug, Clone, Serialize)]
pub struct InvoiceRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "templateId")]
    pub template_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "chatId")]
    pub chat_id: Option<String>,
    pub title: String,
    pub currency: String,
    pub amount: i64,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "invoiceLink")]
    pub invoice_link: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "messageId")]
    pub message_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "paymentId")]
    pub payment_id: Option<String>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
}

fn invoice_doc_to_row(d: &Document) -> Option<InvoiceRow> {
    Some(InvoiceRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        template_id: d.get_object_id("templateId").ok().map(|o| o.to_hex()),
        chat_id: d.get_str("chatId").ok().map(str::to_owned),
        title: d.get_str("title").unwrap_or("").to_owned(),
        currency: d.get_str("currency").unwrap_or("XTR").to_owned(),
        amount: d
            .get_i64("amount")
            .or_else(|_| d.get_i32("amount").map(i64::from))
            .unwrap_or(0),
        status: d.get_str("status").unwrap_or("draft").to_owned(),
        invoice_link: d.get_str("invoiceLink").ok().map(str::to_owned),
        message_id: d.get_i64("messageId").ok(),
        payment_id: d.get_object_id("paymentId").ok().map(|o| o.to_hex()),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
    })
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListInvoicesResp {
    pub invoices: Vec<InvoiceRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_invoices(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Query(q): Query<ProjectQuery>,
) -> Json<ListInvoicesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListInvoicesResp {
                invoices: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListInvoicesResp {
                invoices: vec![],
                error: Some(e),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(INVOICES)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .limit(500)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListInvoicesResp {
                invoices: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListInvoicesResp {
                invoices: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    Json(ListInvoicesResp {
        invoices: docs.iter().filter_map(invoice_doc_to_row).collect(),
        error: None,
    })
}

// ===========================================================================
//                              PAYMENTS
// ===========================================================================

#[derive(Debug, Clone, Serialize)]
pub struct PaymentRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "invoiceId")]
    pub invoice_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "templateId")]
    pub template_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "userId")]
    pub user_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    pub currency: String,
    pub amount: i64,
    pub status: String,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "telegramPaymentChargeId"
    )]
    pub telegram_payment_charge_id: Option<String>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "providerPaymentChargeId"
    )]
    pub provider_payment_charge_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "orderInfo")]
    pub order_info: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "shippingAddress")]
    pub shipping_address: Option<serde_json::Value>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
}

fn bson_to_json_value(b: Option<&Bson>) -> Option<serde_json::Value> {
    b.and_then(|v| serde_json::to_value(v.clone()).ok())
        .filter(|v| !v.is_null())
}

fn payment_doc_to_row(d: &Document) -> Option<PaymentRow> {
    Some(PaymentRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        invoice_id: d.get_object_id("invoiceId").ok().map(|o| o.to_hex()),
        template_id: d.get_object_id("templateId").ok().map(|o| o.to_hex()),
        chat_id: d.get_str("chatId").ok().map(str::to_owned),
        user_id: d.get_i64("userId").ok(),
        username: d.get_str("username").ok().map(str::to_owned),
        currency: d.get_str("currency").unwrap_or("XTR").to_owned(),
        amount: d
            .get_i64("amount")
            .or_else(|_| d.get_i32("amount").map(i64::from))
            .unwrap_or(0),
        status: d.get_str("status").unwrap_or("succeeded").to_owned(),
        telegram_payment_charge_id: d.get_str("telegramPaymentChargeId").ok().map(str::to_owned),
        provider_payment_charge_id: d.get_str("providerPaymentChargeId").ok().map(str::to_owned),
        payload: d.get_str("payload").ok().map(str::to_owned),
        order_info: bson_to_json_value(d.get("orderInfo")),
        shipping_address: bson_to_json_value(d.get("shippingAddress")),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListPaymentsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListPaymentsResp {
    pub payments: Vec<PaymentRow>,
    pub total: i64,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn parse_iso(s: &str) -> Option<bson::DateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| bson::DateTime::from_millis(d.timestamp_millis()))
}

fn build_payment_filter(project_oid: ObjectId, q: &ListPaymentsQuery) -> Document {
    let mut filter = doc! { "projectId": project_oid };
    if let Some(s) = q.status.as_deref().filter(|x| !x.is_empty()) {
        filter.insert("status", s);
    }
    if let Some(c) = q.currency.as_deref().filter(|x| !x.is_empty()) {
        filter.insert("currency", c);
    }
    let mut date_filter = Document::new();
    if let Some(f) = q.from.as_deref().and_then(parse_iso) {
        date_filter.insert("$gte", f);
    }
    if let Some(t) = q.to.as_deref().and_then(parse_iso) {
        date_filter.insert("$lte", t);
    }
    if !date_filter.is_empty() {
        filter.insert("createdAt", date_filter);
    }
    if let Some(s) = q.search.as_deref().filter(|x| !x.is_empty()) {
        // Match chatId, username, or telegramPaymentChargeId. ObjectId
        // search is not supported here; the user is expected to provide
        // a chat id or charge id.
        let or: Vec<Bson> = vec![
            Bson::Document(doc! { "chatId": { "$regex": s, "$options": "i" } }),
            Bson::Document(doc! { "username": { "$regex": s, "$options": "i" } }),
            Bson::Document(doc! { "telegramPaymentChargeId": { "$regex": s, "$options": "i" } }),
            Bson::Document(doc! { "userId": { "$eq": s.parse::<i64>().unwrap_or(-1) } }),
        ];
        filter.insert("$or", or);
    }
    filter
}

pub async fn list_payments(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Query(q): Query<ListPaymentsQuery>,
) -> Json<ListPaymentsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListPaymentsResp {
                payments: vec![],
                total: 0,
                page: 1,
                page_size: 50,
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListPaymentsResp {
                payments: vec![],
                total: 0,
                page: 1,
                page_size: 50,
                error: Some(e),
            });
        }
    };
    let filter = build_payment_filter(project_oid, &q);
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(50).clamp(1, 200);
    let skip = (page - 1) * page_size;

    let coll = s.mongo.collection::<Document>(PAYMENTS);
    let total = coll.count_documents(filter.clone()).await.unwrap_or(0) as i64;
    let cursor = match coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip as u64)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListPaymentsResp {
                payments: vec![],
                total: 0,
                page,
                page_size,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListPaymentsResp {
                payments: vec![],
                total: 0,
                page,
                page_size,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    Json(ListPaymentsResp {
        payments: docs.iter().filter_map(payment_doc_to_row).collect(),
        total,
        page,
        page_size,
        error: None,
    })
}

pub async fn get_payment(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Path(payment_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<serde_json::Value> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return Json(serde_json::json!({ "error": "projectId is required" })),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return Json(serde_json::json!({ "error": e })),
    };
    let pid = match parse_oid(&payment_id) {
        Some(o) => o,
        None => return Json(serde_json::json!({ "error": "invalid payment id" })),
    };
    let doc_opt = match s
        .mongo
        .collection::<Document>(PAYMENTS)
        .find_one(doc! { "_id": pid, "projectId": project_oid })
        .await
    {
        Ok(d) => d,
        Err(e) => return Json(serde_json::json!({ "error": format!("mongo: {e}") })),
    };
    match doc_opt.as_ref().and_then(payment_doc_to_row) {
        Some(row) => match serde_json::to_value(row) {
            Ok(v) => Json(serde_json::json!({ "payment": v })),
            Err(_) => Json(serde_json::json!({ "error": "serialize" })),
        },
        None => Json(serde_json::json!({ "error": "Payment not found." })),
    }
}

// ---------------------------------------------------------------------------
//  Refund
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct RefundPaymentBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

pub async fn refund_payment(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Path(payment_id): Path<String>,
    Json(body): Json<RefundPaymentBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let pid = match parse_oid(&payment_id) {
        Some(o) => o,
        None => return err("invalid payment id"),
    };
    let payment = match s
        .mongo
        .collection::<Document>(PAYMENTS)
        .find_one(doc! { "_id": pid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Payment not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let currency = payment.get_str("currency").unwrap_or("").to_owned();
    let charge_id = payment
        .get_str("telegramPaymentChargeId")
        .unwrap_or("")
        .to_owned();
    let user_tg_id = payment.get_i64("userId").ok();
    let bot_oid = match payment.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("Payment missing bot."),
    };

    // Stars refunds go through Telegram's `refundStarPayment`. Other
    // currencies are reconciled at the payment provider side — we mark
    // them refunded locally with a note.
    if currency == "XTR" {
        if charge_id.is_empty() || user_tg_id.is_none() {
            return err("Payment missing charge id or user id.");
        }
        let bot = match s
            .mongo
            .collection::<Document>(BOTS)
            .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
            .await
        {
            Ok(Some(d)) => d,
            Ok(None) => return err("Bot not found."),
            Err(e) => return err(format!("mongo: {e}")),
        };
        let token = bot.get_str("token").unwrap_or("");
        if token.is_empty() {
            return err("Bot token missing.");
        }
        let url = format!("{TG_BASE}/bot{token}/refundStarPayment");
        let payload = serde_json::json!({
            "user_id": user_tg_id.unwrap(),
            "telegram_payment_charge_id": charge_id,
        });
        let resp: serde_json::Value = match s.http.post(url).json(&payload).send().await {
            Ok(r) => match r.json().await {
                Ok(j) => j,
                Err(e) => return err(format!("decode: {e}")),
            },
            Err(e) => return err(format!("network: {e}")),
        };
        if !resp.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
            let d = resp
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("Telegram returned ok=false");
            return err(d.to_owned());
        }
    }

    let _ = s
        .mongo
        .collection::<Document>(PAYMENTS)
        .update_one(
            doc! { "_id": pid, "projectId": project_oid },
            doc! { "$set": {
                "status": "refunded",
                "refundNote": if currency == "XTR" { "Stars refunded via refundStarPayment" } else { "Marked refunded locally; reconcile at payment provider" },
                "refundedAt": bson::DateTime::now(),
                "updatedAt": bson::DateTime::now(),
            } },
        )
        .await;
    if !charge_id.is_empty() {
        let _ = s
            .mongo
            .collection::<Document>(INVOICES)
            .update_one(
                doc! {
                    "projectId": project_oid,
                    "paymentId": pid,
                },
                doc! { "$set": { "status": "refunded", "updatedAt": bson::DateTime::now() } },
            )
            .await;
    }
    ok_msg(if currency == "XTR" {
        "Refund issued."
    } else {
        "Marked as refunded locally. Reconcile at the payment provider."
    })
}

// ===========================================================================
//                              CSV export
// ===========================================================================

pub async fn export_csv(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Query(q): Query<ListPaymentsQuery>,
) -> Response {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return (StatusCode::BAD_REQUEST, "projectId is required").into_response(),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };
    let filter = build_payment_filter(project_oid, &q);
    let cursor = match s
        .mongo
        .collection::<Document>(PAYMENTS)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("mongo: {e}")).into_response();
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("mongo: {e}")).into_response();
        }
    };

    let mut body = String::from(
        "id,chat_id,user_id,username,currency,amount,status,telegram_payment_charge_id,provider_payment_charge_id,payload,created_at\n",
    );
    for d in docs.iter().filter_map(payment_doc_to_row) {
        body.push_str(&csv_escape(&d._id));
        body.push(',');
        body.push_str(&csv_escape(d.chat_id.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&d.user_id.map(|n| n.to_string()).unwrap_or_default());
        body.push(',');
        body.push_str(&csv_escape(d.username.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(&d.currency));
        body.push(',');
        body.push_str(&d.amount.to_string());
        body.push(',');
        body.push_str(&csv_escape(&d.status));
        body.push(',');
        body.push_str(&csv_escape(
            d.telegram_payment_charge_id.as_deref().unwrap_or(""),
        ));
        body.push(',');
        body.push_str(&csv_escape(
            d.provider_payment_charge_id.as_deref().unwrap_or(""),
        ));
        body.push(',');
        body.push_str(&csv_escape(d.payload.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&d.created_at.to_rfc3339());
        body.push('\n');
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=\"telegram-payments.csv\""),
    );
    (StatusCode::OK, headers, body).into_response()
}

// ===========================================================================
//                              Analytics
// ===========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct CurrencyTotal {
    pub currency: String,
    pub revenue: i64,
    pub count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct TemplateCount {
    #[serde(rename = "templateId")]
    pub template_id: String,
    pub title: String,
    pub count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct DayPoint {
    pub date: String,
    pub revenue: i64,
    pub count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AnalyticsResp {
    pub total: i64,
    pub successful: i64,
    pub pending: i64,
    pub refunded: i64,
    pub failed: i64,
    pub by_currency: Vec<CurrencyTotal>,
    pub top_templates: Vec<TemplateCount>,
    pub by_day: Vec<DayPoint>,
    #[serde(rename = "successRate")]
    pub success_rate: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct AnalyticsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

pub async fn analytics(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Query(q): Query<AnalyticsQuery>,
) -> Json<AnalyticsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(AnalyticsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let mut filter = doc! { "projectId": project_oid };
    let mut date_filter = Document::new();
    if let Some(f) = q.from.as_deref().and_then(parse_iso) {
        date_filter.insert("$gte", f);
    }
    if let Some(t) = q.to.as_deref().and_then(parse_iso) {
        date_filter.insert("$lte", t);
    }
    if !date_filter.is_empty() {
        filter.insert("createdAt", date_filter);
    }
    let cursor = match s.mongo.collection::<Document>(PAYMENTS).find(filter).await {
        Ok(c) => c,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    let mut by_currency: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    let mut by_template: BTreeMap<String, (String, i64)> = BTreeMap::new();
    let mut by_day_map: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    let mut total: i64 = 0;
    let mut successful: i64 = 0;
    let mut pending: i64 = 0;
    let mut refunded: i64 = 0;
    let mut failed: i64 = 0;

    for d in &docs {
        total += 1;
        let status = d.get_str("status").unwrap_or("");
        match status {
            "succeeded" => successful += 1,
            "pending" => pending += 1,
            "refunded" => refunded += 1,
            "failed" => failed += 1,
            _ => {}
        }
        let currency = d.get_str("currency").unwrap_or("XTR").to_owned();
        let amount = d
            .get_i64("amount")
            .or_else(|_| d.get_i32("amount").map(i64::from))
            .unwrap_or(0);
        if status == "succeeded" {
            let entry = by_currency.entry(currency.clone()).or_insert((0, 0));
            entry.0 += amount;
            entry.1 += 1;
        }
        if let Ok(tid) = d.get_object_id("templateId") {
            let title = d.get_str("title").unwrap_or("").to_owned();
            let entry = by_template.entry(tid.to_hex()).or_insert((title, 0));
            entry.1 += 1;
        }
        if let Ok(ts) = d.get_datetime("createdAt") {
            let ms = ts.timestamp_millis();
            if let Some(dt_) = Utc.timestamp_millis_opt(ms).single() {
                let day = dt_.format("%Y-%m-%d").to_string();
                let entry = by_day_map.entry(day).or_insert((0, 0));
                if status == "succeeded" {
                    entry.0 += amount;
                }
                entry.1 += 1;
            }
        }
    }

    let by_currency = by_currency
        .into_iter()
        .map(|(currency, (revenue, count))| CurrencyTotal {
            currency,
            revenue,
            count,
        })
        .collect::<Vec<_>>();
    let mut top_templates = by_template
        .into_iter()
        .map(|(template_id, (title, count))| TemplateCount {
            template_id,
            title,
            count,
        })
        .collect::<Vec<_>>();
    top_templates.sort_by(|a, b| b.count.cmp(&a.count));
    top_templates.truncate(5);

    let by_day = by_day_map
        .into_iter()
        .map(|(date, (revenue, count))| DayPoint {
            date,
            revenue,
            count,
        })
        .collect::<Vec<_>>();

    let success_rate = if total > 0 {
        (successful as f64) * 100.0 / (total as f64)
    } else {
        0.0
    };

    Json(AnalyticsResp {
        total,
        successful,
        pending,
        refunded,
        failed,
        by_currency,
        top_templates,
        by_day,
        success_rate,
        error: None,
    })
}
