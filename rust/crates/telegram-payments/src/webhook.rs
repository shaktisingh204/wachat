//! Telegram webhook entry points for payments.
//!
//! These are NOT routed by this crate — the `telegram-webhooks` crate
//! owns the public webhook surface. The functions here are deliberately
//! callable so that update dispatcher can invoke them when it sees a
//! `pre_checkout_query`, `shipping_query`, or `message.successful_payment`.
//!
//! Each function is project-scoped via the bot record's `projectId` —
//! webhooks themselves are not authenticated as a user, so the bot's
//! ownership chain is what enforces tenancy.
//!
//! Follow-up: wire these into the `telegram-webhooks` dispatcher when
//! the dispatcher's update routing surface is finalized.

use bson::{Bson, Document, doc};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;

use crate::handlers::{BOTS, INVOICES, PAYMENTS, TEMPLATES, TG_BASE};

/// Auto-answer a Telegram `pre_checkout_query` update.
///
/// `ok=true` unless the template explicitly marks itself as flexible
/// with validation (currently a stub — extend with cart validation
/// logic when the SabFlow integration lands).
pub async fn answer_pre_checkout(
    mongo: &MongoHandle,
    http: &reqwest::Client,
    update: &Value,
) -> Result<bool, String> {
    let pcq = update
        .get("pre_checkout_query")
        .ok_or_else(|| "update is not a pre_checkout_query".to_owned())?;
    let id = pcq
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "missing pre_checkout_query.id".to_owned())?;
    let payload = pcq
        .get("invoice_payload")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let bot_id_in_update = pcq
        .get("bot")
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_i64());

    // Look up the bot the update belongs to. We try the Telegram bot
    // id (numeric, stored as `botId`) first; the update doesn't carry
    // a project id directly.
    let bot = match bot_id_in_update {
        Some(num) => mongo
            .collection::<Document>(BOTS)
            .find_one(doc! { "botId": num })
            .await
            .map_err(|e| format!("mongo: {e}"))?,
        None => None,
    };
    let Some(bot) = bot else {
        return Err("bot not resolved for pre_checkout_query".to_owned());
    };
    let token = bot
        .get_str("token")
        .map_err(|_| "bot missing token".to_owned())?
        .to_owned();

    // If the invoice_payload matches a flexible template that requires
    // validation, defer to the operator; otherwise auto-OK.
    let mut ok = true;
    let mut error_message: Option<String> = None;
    if !payload.is_empty() {
        if let Ok(Some(tpl)) = mongo
            .collection::<Document>(TEMPLATES)
            .find_one(doc! { "payload": payload })
            .await
        {
            let flexible = tpl.get_bool("isFlexible").unwrap_or(false);
            let requires_validation = tpl.get_bool("requiresValidation").unwrap_or(false);
            if flexible && requires_validation {
                ok = false;
                error_message = Some("Cart validation pending. Please retry shortly.".to_owned());
            }
        }
    }

    let mut body = serde_json::json!({
        "pre_checkout_query_id": id,
        "ok": ok,
    });
    if let Some(m) = error_message {
        body["error_message"] = Value::String(m);
    }
    let url = format!("{TG_BASE}/bot{token}/answerPreCheckoutQuery");
    let resp: Value = http
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network: {e}"))?
        .json()
        .await
        .map_err(|e| format!("decode: {e}"))?;
    Ok(resp.get("ok").and_then(|v| v.as_bool()).unwrap_or(false))
}

/// Auto-answer a Telegram `shipping_query` update, sourcing shipping
/// options from the matching invoice template.
pub async fn answer_shipping(
    mongo: &MongoHandle,
    http: &reqwest::Client,
    update: &Value,
) -> Result<bool, String> {
    let sq = update
        .get("shipping_query")
        .ok_or_else(|| "update is not a shipping_query".to_owned())?;
    let id = sq
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "missing shipping_query.id".to_owned())?;
    let payload = sq
        .get("invoice_payload")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let bot_id_in_update = sq
        .get("bot")
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_i64());

    let bot = match bot_id_in_update {
        Some(num) => mongo
            .collection::<Document>(BOTS)
            .find_one(doc! { "botId": num })
            .await
            .map_err(|e| format!("mongo: {e}"))?,
        None => None,
    };
    let Some(bot) = bot else {
        return Err("bot not resolved for shipping_query".to_owned());
    };
    let token = bot
        .get_str("token")
        .map_err(|_| "bot missing token".to_owned())?
        .to_owned();

    let mut shipping_options: Vec<Value> = Vec::new();
    if let Ok(Some(tpl)) = mongo
        .collection::<Document>(TEMPLATES)
        .find_one(doc! { "payload": payload })
        .await
    {
        if let Ok(arr) = tpl.get_array("shippingOptions") {
            for opt in arr {
                if let Bson::Document(d) = opt {
                    let id = d.get_str("id").unwrap_or("").to_owned();
                    let title = d.get_str("title").unwrap_or("").to_owned();
                    let mut prices: Vec<Value> = Vec::new();
                    if let Ok(pa) = d.get_array("prices") {
                        for p in pa {
                            if let Bson::Document(pd) = p {
                                let lbl = pd.get_str("label").unwrap_or("").to_owned();
                                let amt = pd
                                    .get_i64("amountCents")
                                    .or_else(|_| pd.get_i32("amountCents").map(i64::from))
                                    .unwrap_or(0);
                                prices.push(serde_json::json!({ "label": lbl, "amount": amt }));
                            }
                        }
                    }
                    shipping_options.push(serde_json::json!({
                        "id": id,
                        "title": title,
                        "prices": prices,
                    }));
                }
            }
        }
    }

    let body = if shipping_options.is_empty() {
        serde_json::json!({
            "shipping_query_id": id,
            "ok": false,
            "error_message": "Shipping is not available for this order.",
        })
    } else {
        serde_json::json!({
            "shipping_query_id": id,
            "ok": true,
            "shipping_options": shipping_options,
        })
    };
    let url = format!("{TG_BASE}/bot{token}/answerShippingQuery");
    let resp: Value = http
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network: {e}"))?
        .json()
        .await
        .map_err(|e| format!("decode: {e}"))?;
    Ok(resp.get("ok").and_then(|v| v.as_bool()).unwrap_or(false))
}

