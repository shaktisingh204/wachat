use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_sales_types::Invoice;
use hmac::{Hmac, Mac};
use reqwest::Client;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tracing::{instrument, warn};

const INVOICES_COLL: &str = "crm_invoices";
const PAYMENTS_COLL: &str = "crm_payments";
const CREDENTIALS_COLL: &str = "crm_payment_gateway_credentials";
const PAYMENT_DETAILS_COLL: &str = "crm_invoice_payment_details";

#[derive(Serialize)]
pub struct CheckoutResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutRequest {
    pub success_url: String,
    pub cancel_url: String,
}

#[instrument(skip_all)]
pub async fn start_stripe_checkout(
    State(mongo): State<MongoHandle>,
    Path(hash): Path<String>,
    Json(payload): Json<CheckoutRequest>,
) -> Result<Json<CheckoutResponse>> {
    let coll = mongo.collection::<Invoice>(INVOICES_COLL);
    let invoice = coll
        .find_one(doc! { "publicHash": &hash })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("invoice not found".to_owned()))?;

    let user_id = invoice.identity.user_id;

    let payments_coll = mongo.collection::<Document>(PAYMENTS_COLL);
    let mut cursor = payments_coll
        .find(doc! { "invoice_id": invoice.identity.id, "userId": user_id, "status": "completed" })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut paid = 0.0;
    use futures::TryStreamExt;
    while let Some(p) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
    {
        // Some docs store amount as double, some as string... best effort here
        let amount = match p.get("amount") {
            Some(bson::Bson::Double(v)) => *v,
            Some(bson::Bson::Int32(v)) => *v as f64,
            Some(bson::Bson::Int64(v)) => *v as f64,
            _ => 0.0,
        };
        let refunded = match p.get("refunded_amount") {
            Some(bson::Bson::Double(v)) => *v,
            Some(bson::Bson::Int32(v)) => *v as f64,
            Some(bson::Bson::Int64(v)) => *v as f64,
            _ => 0.0,
        };
        paid += amount - refunded;
    }

    let due = invoice.totals.total - paid;
    if due <= 0.0 {
        return Ok(Json(CheckoutResponse {
            ok: false,
            session_url: None,
            error: Some("This invoice has no outstanding balance.".to_owned()),
        }));
    }

    let creds_coll = mongo.collection::<Document>(CREDENTIALS_COLL);
    let cred_doc = creds_coll
        .find_one(doc! { "userId": user_id, "gateway": "stripe", "is_active": true })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::BadRequest("Stripe gateway not configured.".to_owned()))?;

    let api_secret = cred_doc
        .get_str("api_secret")
        .ok()
        .map(String::from)
        .ok_or_else(|| ApiError::BadRequest("Stripe secret key not configured.".to_owned()))?;

    let client = Client::new();
    let amount_cents = (due * 100.0).round() as i64;

    let mut form = std::collections::HashMap::new();
    form.insert("mode".to_owned(), "payment".to_owned());
    form.insert(
        "line_items[0][price_data][currency]".to_owned(),
        invoice.currency.to_lowercase(),
    );
    form.insert(
        "line_items[0][price_data][product_data][name]".to_owned(),
        format!("Invoice {}", invoice.invoice_no),
    );
    form.insert(
        "line_items[0][price_data][unit_amount]".to_owned(),
        amount_cents.to_string(),
    );
    form.insert("line_items[0][quantity]".to_owned(), "1".to_owned());
    form.insert("success_url".to_owned(), payload.success_url);
    form.insert("cancel_url".to_owned(), payload.cancel_url);
    form.insert(
        "metadata[invoiceId]".to_owned(),
        invoice.identity.id.to_hex(),
    );
    form.insert("metadata[invoiceHash]".to_owned(), hash);
    form.insert("metadata[tenantId]".to_owned(), user_id.to_hex());

    let res = client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .bearer_auth(api_secret)
        .form(&form)
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("Stripe request")))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        warn!("Stripe checkout failed: {}", err_text);
        return Err(ApiError::Internal(anyhow::anyhow!("Stripe API error")));
    }

    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let url = data.get("url").and_then(|u| u.as_str()).map(String::from);

    if url.is_none() {
        return Err(ApiError::Internal(anyhow::anyhow!(
            "Stripe did not return a checkout URL"
        )));
    }

    Ok(Json(CheckoutResponse {
        ok: true,
        session_url: url,
        error: None,
    }))
}

use axum::body::Bytes;

