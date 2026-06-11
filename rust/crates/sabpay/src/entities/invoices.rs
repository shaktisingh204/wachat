//! SabPay Invoices — `inv_…` objects. A merchant-issued bill with line items.
//!
//! An invoice is born `draft` (mutable / deletable), then `issue`d — which spins
//! a hosted-checkout payment session (its `shortUrl`) and fires `invoice.issued`.
//! It can be `cancel`led while issued-and-unpaid (fires `invoice.cancelled`), or
//! `expire`d by the cron once `expireBy` passes. `invoice.paid` is NOT fired
//! here: the finalize chokepoint (`finalize::mark_invoice_paid`) owns the paid
//! transition + the optional subscription-cycle credit, so a `subscription_cycle`
//! invoice never double-credits.
//!
//! `type` is either `"invoice"` (a one-off bill) or `"subscription_cycle"` (the
//! per-cycle bill a subscription emits). Mirrors the `orders` reference module:
//! DTOs → `doc_to_invoice` mapper → `{userId, mode}`-scoped store fns → handlers.
//! Routes are wired centrally in `lib.rs`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::ReturnDocument;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_to_clean_json, mongo::MongoHandle};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::dto::{CreatePaymentBody, CustomerIn};
use crate::ids::new_id;
use crate::store::{
    self, iso_opt, num_i64, str_opt, str_or, user_oid, validate_amount, validate_notes,
};
use crate::webhooks;

const COLL: &str = store::INVOICES;
const DEFAULT_NAME: &str = "My business";
const MAX_LINE_ITEMS: usize = 25;

/* ── DTOs ────────────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineItemOut {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub amount: i64,
    pub quantity: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceOut {
    pub id: String,
    pub mode: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_phone: Option<String>,
    pub line_items: Vec<LineItemOut>,
    pub amount: i64,
    pub currency: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expire_by: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_url: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issued_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paid_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineItemIn {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub amount: i64,
    #[serde(default = "default_quantity")]
    pub quantity: i64,
}

fn default_quantity() -> i64 {
    1
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceBody {
    #[serde(default)]
    pub customer_id: Option<String>,
    #[serde(default)]
    pub customer_name: Option<String>,
    #[serde(default)]
    pub customer_email: Option<String>,
    #[serde(default)]
    pub customer_phone: Option<String>,
    #[serde(default)]
    pub line_items: Vec<LineItemIn>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub notes: Option<Value>,
    #[serde(default)]
    pub expire_by: Option<String>,
    /// Set by the dashboard only implicitly; omitted defaults to merchant mode.
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInvoiceBody {
    #[serde(default)]
    pub customer_id: Option<String>,
    #[serde(default)]
    pub customer_name: Option<String>,
    #[serde(default)]
    pub customer_email: Option<String>,
    #[serde(default)]
    pub customer_phone: Option<String>,
    /// Replace the whole line-item set (recomputes `amount`).
    #[serde(default)]
    pub line_items: Option<Vec<LineItemIn>>,
    #[serde(default)]
    pub notes: Option<Value>,
    #[serde(default)]
    pub expire_by: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub before: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct InvoiceList {
    pub invoices: Vec<InvoiceOut>,
}

/* ── mapper ──────────────────────────────────────────────────────────────── */

