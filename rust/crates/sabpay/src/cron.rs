//! Internal cron handlers (settlement runner, subscription cycles, expiry
//! sweep). Mounted at `/v1/sabpay/internal/cron/*` and self-guarded by an
//! `x-cron-secret` header matching `CRON_SECRET` (the router has no global auth
//! layer). The Next.js `/api/cron/sabpay-*` proxies forward the secret.
//!
//! Each runner is dry-run by default; pass `?execute=1` to perform writes.

use axum::{
    Json,
    extract::{Query, State},
    http::HeaderMap,
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{Duration, Months, SecondsFormat, Utc};
use futures::TryStreamExt;
use mongodb::{IndexModel, options::IndexOptions, options::ReturnDocument};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_to_clean_json, mongo::MongoHandle};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::ids::new_id;
use crate::store::{self, num_i64, str_opt, str_or};
use crate::{finalize, webhooks};

const SETTLEMENT_HOLD_DAYS: i64 = 2; // T+2
const MERCHANT_CAP: usize = 500;
const SUBSCRIPTION_CAP: usize = 200;
const HALT_AFTER_MISSED: i64 = 3;

#[derive(Debug, Deserialize)]
pub struct CronQuery {
    #[serde(default)]
    pub execute: Option<String>,
}

fn is_execute(q: &CronQuery) -> bool {
    matches!(q.execute.as_deref(), Some("1" | "true" | "yes"))
}

/// 503 when `CRON_SECRET` is unset, 401 on mismatch.
fn cron_guard(headers: &HeaderMap) -> Result<()> {
    let expected = std::env::var("CRON_SECRET")
        .ok()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("CRON_SECRET not configured")))?;
    let got = headers
        .get("x-cron-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if got != expected {
        return Err(ApiError::Unauthorized("Invalid cron secret.".to_owned()));
    }
    Ok(())
}

/// Public, merchant-facing JSON for an entity doc (drop internal fields).
fn entity_json(doc: &Document) -> Value {
    let mut clone = doc.clone();
    for k in ["_id", "userId", "hash", "secret"] {
        clone.remove(k);
    }
    bson_to_clean_json(bson::Bson::Document(clone))
}