#[derive(Serialize)]
pub struct WebhookResponse {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[instrument(skip_all)]
pub async fn stripe_webhook(
    State(mongo): State<MongoHandle>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<WebhookResponse>> {
    let signature = match headers.get("stripe-signature") {
        Some(val) => val.to_str().unwrap_or("").to_string(),
        None => return Err(ApiError::BadRequest("Missing signature".to_owned())),
    };

    let raw_body = match std::str::from_utf8(&body) {
        Ok(v) => v,
        Err(_) => return Err(ApiError::BadRequest("Invalid UTF-8".to_owned())),
    };

    let event: serde_json::Value = match serde_json::from_str(raw_body) {
        Ok(v) => v,
        Err(_) => return Err(ApiError::BadRequest("Invalid JSON".to_owned())),
    };

    let tenant_id_str = event
        .pointer("/data/object/metadata/tenantId")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if tenant_id_str.is_empty() {
        return Ok(Json(WebhookResponse {
            status: "ignored".to_owned(),
            error: None,
        }));
    }

    let tenant_oid = match sabnode_db::bson_helpers::oid_from_str(tenant_id_str) {
        Ok(oid) => oid,
        Err(_) => {
            return Ok(Json(WebhookResponse {
                status: "ignored".to_owned(),
                error: None,
            }));
        }
    };

    let creds_coll = mongo.collection::<Document>(CREDENTIALS_COLL);
    let cred_doc = creds_coll
        .find_one(doc! { "userId": tenant_oid, "gateway": "stripe" })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::BadRequest("Unknown tenant".to_owned()))?;

    let webhook_secret = cred_doc
        .get_str("webhook_secret")
        .ok()
        .map(String::from)
        .ok_or_else(|| {
            ApiError::BadRequest("Stripe webhook secret not configured for tenant.".to_owned())
        })?;

    // Verify signature
    verify_stripe_signature(&signature, raw_body, &webhook_secret, 300)
        .map_err(|e| ApiError::BadRequest(format!("Bad signature: {}", e)))?;

    let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");

    if event_type == "checkout.session.completed" {
        let object = event
            .pointer("/data/object")
            .unwrap_or(&serde_json::Value::Null);

        let invoice_id_str = object
            .pointer("/metadata/invoiceId")
            .and_then(|v| v.as_str());
        let invoice_hash = object
            .pointer("/metadata/invoiceHash")
            .and_then(|v| v.as_str());

        let amount_total = object
            .get("amount_total")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            / 100.0;
        let currency = object
            .get("currency")
            .and_then(|v| v.as_str())
            .unwrap_or("usd")
            .to_uppercase();

        let payment_intent = object
            .get("payment_intent")
            .and_then(|v| {
                if v.is_string() {
                    v.as_str()
                } else if v.is_object() {
                    v.get("id").and_then(|id| id.as_str())
                } else {
                    None
                }
            })
            .or_else(|| object.get("id").and_then(|id| id.as_str()))
            .unwrap_or("");

        if amount_total > 0.0 && (invoice_id_str.is_some() || invoice_hash.is_some()) {
            record_gateway_payment(
                &mongo,
                invoice_hash,
                invoice_id_str,
                tenant_oid,
                amount_total,
                currency,
                "stripe",
                payment_intent,
                &format!(
                    "Stripe session {}",
                    object.get("id").and_then(|id| id.as_str()).unwrap_or("")
                ),
            )
            .await?;
        }
    }

    Ok(Json(WebhookResponse {
        status: "ok".to_owned(),
        error: None,
    }))
}

fn verify_stripe_signature(
    header: &str,
    raw_body: &str,
    secret: &str,
    tolerance_seconds: i64,
) -> Result<()> {
    let mut timestamp: Option<&str> = None;
    let mut v1_sigs: Vec<&str> = Vec::new();
    for pair in header.split(',') {
        let mut it = pair.splitn(2, '=');
        match (it.next(), it.next()) {
            (Some("t"), Some(v)) => timestamp = Some(v.trim()),
            (Some("v1"), Some(v)) => v1_sigs.push(v.trim()),
            _ => {}
        }
    }

    let ts = timestamp.ok_or_else(|| {
        ApiError::BadRequest("Stripe-Signature header missing `t=` timestamp".into())
    })?;
    if v1_sigs.is_empty() {
        return Err(ApiError::BadRequest(
            "Stripe-Signature header missing `v1=` digest".into(),
        ));
    }

    if let Ok(ts_num) = ts.parse::<i64>() {
        let now = chrono::Utc::now().timestamp();
        if (now - ts_num).abs() > tolerance_seconds {
            return Err(ApiError::BadRequest(format!(
                "Stripe webhook timestamp outside tolerance ({tolerance_seconds}s)"
            )));
        }
    }

    let signed_payload = format!("{ts}.{raw_body}");
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .map_err(|e| ApiError::BadRequest(format!("invalid HMAC key: {e}")))?;
    mac.update(signed_payload.as_bytes());
    let expected = mac.finalize().into_bytes();
    let expected_hex = hex::encode(expected);

    for candidate in v1_sigs {
        if constant_time_eq_str(candidate, &expected_hex) {
            return Ok(());
        }
    }
    Err(ApiError::BadRequest(
        "Stripe-Signature v1 digest did not match HMAC-SHA256(secret, t.body)".into(),
    ))
}

fn constant_time_eq_str(a: &str, b: &str) -> bool {
    let ab = a.as_bytes();
    let bb = b.as_bytes();
    if ab.len() != bb.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in ab.iter().zip(bb.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

async fn record_gateway_payment(
    mongo: &MongoHandle,
    hash: Option<&str>,
    invoice_id_str: Option<&str>,
    tenant_oid: ObjectId,
    amount: f64,
    currency: String,
    gateway: &str,
    transaction_id: &str,
    remarks: &str,
) -> Result<()> {
    let invoices_coll = mongo.collection::<Document>(INVOICES_COLL);

    let mut filter = doc! { "userId": tenant_oid };
    if let Some(h) = hash {
        filter.insert("publicHash", h);
    } else if let Some(i) = invoice_id_str {
        if let Ok(oid) = sabnode_db::bson_helpers::oid_from_str(i) {
            filter.insert("_id", oid);
        }
    }

    let invoice = match invoices_coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
    {
        Some(doc) => doc,
        None => return Err(ApiError::NotFound("Invoice not found".to_owned())),
    };

    let invoice_id = invoice
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("Invoice has no _id")))?;

    let payments_coll = mongo.collection::<Document>(PAYMENTS_COLL);
    if !transaction_id.is_empty() {
        let dupe = payments_coll
            .find_one(doc! {
                "userId": tenant_oid,
                "invoice_id": invoice_id,
                "transaction_id": transaction_id,
            })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
        if dupe.is_some() {
            return Ok(()); // already recorded
        }
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let payment_doc = doc! {
        "userId": tenant_oid,
        "invoice_id": invoice_id,
        "invoice_number": invoice.get_str("invoiceNo").or_else(|_| invoice.get_str("invoiceNumber")).unwrap_or(""),
        "client_id": invoice.get_object_id("clientId").ok().or_else(|| invoice.get_object_id("accountId").ok()),
        "client_name": invoice.get_str("clientName").or_else(|_| invoice.get_str("accountName")).unwrap_or(""),
        "amount": amount,
        "currency": currency,
        "paid_on": now,
        "transaction_id": transaction_id,
        "gateway": gateway,
        "status": "completed",
        "remarks": remarks,
        "createdAt": now,
        "updatedAt": now,
    };

    let res = payments_coll
        .insert_one(payment_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let payment_id = res.inserted_id.as_object_id().unwrap_or_else(ObjectId::new);

    let total = invoice
        .get_f64("total")
        .or_else(|_| {
            invoice
                .get_document("totals")
                .and_then(|t| t.get_f64("total"))
        })
        .unwrap_or(0.0);

    let mut cursor = payments_coll
        .find(doc! {
            "userId": tenant_oid,
            "invoice_id": invoice_id,
            "status": "completed",
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut paid = 0.0;
    use futures::TryStreamExt;
    while let Some(p) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
    {
        let amt = match p.get("amount") {
            Some(bson::Bson::Double(v)) => *v,
            Some(bson::Bson::Int32(v)) => *v as f64,
            Some(bson::Bson::Int64(v)) => *v as f64,
            _ => 0.0,
        };
        let refunded = match p.get("refunded_amount") {
            Some(bson::Bson::Double(v)) => *v,
            Some(bson::Bson::Int32(v)) => *v as f64,
            Some(bson::Bson::Int64(v)) => *v as f64,
            _ => 0.0,
        };
        paid += amt - refunded;
    }

    let remaining = (total - paid).max(0.0);
    let new_status = if paid <= 0.0 {
        "draft"
    } else if paid < total {
        "partially_paid"
    } else {
        "paid"
    };

    let payment_status = if paid >= total { 1 } else { 0 };

    invoices_coll
        .update_one(
            doc! { "_id": invoice_id },
            doc! {
                "$set": {
                    "status": new_status,
                    "amount_paid": paid,
                    "balance": remaining,
                    "payment_status": payment_status,
                    "updatedAt": now,
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let details_coll = mongo.collection::<Document>(PAYMENT_DETAILS_COLL);
    details_coll
        .insert_one(doc! {
            "userId": tenant_oid,
            "invoice_id": invoice_id,
            "payment_id": payment_id,
            "amount_paid": amount,
            "remaining_balance": remaining,
            "recorded_at": now,
            "createdAt": now,
            "updatedAt": now,
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(())
}