fn doc_to_line_items(d: &Document) -> Vec<LineItemOut> {
    d.get_array("lineItems")
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_document())
                .map(|li| LineItemOut {
                    name: str_or(li, "name", ""),
                    description: str_opt(li, "description"),
                    amount: num_i64(li, "amount"),
                    quantity: {
                        let q = num_i64(li, "quantity");
                        if q < 1 { 1 } else { q }
                    },
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn doc_to_invoice(d: &Document) -> InvoiceOut {
    InvoiceOut {
        id: str_or(d, "invId", ""),
        mode: str_or(d, "mode", "test"),
        kind: str_or(d, "type", "invoice"),
        customer_id: str_opt(d, "customerId"),
        customer_name: str_opt(d, "customerName"),
        customer_email: str_opt(d, "customerEmail"),
        customer_phone: str_opt(d, "customerPhone"),
        line_items: doc_to_line_items(d),
        amount: num_i64(d, "amount"),
        currency: str_or(d, "currency", "INR"),
        notes: match d.get("notes") {
            Some(b) if !matches!(b, Bson::Null) => {
                let v = bson_to_clean_json(b.clone());
                if v.is_null() { None } else { Some(v) }
            }
            _ => None,
        },
        expire_by: iso_opt(d, "expireBy"),
        status: str_or(d, "status", "draft"),
        payment_id: str_opt(d, "paymentId"),
        subscription_id: str_opt(d, "subscriptionId"),
        short_url: str_opt(d, "shortUrl"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
        issued_at: iso_opt(d, "issuedAt"),
        paid_at: iso_opt(d, "paidAt"),
        cancelled_at: iso_opt(d, "cancelledAt"),
    }
}

/* ── line-item validation ────────────────────────────────────────────────── */

/// Validate + normalize line items, returning the BSON array to persist and the
/// computed total amount (sum of `amount * quantity`).
fn build_line_items(items: &[LineItemIn]) -> Result<(Vec<Bson>, i64)> {
    if items.is_empty() {
        return Err(ApiError::Validation(
            "An invoice needs at least one line item.".to_owned(),
        ));
    }
    if items.len() > MAX_LINE_ITEMS {
        return Err(ApiError::Validation(format!(
            "An invoice supports at most {MAX_LINE_ITEMS} line items."
        )));
    }
    let mut docs: Vec<Bson> = Vec::with_capacity(items.len());
    let mut total: i64 = 0;
    for it in items {
        let name: String = it.name.trim().chars().take(140).collect();
        if name.is_empty() {
            return Err(ApiError::Validation(
                "Each line item needs a name.".to_owned(),
            ));
        }
        if it.amount < 0 {
            return Err(ApiError::Validation(
                "Line item amount cannot be negative.".to_owned(),
            ));
        }
        if it.quantity < 1 {
            return Err(ApiError::Validation(
                "Line item quantity must be at least 1.".to_owned(),
            ));
        }
        let line_total = it
            .amount
            .checked_mul(it.quantity)
            .ok_or_else(|| ApiError::Validation("Line item total overflows.".to_owned()))?;
        total = total
            .checked_add(line_total)
            .ok_or_else(|| ApiError::Validation("Invoice total overflows.".to_owned()))?;
        let mut li = doc! {
            "name": &name,
            "amount": it.amount,
            "quantity": it.quantity,
        };
        if let Some(desc) = it.description.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            li.insert("description", desc.chars().take(300).collect::<String>());
        }
        docs.push(Bson::Document(li));
    }
    validate_amount(total)?;
    Ok((docs, total))
}

/* ── customer snapshot ───────────────────────────────────────────────────── */

/// Look up a customer in this {userId, mode} and snapshot its name/email/contact
/// onto a `$set` doc. Errors if the id does not resolve in the same mode.
async fn snapshot_customer(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    customer_id: &str,
    set: &mut Document,
) -> Result<()> {
    let cust = mongo
        .collection::<Document>(store::CUSTOMERS)
        .find_one(doc! { "customerId": customer_id, "userId": uid, "mode": mode })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.invoice.customer")))?
        .ok_or_else(|| ApiError::BadRequest(format!("No {mode}-mode customer \"{customer_id}\".")))?;
    set.insert("customerId", customer_id);
    if let Some(n) = str_opt(&cust, "name") {
        set.insert("customerName", n);
    }
    if let Some(e) = str_opt(&cust, "email") {
        set.insert("customerEmail", e);
    }
    if let Some(p) = str_opt(&cust, "contact") {
        set.insert("customerPhone", p);
    }
    Ok(())
}

/* ── store ───────────────────────────────────────────────────────────────── */

pub async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "invId": id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.invoice.get")))
}

/* ── handlers ────────────────────────────────────────────────────────────── */

pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<InvoiceList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let mut filter = doc! { "userId": uid, "mode": &mode };
    if let Some(s) = q.status.as_deref() {
        filter.insert("status", s);
    }
    if let Some(b) = q.before.as_deref() {
        filter.insert("createdAt", doc! { "$lt": b });
    }
    let cursor = mongo
        .collection::<Document>(COLL)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(q.limit.unwrap_or(50).clamp(1, 100))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.invoice.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.invoice.collect")))?;
    Ok(Json(InvoiceList {
        invoices: docs.iter().map(doc_to_invoice).collect(),
    }))
}