/// Persist a completed payment from a Telegram `successful_payment`
/// update, then flip the matching invoice record to `paid`.
pub async fn mark_successful_payment(
    mongo: &MongoHandle,
    update: &Value,
) -> Result<String, String> {
    let msg = update
        .get("message")
        .ok_or_else(|| "update has no message".to_owned())?;
    let sp = msg
        .get("successful_payment")
        .ok_or_else(|| "message has no successful_payment".to_owned())?;
    let chat = msg.get("chat").cloned().unwrap_or(Value::Null);
    let chat_id = chat
        .get("id")
        .and_then(|v| v.as_i64())
        .map(|i| i.to_string())
        .or_else(|| chat.get("id").and_then(|v| v.as_str()).map(String::from))
        .unwrap_or_default();
    let from = msg.get("from").cloned().unwrap_or(Value::Null);
    let user_id = from.get("id").and_then(|v| v.as_i64());
    let username = from
        .get("username")
        .and_then(|v| v.as_str())
        .map(String::from);

    let currency = sp
        .get("currency")
        .and_then(|v| v.as_str())
        .unwrap_or("XTR")
        .to_owned();
    let amount = sp.get("total_amount").and_then(|v| v.as_i64()).unwrap_or(0);
    let payload = sp
        .get("invoice_payload")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();
    let tpcid = sp
        .get("telegram_payment_charge_id")
        .and_then(|v| v.as_str())
        .map(String::from);
    let ppcid = sp
        .get("provider_payment_charge_id")
        .and_then(|v| v.as_str())
        .map(String::from);
    let order_info = sp.get("order_info").cloned();
    let shipping_address = order_info
        .as_ref()
        .and_then(|v| v.get("shipping_address"))
        .cloned();

    // Resolve the bot from the receiving chat's bot id. The update
    // schema doesn't carry `bot.id` here, so we match the invoice on
    // the payload (set by sender) to recover the bot/project.
    let invoice = mongo
        .collection::<Document>(INVOICES)
        .find_one(doc! { "payload": &payload })
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    let (project_oid, bot_oid, template_oid, invoice_id) = match invoice.as_ref() {
        Some(d) => (
            d.get_object_id("projectId").ok(),
            d.get_object_id("botId").ok(),
            d.get_object_id("templateId").ok(),
            d.get_object_id("_id").ok(),
        ),
        None => (None, None, None, None),
    };
    let (Some(project_oid), Some(bot_oid)) = (project_oid, bot_oid) else {
        return Err("could not resolve invoice for successful_payment".to_owned());
    };

    let now = bson::DateTime::now();
    let mut doc_in = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "chatId": &chat_id,
        "currency": &currency,
        "amount": amount,
        "payload": &payload,
        "status": "succeeded",
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(tid) = template_oid {
        doc_in.insert("templateId", tid);
    }
    if let Some(iid) = invoice_id {
        doc_in.insert("invoiceId", iid);
    }
    if let Some(uid) = user_id {
        doc_in.insert("userId", uid);
    }
    if let Some(u) = username {
        doc_in.insert("username", u);
    }
    if let Some(t) = tpcid {
        doc_in.insert("telegramPaymentChargeId", t);
    }
    if let Some(p) = ppcid {
        doc_in.insert("providerPaymentChargeId", p);
    }
    if let Some(oi) = order_info {
        if let Ok(b) = bson::to_bson(&oi) {
            doc_in.insert("orderInfo", b);
        }
    }
    if let Some(sa) = shipping_address {
        if let Ok(b) = bson::to_bson(&sa) {
            doc_in.insert("shippingAddress", b);
        }
    }

    let inserted = mongo
        .collection::<Document>(PAYMENTS)
        .insert_one(doc_in)
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    let payment_oid = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| "could not read inserted id".to_owned())?;

    if let Some(iid) = invoice_id {
        let _ = mongo
            .collection::<Document>(INVOICES)
            .update_one(
                doc! { "_id": iid },
                doc! { "$set": {
                    "status": "paid",
                    "paymentId": payment_oid,
                    "updatedAt": bson::DateTime::now(),
                } },
            )
            .await;
    }

    Ok(payment_oid.to_hex())
}
