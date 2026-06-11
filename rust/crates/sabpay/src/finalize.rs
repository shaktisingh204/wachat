//! The finalize chokepoint — every side effect of a payment turning
//! `succeeded` lives here, and NOWHERE else.
//!
//! `store::finalize_payment` is the only exactly-once transition (its
//! `status:"created"` filter). Both the simulate and the PayU-callback handlers
//! call [`after_finalize_success`] with the doc that transition returned, so a
//! PayU retry (which gets `None` from `finalize_payment`) never double-credits.
//!
//! Side effects: stamp the platform fee + tax, mark a linked order / payment
//! link / invoice paid, credit a QR code, advance a subscription cycle — each
//! firing its own webhook. Webhook payloads are the cleaned entity document
//! (camelCase, ISO strings already), with internal fields stripped, so this
//! module stays decoupled from the per-entity DTO mappers.

use bson::{Bson, Document, doc, oid::ObjectId};
use sabnode_common::Result;
use sabnode_db::{bson_to_clean_json, mongo::MongoHandle};
use serde_json::Value;

use crate::store::{self, num_i64, str_opt, str_or};
use crate::{fees, webhooks};

/// Public, merchant-facing JSON for an entity doc: drop Mongo/internal fields.
fn entity_json(doc: &Document) -> Value {
    let mut clone = doc.clone();
    for k in ["_id", "userId", "hash", "secret"] {
        clone.remove(k);
    }
    bson_to_clean_json(Bson::Document(clone))
}

fn spawn_event(
    mongo: &MongoHandle,
    uid: ObjectId,
    event: &str,
    object_type: &'static str,
    doc: &Document,
    object_id: String,
    mode: &str,
) {
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        event.to_owned(),
        object_type,
        entity_json(doc),
        object_id,
        mode.to_owned(),
    ));
}

/// Run all side effects for a payment that just became `succeeded`. Returns the
/// (fee-stamped) payment doc. A no-op for any non-succeeded doc.
pub async fn after_finalize_success(mongo: &MongoHandle, payment: &Document) -> Result<Document> {
    if str_or(payment, "status", "") != "succeeded" {
        return Ok(payment.clone());
    }
    let uid = match payment.get_object_id("userId") {
        Ok(u) => u,
        Err(_) => return Ok(payment.clone()),
    };
    let payment_id = str_or(payment, "paymentId", "");
    let amount = num_i64(payment, "amount");
    let mode = str_or(payment, "mode", "test");
    let pcoll = mongo.collection::<Document>(store::PAYMENTS);

    // 1. Stamp the platform fee + GST (idempotent: only when absent).
    if payment.get("fee").is_none() {
        let fee = fees::compute_for_user(mongo, uid, amount).await?;
        let _ = pcoll
            .update_one(
                doc! { "paymentId": &payment_id },
                doc! { "$set": { "fee": fee.fee, "tax": fee.tax, "updatedAt": store::now_iso() } },
            )
            .await;
    }

    // 2. Linked order → paid.
    if let Some(order_id) = str_opt(payment, "orderId") {
        mark_order_paid(mongo, uid, &order_id, amount, &mode).await;
    }
    // 3. Linked payment link → paid.
    if let Some(plink) = str_opt(payment, "paymentLinkId") {
        mark_link_paid(mongo, uid, &plink, &payment_id, &mode).await;
    }
    // 4. Linked invoice → paid (+ subscription cycle credit).
    if let Some(inv) = str_opt(payment, "invoiceId") {
        mark_invoice_paid(mongo, uid, &inv, &payment_id, &mode).await;
    }
    // 5. Linked QR → credited (single-use closes).
    if let Some(qr) = str_opt(payment, "qrCodeId") {
        credit_qr(mongo, uid, &qr, amount, &mode).await;
    }

    Ok(pcoll
        .find_one(doc! { "paymentId": &payment_id })
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| payment.clone()))
}

async fn mark_order_paid(mongo: &MongoHandle, uid: ObjectId, order_id: &str, amount: i64, mode: &str) {
    let coll = mongo.collection::<Document>(store::ORDERS);
    let now = store::now_iso();
    let res = coll
        .find_one_and_update(
            doc! { "orderId": order_id, "userId": uid, "status": { "$ne": "paid" } },
            doc! { "$set": { "status": "paid", "amountPaid": amount, "amountDue": 0_i64, "paidAt": &now, "updatedAt": &now } },
        )
        .await;
    if let Ok(Some(_)) = res {
        if let Ok(Some(updated)) = coll.find_one(doc! { "orderId": order_id }).await {
            spawn_event(mongo, uid, "order.paid", "order", &updated, order_id.to_owned(), mode);
        }
    }
}