pub async fn create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateInvoiceBody>,
) -> Result<Json<InvoiceOut>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = match body.mode.as_deref() {
        Some(m @ ("test" | "live")) => m.to_owned(),
        _ => merchant.mode.clone(),
    };

    let currency = body.currency.as_deref().unwrap_or("INR").to_uppercase();
    if currency != "INR" {
        return Err(ApiError::BadRequest("Only INR is supported right now.".to_owned()));
    }
    let (line_items, amount) = build_line_items(&body.line_items)?;
    let notes = validate_notes(&body.notes)?;

    let inv_id = new_id("inv");
    let now = store::now_iso();
    let mut d = doc! {
        "_id": ObjectId::new(),
        "invId": &inv_id,
        "userId": uid,
        "mode": &mode,
        "type": "invoice",
        "status": "draft",
        "lineItems": Bson::Array(line_items),
        "amount": amount,
        "currency": &currency,
        "createdAt": &now,
        "updatedAt": &now,
    };

    // Customer: a customerId snapshots from the saved customer (same mode);
    // otherwise the raw name/email/phone fields are taken verbatim.
    if let Some(cid) = body.customer_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let mut snap = Document::new();
        snapshot_customer(&mongo, uid, &mode, cid, &mut snap).await?;
        for (k, v) in snap {
            d.insert(k, v);
        }
    } else {
        if let Some(n) = body.customer_name.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            d.insert("customerName", n.chars().take(140).collect::<String>());
        }
        if let Some(e) = body.customer_email.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            d.insert("customerEmail", e.chars().take(200).collect::<String>());
        }
        if let Some(p) = body.customer_phone.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            d.insert("customerPhone", p.chars().take(20).collect::<String>());
        }
    }
    if let Some(eb) = body.expire_by.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("expireBy", eb);
    }
    if let Some(n) = notes {
        d.insert("notes", n);
    }

    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.invoice.insert")))?;
    Ok(Json(doc_to_invoice(&d)))
}

pub async fn get_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<InvoiceOut>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No invoice \"{id}\".")))?;
    Ok(Json(doc_to_invoice(&d)))
}

pub async fn update_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateInvoiceBody>,
) -> Result<Json<InvoiceOut>> {
    let uid = user_oid(&user)?;
    let existing = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No invoice \"{id}\".")))?;
    if str_or(&existing, "status", "") != "draft" {
        return Err(ApiError::BadRequest(
            "Only draft invoices can be edited.".to_owned(),
        ));
    }
    let mode = str_or(&existing, "mode", "test");

    let notes = validate_notes(&body.notes)?;
    let mut set = doc! { "updatedAt": store::now_iso() };

    if let Some(items) = &body.line_items {
        let (line_items, amount) = build_line_items(items)?;
        set.insert("lineItems", Bson::Array(line_items));
        set.insert("amount", amount);
    }
    if let Some(cid) = body.customer_id.as_deref().map(str::trim) {
        if cid.is_empty() {
            set.insert("customerId", Bson::Null);
            set.insert("customerName", Bson::Null);
            set.insert("customerEmail", Bson::Null);
            set.insert("customerPhone", Bson::Null);
        } else {
            snapshot_customer(&mongo, uid, &mode, cid, &mut set).await?;
        }
    } else {
        for (key, value, cap) in [
            ("customerName", &body.customer_name, 140usize),
            ("customerEmail", &body.customer_email, 200),
            ("customerPhone", &body.customer_phone, 20),
        ] {
            if let Some(v) = value {
                let t = v.trim();
                if t.is_empty() {
                    set.insert(key, Bson::Null);
                } else {
                    set.insert(key, t.chars().take(cap).collect::<String>());
                }
            }
        }
    }
    if let Some(eb) = &body.expire_by {
        let t = eb.trim();
        if t.is_empty() {
            set.insert("expireBy", Bson::Null);
        } else {
            set.insert("expireBy", t);
        }
    }
    if let Some(n) = notes {
        set.insert("notes", n);
    }

    let res = mongo
        .collection::<Document>(COLL)
        .update_one(
            doc! { "invId": &id, "userId": uid, "status": "draft" },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.invoice.update")))?;
    if res.matched_count == 0 {
        return Err(ApiError::BadRequest(
            "Only draft invoices can be edited.".to_owned(),
        ));
    }
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No invoice \"{id}\".")))?;
    Ok(Json(doc_to_invoice(&d)))
}

