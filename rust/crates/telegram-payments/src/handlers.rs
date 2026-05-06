use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramPaymentsState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const INVOICES: &str = "telegram_invoices";

const TG_BASE: &str = "https://api.telegram.org";

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "invoiceId")]
    pub invoice_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "invoiceLink")]
    pub invoice_link: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InvoiceRow {
    pub _id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub title: String,
    pub description: String,
    pub currency: String,
    /// Total amount in the currency's smallest unit (e.g. cents, or Stars).
    pub amount: i64,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "invoiceLink")]
    pub invoice_link: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "telegramChargeId")]
    pub telegram_charge_id: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub invoices: Vec<InvoiceRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBody {
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub title: String,
    pub description: String,
    /// "XTR" for Telegram Stars, otherwise an ISO-4217 code.
    pub currency: String,
    pub amount: i64,
    /// Opaque payload echoed back in the SuccessfulPayment update.
    pub payload: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RefundBody {
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "userId")]
    pub user_id: i64,
    #[serde(rename = "telegramPaymentChargeId")]
    pub telegram_payment_charge_id: String,
}

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}
fn dt(o: Option<bson::DateTime>) -> chrono::DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}

async fn require_bot(
    user: &AuthUser,
    mongo: &MongoHandle,
    bot_id_hex: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id_hex).ok_or_else(|| "invalid bot id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    let project_oid = bot
        .get_object_id("projectId")
        .map_err(|_| "bot is missing projectId".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Bot not found.".to_owned());
    }
    Ok(bot)
}

fn doc_to_row(d: &Document) -> Option<InvoiceRow> {
    Some(InvoiceRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        title: d.get_str("title").unwrap_or("").to_owned(),
        description: d.get_str("description").unwrap_or("").to_owned(),
        currency: d.get_str("currency").unwrap_or("XTR").to_owned(),
        amount: d
            .get_i64("amount")
            .or_else(|_| d.get_i32("amount").map(i64::from))
            .unwrap_or(0),
        status: d.get_str("status").unwrap_or("draft").to_owned(),
        invoice_link: d.get_str("invoiceLink").ok().map(str::to_owned),
        telegram_charge_id: d.get_str("telegramChargeId").ok().map(str::to_owned),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
    })
}

// =========================================================================
//  GET /v1/telegram/payments?botId=…
// =========================================================================

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                invoices: vec![],
                error: Some("botId is required".to_owned()),
            });
        }
    };
    let bot = match require_bot(&user, &s.mongo, bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListResp {
                invoices: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListResp {
                invoices: vec![],
                error: Some("bot is malformed".to_owned()),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(INVOICES)
        .find(doc! { "botId": bot_oid })
        .sort(doc! { "createdAt": -1 })
        .limit(100)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                invoices: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                invoices: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let invoices = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp { invoices, error: None })
}

// =========================================================================
//  POST /v1/telegram/payments — createInvoiceLink
// =========================================================================

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Json(body): Json<CreateBody>,
) -> Json<AckResult> {
    if body.title.is_empty() || body.description.is_empty() || body.amount <= 0 {
        return err("title, description and a positive amount are required");
    }
    let bot = match require_bot(&user, &s.mongo, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let project_oid = match bot.get_object_id("projectId") {
        Ok(o) => o,
        Err(_) => return err("Bot is missing projectId."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing token."),
    };
    let provider_token = bot
        .get_str("paymentProviderToken")
        .ok()
        .map(str::to_owned)
        .unwrap_or_default();

    // For Telegram Stars (XTR) the provider_token must be empty.
    let url = format!("{TG_BASE}/bot{token}/createInvoiceLink");
    let mut payload = serde_json::json!({
        "title": body.title,
        "description": body.description,
        "payload": body.payload,
        "currency": body.currency,
        "prices": [{ "label": body.title, "amount": body.amount }],
    });
    if body.currency != "XTR" {
        payload["provider_token"] = serde_json::Value::String(provider_token);
    }

    let resp: serde_json::Value = match s
        .http
        .post(url)
        .json(&payload)
        .send()
        .await
        .and_then(|r| r.error_for_status())
    {
        Ok(r) => match r.json().await {
            Ok(j) => j,
            Err(e) => return err(format!("decode: {e}")),
        },
        Err(e) => return err(format!("network: {e}")),
    };

    if !resp
        .get("ok")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let desc = resp
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Telegram returned ok=false");
        return err(desc.to_owned());
    }
    let invoice_link = resp
        .get("result")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();

    let now = bson::DateTime::now();
    let doc = doc! {
        "botId": bot_oid,
        "projectId": project_oid,
        "title": &body.title,
        "description": &body.description,
        "currency": &body.currency,
        "amount": body.amount,
        "payload": &body.payload,
        "invoiceLink": &invoice_link,
        "status": "open",
        "createdAt": now,
        "updatedAt": now,
    };
    let res = match s.mongo.collection::<Document>(INVOICES).insert_one(doc).await {
        Ok(r) => r,
        Err(e) => return err(format!("mongo: {e}")),
    };
    let id = res
        .inserted_id
        .as_object_id()
        .map(|o| o.to_hex())
        .unwrap_or_default();

    Json(AckResult {
        success: true,
        invoice_id: Some(id),
        invoice_link: Some(invoice_link),
        message: Some("Invoice created.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  POST /v1/telegram/payments/refund — refundStarPayment
// =========================================================================

pub async fn refund(
    user: AuthUser,
    State(s): State<TelegramPaymentsState>,
    Json(body): Json<RefundBody>,
) -> Json<AckResult> {
    let bot = match require_bot(&user, &s.mongo, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing token."),
    };

    let url = format!("{TG_BASE}/bot{token}/refundStarPayment");
    let payload = serde_json::json!({
        "user_id": body.user_id,
        "telegram_payment_charge_id": body.telegram_payment_charge_id,
    });
    let resp: serde_json::Value = match s
        .http
        .post(url)
        .json(&payload)
        .send()
        .await
    {
        Ok(r) => match r.json().await {
            Ok(j) => j,
            Err(e) => return err(format!("decode: {e}")),
        },
        Err(e) => return err(format!("network: {e}")),
    };
    if !resp.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        let desc = resp
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Telegram returned ok=false");
        return err(desc.to_owned());
    }

    let _ = s
        .mongo
        .collection::<Document>(INVOICES)
        .update_one(
            doc! { "telegramChargeId": &body.telegram_payment_charge_id },
            doc! { "$set": { "status": "refunded", "updatedAt": bson::DateTime::now() } },
        )
        .await;

    Json(AckResult {
        success: true,
        message: Some("Refund issued.".to_owned()),
        ..Default::default()
    })
}