fn spawn_event(mongo: &MongoHandle, uid: ObjectId, event: &str, object_type: &'static str, doc: &Document, object_id: String, mode: &str) {
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

/// Idempotently create the indexes the runners + idempotency layer rely on.
/// Mongo `create_index` is a no-op when the index already exists.
async fn ensure_indexes(mongo: &MongoHandle) {
    // Unique per-merchant-per-day settlement (double-run guard).
    let _ = mongo
        .collection::<Document>(store::SETTLEMENTS)
        .create_index(
            IndexModel::builder()
                .keys(doc! { "userId": 1, "periodEnd": 1 })
                .options(IndexOptions::builder().unique(true).build())
                .build(),
        )
        .await;
    // Idempotency TTL (24h) + uniqueness.
    let _ = mongo
        .collection::<Document>(store::IDEMPOTENCY)
        .create_index(
            IndexModel::builder()
                .keys(doc! { "expiresAt": 1 })
                .options(IndexOptions::builder().expire_after(std::time::Duration::ZERO).build())
                .build(),
        )
        .await;
    let _ = mongo
        .collection::<Document>(store::IDEMPOTENCY)
        .create_index(
            IndexModel::builder()
                .keys(doc! { "userId": 1, "key": 1, "method": 1, "path": 1 })
                .options(IndexOptions::builder().unique(true).build())
                .build(),
        )
        .await;
}

/* ── settlement runner ───────────────────────────────────────────────────── */

pub async fn run_settlements(
    State(mongo): State<MongoHandle>,
    headers: HeaderMap,
    Query(q): Query<CronQuery>,
) -> Result<Json<Value>> {
    cron_guard(&headers)?;
    let execute = is_execute(&q);
    ensure_indexes(&mongo).await;

    let now = store::now_iso();
    let cutoff = (Utc::now() - Duration::days(SETTLEMENT_HOLD_DAYS))
        .to_rfc3339_opts(SecondsFormat::Millis, true);
    let period_end = Utc::now().format("%Y-%m-%d").to_string();

    // Merchants with at least one eligible live, succeeded, unsettled, non-open-dispute payment.
    let eligible_match = doc! {
        "mode": "live",
        "status": "succeeded",
        "paidAt": { "$lte": &cutoff },
        "settlementId": { "$exists": false },
        "disputeStatus": { "$ne": "open" },
    };
    let agg = mongo
        .collection::<Document>(store::PAYMENTS)
        .aggregate(vec![
            doc! { "$match": eligible_match.clone() },
            doc! { "$group": { "_id": "$userId" } },
            doc! { "$limit": MERCHANT_CAP as i64 },
        ])
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.cron.settle.agg")))?;
    let groups: Vec<Document> = agg
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.cron.settle.collect")))?;

    let mut merchants_settled = 0i64;
    let mut total_net = 0i64;
    let mut would_settle = 0i64;

    for g in &groups {
        let uid = match g.get_object_id("_id") {
            Ok(u) => u,
            Err(_) => continue,
        };
        if !execute {
            would_settle += 1;
            continue;
        }

        // Claim the per-day slot first (unique {userId, periodEnd}) so a double
        // run can't produce two settlements; then stamp the eligible docs.
        let setl_id = new_id("setl");
        let settle_doc = doc! {
            "_id": ObjectId::new(),
            "setlId": &setl_id,
            "userId": uid,
            "mode": "live",
            "status": "processed",
            "grossAmount": 0_i64,
            "feesTotal": 0_i64,
            "taxTotal": 0_i64,
            "refundsTotal": 0_i64,
            "disputesDeducted": 0_i64,
            "amount": 0_i64,
            "paymentCount": 0_i64,
            "refundCount": 0_i64,
            "utr": format!("SABP{}", store::random_hex(8)),
            "periodEnd": &period_end,
            "settledAt": &now,
            "createdAt": &now,
        };
        let scoll = mongo.collection::<Document>(store::SETTLEMENTS);
        if scoll.insert_one(&settle_doc).await.is_err() {
            // Duplicate {userId, periodEnd} — already settled today.
            continue;
        }

        let mut gross = 0i64;
        let mut fees_total = 0i64;
        let mut tax_total = 0i64;
        let mut payment_count = 0i64;

        // Claim eligible payments one at a time (race-safe via settlementId guard).
        let pcoll = mongo.collection::<Document>(store::PAYMENTS);
        loop {
            let claimed = pcoll
                .find_one_and_update(
                    doc! {
                        "userId": uid,
                        "mode": "live",
                        "status": "succeeded",
                        "paidAt": { "$lte": &cutoff },
                        "settlementId": { "$exists": false },
                        "disputeStatus": { "$ne": "open" },
                    },
                    doc! { "$set": { "settlementId": &setl_id } },
                )
                .return_document(ReturnDocument::After)
                .await
                .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.cron.settle.claim")))?;
            let Some(p) = claimed else { break };
            gross += num_i64(&p, "amount");
            fees_total += num_i64(&p, "fee");
            tax_total += num_i64(&p, "tax");
            payment_count += 1;
        }

        // Process pending live refunds → processed, deduct from this settlement.
        let mut refunds_total = 0i64;
        let mut refund_count = 0i64;
        let rcoll = mongo.collection::<Document>(store::REFUNDS);
        loop {
            let claimed = rcoll
                .find_one_and_update(
                    doc! {
                        "userId": uid,
                        "mode": "live",
                        "status": "pending",
                        "settlementId": { "$exists": false },
                    },
                    doc! { "$set": { "status": "processed", "settlementId": &setl_id, "processedAt": &now, "updatedAt": &now } },
                )
                .return_document(ReturnDocument::After)
                .await
                .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.cron.settle.refund")))?;
            let Some(r) = claimed else { break };
            refunds_total += num_i64(&r, "amount");
            refund_count += 1;
            spawn_event(&mongo, uid, "refund.processed", "refund", &r, str_or(&r, "refundId", ""), "live");
        }

        // Deduct lost disputes (live, unsettled).
        let mut disputes_deducted = 0i64;
        let dcoll = mongo.collection::<Document>(store::DISPUTES);
        loop {
            let claimed = dcoll
                .find_one_and_update(
                    doc! {
                        "userId": uid,
                        "mode": "live",
                        "status": "lost",
                        "settlementId": { "$exists": false },
                    },
                    doc! { "$set": { "settlementId": &setl_id, "updatedAt": &now } },
                )
                .return_document(ReturnDocument::After)
                .await
                .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.cron.settle.dispute")))?;
            let Some(d) = claimed else { break };
            disputes_deducted += num_i64(&d, "amount");
        }

        let net = (gross - fees_total - tax_total - refunds_total - disputes_deducted).max(0);
        let _ = scoll
            .update_one(
                doc! { "setlId": &setl_id },
                doc! { "$set": {
                    "grossAmount": gross,
                    "feesTotal": fees_total,
                    "taxTotal": tax_total,
                    "refundsTotal": refunds_total,
                    "disputesDeducted": disputes_deducted,
                    "amount": net,
                    "paymentCount": payment_count,
                    "refundCount": refund_count,
                }},
            )
            .await;

        if payment_count == 0 && refund_count == 0 && disputes_deducted == 0 {
            // Nothing actually settled (raced) — remove the empty slot.
            let _ = scoll.delete_one(doc! { "setlId": &setl_id }).await;
            continue;
        }

        if let Ok(Some(final_doc)) = scoll.find_one(doc! { "setlId": &setl_id }).await {
            spawn_event(&mongo, uid, "settlement.processed", "settlement", &final_doc, setl_id.clone(), "live");
        }
        merchants_settled += 1;
        total_net += net;
    }

    Ok(Json(json!({
        "dryRun": !execute,
        "periodEnd": period_end,
        "eligibleMerchants": groups.len(),
        "merchantsSettled": merchants_settled,
        "wouldSettle": would_settle,
        "netSettled": total_net,
    })))
}

/* ── subscription cycle runner ───────────────────────────────────────────── */

fn advance_charge(base_iso: &str, interval: &str, count: i64) -> String {
    let count = count.max(1);
    let base = chrono::DateTime::parse_from_rfc3339(base_iso)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let next = match interval {
        "daily" => base + Duration::days(count),
        "weekly" => base + Duration::weeks(count),
        "yearly" => base.checked_add_months(Months::new(12 * count as u32)).unwrap_or(base),
        _ => base.checked_add_months(Months::new(count as u32)).unwrap_or(base), // monthly default
    };
    next.to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::advance_charge;

    #[test]
    fn advance_charge_intervals() {
        let base = "2026-01-15T00:00:00.000Z";
        assert!(advance_charge(base, "daily", 3).starts_with("2026-01-18"));
        assert!(advance_charge(base, "weekly", 1).starts_with("2026-01-22"));
        assert!(advance_charge(base, "monthly", 1).starts_with("2026-02-15"));
        assert!(advance_charge(base, "yearly", 1).starts_with("2027-01-15"));
        // Unknown interval defaults to monthly.
        assert!(advance_charge(base, "fortnightly", 1).starts_with("2026-02-15"));
        // A garbage base still produces a valid future timestamp (now-based).
        assert!(advance_charge("not-a-date", "daily", 1).contains('T'));
    }
}

pub async fn run_subscription_cycles(
    State(mongo): State<MongoHandle>,
    headers: HeaderMap,
    Query(q): Query<CronQuery>,
) -> Result<Json<Value>> {
    cron_guard(&headers)?;
    let execute = is_execute(&q);
    let now = store::now_iso();

    let scoll = mongo.collection::<Document>(store::SUBSCRIPTIONS);
    let cursor = scoll
        .find(doc! {
            "status": { "$in": ["active", "created"] },
            "nextChargeAt": { "$lte": &now },
        })
        .limit(SUBSCRIPTION_CAP as i64)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.cron.sub.find")))?;
    let subs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.cron.sub.collect")))?;

    let mut cycles_generated = 0i64;
    let mut halted = 0i64;
    let mut cancelled = 0i64;
    let due = subs.len();

    for sub in &subs {
        if !execute {
            continue;
        }
        let uid = match sub.get_object_id("userId") {
            Ok(u) => u,
            Err(_) => continue,
        };
        let sub_id = str_or(sub, "subId", "");
        let mode = str_or(sub, "mode", "test");
        let plan_id = str_or(sub, "planId", "");
        let paid_count = num_i64(sub, "paidCount");
        let total_count = num_i64(sub, "totalCount");

        // Stop a subscription flagged to cancel at the cycle boundary.
        if matches!(sub.get_bool("cancelAtCycleEnd"), Ok(true)) {
            let _ = scoll
                .update_one(
                    doc! { "subId": &sub_id },
                    doc! { "$set": { "status": "cancelled", "cancelledAt": &now, "endedAt": &now, "updatedAt": &now } },
                )
                .await;
            if let Ok(Some(d)) = scoll.find_one(doc! { "subId": &sub_id }).await {
                spawn_event(&mongo, uid, "subscription.cancelled", "subscription", &d, sub_id.clone(), &mode);
            }
            cancelled += 1;
            continue;
        }

        let plan = match mongo
            .collection::<Document>(store::PLANS)
            .find_one(doc! { "planId": &plan_id, "userId": uid })
            .await
            .ok()
            .flatten()
        {
            Some(p) => p,
            None => continue,
        };

        // Outstanding (issued, unpaid) cycle invoices for this subscription.
        let outstanding = mongo
            .collection::<Document>(store::INVOICES)
            .count_documents(doc! { "subscriptionId": &sub_id, "type": "subscription_cycle", "status": "issued" })
            .await
            .unwrap_or(0) as i64;

        if outstanding >= HALT_AFTER_MISSED {
            let _ = scoll
                .update_one(
                    doc! { "subId": &sub_id },
                    doc! { "$set": { "status": "halted", "missedCycles": outstanding, "updatedAt": &now } },
                )
                .await;
            if let Ok(Some(d)) = scoll.find_one(doc! { "subId": &sub_id }).await {
                spawn_event(&mongo, uid, "subscription.halted", "subscription", &d, sub_id.clone(), &mode);
            }
            halted += 1;
            continue;
        }

        // All cycles already accounted for — defer without generating more.
        if paid_count + outstanding >= total_count {
            let interval = str_or(&plan, "interval", "monthly");
            let icount = num_i64(&plan, "intervalCount").max(1);
            let next = advance_charge(&now, &interval, icount);
            let _ = scoll
                .update_one(
                    doc! { "subId": &sub_id },
                    doc! { "$set": { "nextChargeAt": &next, "missedCycles": outstanding, "updatedAt": &now } },
                )
                .await;
            continue;
        }

        // Generate a new cycle invoice + payment.
        let plan_amount = num_i64(&plan, "amount");
        let plan_name = str_or(&plan, "name", "Subscription");
        let interval = str_or(&plan, "interval", "monthly");
        let icount = num_i64(&plan, "intervalCount").max(1);

        // Customer snapshot (if the subscription has a customer).
        let (cust_name, cust_email, cust_phone, customer_id) = match str_opt(sub, "customerId") {
            Some(cid) => {
                let c = mongo
                    .collection::<Document>(store::CUSTOMERS)
                    .find_one(doc! { "customerId": &cid, "userId": uid })
                    .await
                    .ok()
                    .flatten();
                (
                    c.as_ref().and_then(|c| str_opt(c, "name")),
                    c.as_ref().and_then(|c| str_opt(c, "email")),
                    c.as_ref().and_then(|c| str_opt(c, "contact")),
                    Some(cid),
                )
            }
            None => (None, None, None, None),
        };

        let inv_id = new_id("inv");
        let line_items = vec![bson::Bson::Document(doc! {
            "name": &plan_name,
            "amount": plan_amount,
            "quantity": 1_i64,
        })];
        let mut inv = doc! {
            "_id": ObjectId::new(),
            "invId": &inv_id,
            "userId": uid,
            "mode": &mode,
            "type": "subscription_cycle",
            "status": "issued",
            "subscriptionId": &sub_id,
            "lineItems": bson::Bson::Array(line_items),
            "amount": plan_amount,
            "currency": "INR",
            "issuedAt": &now,
            "createdAt": &now,
            "updatedAt": &now,
        };
        if let Some(c) = &customer_id { inv.insert("customerId", c); }
        if let Some(n) = &cust_name { inv.insert("customerName", n); }
        if let Some(e) = &cust_email { inv.insert("customerEmail", e); }
        if let Some(p) = &cust_phone { inv.insert("customerPhone", p); }

        if mongo.collection::<Document>(store::INVOICES).insert_one(&inv).await.is_err() {
            continue;
        }

        let customer = if cust_name.is_some() || cust_email.is_some() || cust_phone.is_some() {
            Some(crate::dto::CustomerIn { name: cust_name.clone(), email: cust_email.clone(), phone: cust_phone.clone() })
        } else {
            None
        };
        let payment = match store::create_payment(
            &mongo,
            uid,
            &mode,
            crate::dto::CreatePaymentBody {
                amount: plan_amount,
                currency: Some("INR".to_owned()),
                description: Some(format!("{plan_name} — subscription {sub_id}")),
                customer,
                metadata: None,
                success_url: None,
                cancel_url: None,
                mode: Some(mode.clone()),
                order_id: None,
                customer_id: customer_id.clone(),
                payment_link_id: None,
                payment_page_id: None,
                invoice_id: Some(inv_id.clone()),
                subscription_id: Some(sub_id.clone()),
                qr_code_id: None,
            },
        )
        .await
        {
            Ok(p) => p,
            Err(_) => continue,
        };

        let _ = mongo
            .collection::<Document>(store::INVOICES)
            .update_one(doc! { "invId": &inv_id }, doc! { "$set": { "shortUrl": &payment.checkout_url } })
            .await;

        // First cycle of a fresh subscription → mark activated (live; test goes
        // active when finalize credits the immediate payment below).
        if num_i64(sub, "paidCount") == 0 && str_or(sub, "status", "") == "created" {
            if let Ok(Some(d)) = scoll.find_one(doc! { "subId": &sub_id }).await {
                spawn_event(&mongo, uid, "subscription.activated", "subscription", &d, sub_id.clone(), &mode);
            }
        }

        if mode == "test" {
            // Auto-succeed test cycles through the normal finalize path so the
            // subscription is credited + invoice marked paid via the chokepoint.
            let sim_id = format!("sim_{}", store::random_hex(6));
            if let Some(updated) = store::finalize_payment(
                &mongo,
                &payment.id,
                store::FinalizeInput {
                    succeeded: true,
                    provider_payment_id: Some(&sim_id),
                    provider_payment_mode: Some("SIMULATED"),
                    provider_bank_ref_num: None,
                    provider_error_message: None,
                    failure_reason: None,
                },
            )
            .await?
            {
                let _ = finalize::after_finalize_success(&mongo, &updated).await;
            }
        } else {
            // Live: no auto-debit rail — emit subscription.pending with the link.
            let _ = scoll
                .update_one(doc! { "subId": &sub_id }, doc! { "$set": { "missedCycles": outstanding + 1, "updatedAt": &now } })
                .await;
            if let Ok(Some(d)) = scoll.find_one(doc! { "subId": &sub_id }).await {
                spawn_event(&mongo, uid, "subscription.pending", "subscription", &d, sub_id.clone(), &mode);
            }
        }

        let next = advance_charge(&now, &interval, icount);
        let _ = scoll
            .update_one(doc! { "subId": &sub_id }, doc! { "$set": { "nextChargeAt": &next, "updatedAt": &now } })
            .await;
        cycles_generated += 1;
    }

    Ok(Json(json!({
        "dryRun": !execute,
        "due": due,
        "cyclesGenerated": cycles_generated,
        "halted": halted,
        "cancelled": cancelled,
    })))
}

/* ── expiry sweep ────────────────────────────────────────────────────────── */

pub async fn run_expiry_sweeps(
    State(mongo): State<MongoHandle>,
    headers: HeaderMap,
    Query(q): Query<CronQuery>,
) -> Result<Json<Value>> {
    cron_guard(&headers)?;
    let execute = is_execute(&q);
    let now = store::now_iso();

    let mut links_expired = 0i64;
    let mut invoices_expired = 0i64;

    // Payment links: created + past expireBy → expired.
    let lcoll = mongo.collection::<Document>(store::PAYMENT_LINKS);
    let link_filter = doc! { "status": "created", "expireBy": { "$exists": true, "$lt": &now } };
    if !execute {
        links_expired = lcoll.count_documents(link_filter.clone()).await.unwrap_or(0) as i64;
    } else {
        loop {
            let claimed = lcoll
                .find_one_and_update(
                    link_filter.clone(),
                    doc! { "$set": { "status": "expired", "updatedAt": &now } },
                )
                .return_document(ReturnDocument::After)
                .await
                .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.cron.expire.link")))?;
            let Some(d) = claimed else { break };
            let uid = d.get_object_id("userId").unwrap_or_default();
            let mode = str_or(&d, "mode", "test");
            spawn_event(&mongo, uid, "payment_link.expired", "paymentLink", &d, str_or(&d, "plinkId", ""), &mode);
            links_expired += 1;
        }
    }

    // Invoices: issued + past expireBy → expired.
    let icoll = mongo.collection::<Document>(store::INVOICES);
    let inv_filter = doc! { "status": "issued", "expireBy": { "$exists": true, "$lt": &now } };
    if !execute {
        invoices_expired = icoll.count_documents(inv_filter.clone()).await.unwrap_or(0) as i64;
    } else {
        loop {
            let claimed = icoll
                .find_one_and_update(
                    inv_filter.clone(),
                    doc! { "$set": { "status": "expired", "updatedAt": &now } },
                )
                .return_document(ReturnDocument::After)
                .await
                .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.cron.expire.invoice")))?;
            let Some(d) = claimed else { break };
            let uid = d.get_object_id("userId").unwrap_or_default();
            let mode = str_or(&d, "mode", "test");
            spawn_event(&mongo, uid, "invoice.expired", "invoice", &d, str_or(&d, "invId", ""), &mode);
            invoices_expired += 1;
        }
    }

    Ok(Json(json!({
        "dryRun": !execute,
        "linksExpired": links_expired,
        "invoicesExpired": invoices_expired,
    })))
}