async fn mark_link_paid(mongo: &MongoHandle, uid: ObjectId, plink: &str, payment_id: &str, mode: &str) {
    let coll = mongo.collection::<Document>(store::PAYMENT_LINKS);
    let now = store::now_iso();
    let res = coll
        .find_one_and_update(
            doc! { "plinkId": plink, "userId": uid, "status": "created" },
            doc! { "$set": { "status": "paid", "paymentId": payment_id, "paidAt": &now, "updatedAt": &now } },
        )
        .await;
    if let Ok(Some(_)) = res {
        if let Ok(Some(updated)) = coll.find_one(doc! { "plinkId": plink }).await {
            spawn_event(mongo, uid, "payment_link.paid", "paymentLink", &updated, plink.to_owned(), mode);
        }
    }
}

async fn mark_invoice_paid(mongo: &MongoHandle, uid: ObjectId, inv: &str, payment_id: &str, mode: &str) {
    let coll = mongo.collection::<Document>(store::INVOICES);
    let now = store::now_iso();
    let res = coll
        .find_one_and_update(
            doc! { "invId": inv, "userId": uid, "status": { "$in": ["issued", "draft"] } },
            doc! { "$set": { "status": "paid", "paymentId": payment_id, "paidAt": &now, "updatedAt": &now } },
        )
        .await;
    let Ok(Some(prev)) = res else { return };
    if let Ok(Some(updated)) = coll.find_one(doc! { "invId": inv }).await {
        spawn_event(mongo, uid, "invoice.paid", "invoice", &updated, inv.to_owned(), mode);
    }
    // Subscription cycle credit.
    if let Some(sub_id) = str_opt(&prev, "subscriptionId") {
        credit_subscription_cycle(mongo, uid, &sub_id, mode).await;
    }
}

async fn credit_subscription_cycle(mongo: &MongoHandle, uid: ObjectId, sub_id: &str, mode: &str) {
    let coll = mongo.collection::<Document>(store::SUBSCRIPTIONS);
    let now = store::now_iso();
    let res = coll
        .find_one_and_update(
            doc! { "subId": sub_id, "userId": uid },
            doc! {
                "$inc": { "paidCount": 1_i64 },
                "$set": { "missedCycles": 0_i64, "status": "active", "updatedAt": &now },
            },
        )
        .await;
    if let Ok(Some(_)) = res {
        if let Ok(Some(updated)) = coll.find_one(doc! { "subId": sub_id }).await {
            spawn_event(mongo, uid, "subscription.charged", "subscription", &updated, sub_id.to_owned(), mode);
            let paid = num_i64(&updated, "paidCount");
            let total = num_i64(&updated, "totalCount");
            if total > 0 && paid >= total {
                let _ = coll
                    .update_one(
                        doc! { "subId": sub_id },
                        doc! { "$set": { "status": "completed", "endedAt": &now, "updatedAt": &now } },
                    )
                    .await;
                if let Ok(Some(done)) = coll.find_one(doc! { "subId": sub_id }).await {
                    spawn_event(mongo, uid, "subscription.completed", "subscription", &done, sub_id.to_owned(), mode);
                }
            }
        }
    }
}

async fn credit_qr(mongo: &MongoHandle, uid: ObjectId, qr: &str, amount: i64, mode: &str) {
    let coll = mongo.collection::<Document>(store::QR_CODES);
    let now = store::now_iso();
    let res = coll
        .find_one_and_update(
            doc! { "qrId": qr, "userId": uid },
            doc! {
                "$inc": { "paymentsCountReceived": 1_i64, "paymentsAmountReceived": amount },
                "$set": { "updatedAt": &now },
            },
        )
        .await;
    let Ok(Some(prev)) = res else { return };
    // single-use QR auto-closes on first successful payment.
    if str_or(&prev, "usage", "multiple_use") == "single_use" {
        let _ = coll
            .update_one(
                doc! { "qrId": qr, "status": "active" },
                doc! { "$set": { "status": "closed", "closedAt": &now, "closeReason": "paid", "updatedAt": &now } },
            )
            .await;
    }
    if let Ok(Some(updated)) = coll.find_one(doc! { "qrId": qr }).await {
        spawn_event(mongo, uid, "qr_code.credited", "qrCode", &updated, qr.to_owned(), mode);
    }
}