pub async fn delete_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<crate::dto::Ack>> {
    let uid = user_oid(&user)?;
    let res = mongo
        .collection::<Document>(COLL)
        .delete_one(doc! { "invId": &id, "userId": uid, "status": "draft" })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.invoice.delete")))?;
    if res.deleted_count == 1 {
        return Ok(Json(crate::dto::Ack::ok()));
    }
    // Distinguish "not found" from "not a draft" for a clearer error.
    match get_doc(&mongo, uid, &id).await? {
        Some(_) => Err(ApiError::BadRequest(
            "Only draft invoices can be deleted.".to_owned(),
        )),
        None => Err(ApiError::NotFound(format!("No invoice \"{id}\"."))),
    }
}

/// `POST /invoices/{id}/issue` — draft → issued. Creates a hosted-checkout
/// payment session linked back to this invoice and stamps `shortUrl`. Fires
/// `invoice.issued`. The eventual `invoice.paid` fires from finalize.
pub async fn issue_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<InvoiceOut>> {
    let uid = user_oid(&user)?;
    let inv = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No invoice \"{id}\".")))?;
    if str_or(&inv, "status", "") != "draft" {
        return Err(ApiError::BadRequest(
            "Only draft invoices can be issued.".to_owned(),
        ));
    }
    let mode = str_or(&inv, "mode", "test");
    let amount = num_i64(&inv, "amount");
    validate_amount(amount)?;

    // Spin a payment session linked back to this invoice (so finalize marks it
    // paid). Prefill the customer snapshot the invoice already holds.
    let customer = match (
        str_opt(&inv, "customerName"),
        str_opt(&inv, "customerEmail"),
        str_opt(&inv, "customerPhone"),
    ) {
        (None, None, None) => None,
        (name, email, phone) => Some(CustomerIn { name, email, phone }),
    };
    let payment = store::create_payment(
        &mongo,
        uid,
        &mode,
        CreatePaymentBody {
            amount,
            currency: Some(str_or(&inv, "currency", "INR")),
            description: Some(format!("Invoice {id}")),
            customer,
            metadata: None,
            success_url: None,
            cancel_url: None,
            mode: Some(mode.clone()),
            order_id: None,
            customer_id: str_opt(&inv, "customerId"),
            payment_link_id: None,
            payment_page_id: None,
            invoice_id: Some(id.clone()),
            subscription_id: str_opt(&inv, "subscriptionId"),
            qr_code_id: None,
        },
    )
    .await?;

    let now = store::now_iso();
    let updated = mongo
        .collection::<Document>(COLL)
        .find_one_and_update(
            doc! { "invId": &id, "userId": uid, "status": "draft" },
            doc! { "$set": {
                "status": "issued",
                "issuedAt": &now,
                "shortUrl": &payment.checkout_url,
                "updatedAt": &now,
            }},
        )
        .return_document(ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.invoice.issue")))?
        .ok_or_else(|| ApiError::Conflict("This invoice is no longer a draft.".to_owned()))?;

    let out = doc_to_invoice(&updated);
    let value = serde_json::to_value(&out).unwrap_or(Value::Null);
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        "invoice.issued".to_owned(),
        "invoice",
        value,
        id.clone(),
        mode.clone(),
    ));
    Ok(Json(out))
}

/// `POST /invoices/{id}/cancel` — issued-and-unpaid → cancelled. Fires
/// `invoice.cancelled`.
pub async fn cancel_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<InvoiceOut>> {
    let uid = user_oid(&user)?;
    let now = store::now_iso();
    let updated = mongo
        .collection::<Document>(COLL)
        .find_one_and_update(
            doc! { "invId": &id, "userId": uid, "status": "issued" },
            doc! { "$set": {
                "status": "cancelled",
                "cancelledAt": &now,
                "updatedAt": &now,
            }},
        )
        .return_document(ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.invoice.cancel")))?;

    let updated = match updated {
        Some(d) => d,
        None => {
            // No issued doc matched — give a precise reason.
            let existing = get_doc(&mongo, uid, &id)
                .await?
                .ok_or_else(|| ApiError::NotFound(format!("No invoice \"{id}\".")))?;
            return Err(ApiError::BadRequest(format!(
                "Only issued, unpaid invoices can be cancelled (status is {}).",
                str_or(&existing, "status", "draft")
            )));
        }
    };

    let mode = str_or(&updated, "mode", "test");
    let out = doc_to_invoice(&updated);
    let value = serde_json::to_value(&out).unwrap_or(Value::Null);
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        "invoice.cancelled".to_owned(),
        "invoice",
        value,
        id.clone(),
        mode,
    ));
    Ok(Json(out))
}
