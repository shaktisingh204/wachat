//! SabPay Subscriptions — `sub_…` objects (Razorpay-style recurring billing).
//!
//! A subscription binds a `planId` (the recurring price + interval) to an
//! optional `customerId` and a `totalCount` of cycles to bill. It moves
//! `created → authenticated → active → (paused/halted) → cancelled/completed`.
//!
//! THIS MODULE NEVER CHARGES. The cron runner (a separate module) generates one
//! cycle invoice per `nextChargeAt`; when a linked invoice is paid the finalize
//! chokepoint (`finalize.rs::credit_subscription_cycle`) increments `paidCount`,
//! resets `missedCycles`, flips the status to `active`, and fires
//! `subscription.charged` / `subscription.completed`. The cron similarly owns
//! `subscription.activated` / `subscription.pending` / `subscription.halted`.
//!
//! Only the merchant-driven lifecycle transitions live here, each firing its own
//! webhook: cancel (`subscription.cancelled`), pause (`subscription.paused`),
//! resume (`subscription.resumed`). Mirrors the `orders` reference module:
//! DTOs → `doc_to_subscription` mapper → `{userId, mode}`-scoped store fns →
//! Axum handlers. Routes are wired centrally in `lib.rs`.

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

use crate::ids::new_id;
use crate::store::{self, iso_opt, num_i64, str_opt, str_or, user_oid, validate_notes};
use crate::webhooks;

const COLL: &str = store::SUBSCRIPTIONS;
const DEFAULT_NAME: &str = "My business";

/* ── DTOs ────────────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionOut {
    pub id: String,
    pub mode: String,
    pub plan_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<String>,
    pub total_count: i64,
    pub paid_count: i64,
    pub missed_cycles: i64,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_charge_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancel_at_cycle_end: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<Value>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paused_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubscriptionBody {
    pub plan_id: String,
    #[serde(default)]
    pub customer_id: Option<String>,
    pub total_count: i64,
    /// First charge timestamp (ISO). Defaults to now when omitted.
    #[serde(default)]
    pub start_at: Option<String>,
    #[serde(default)]
    pub notes: Option<Value>,
    /// Set by the public API from the key prefix; the dashboard omits it.
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubscriptionBody {
    /// Free-form notes (Razorpay parity).
    #[serde(default)]
    pub notes: Option<Value>,
    /// May only be *increased* (you cannot shrink a subscription's commitment).
    #[serde(default)]
    pub total_count: Option<i64>,
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

/// `?at_cycle_end=1` on cancel keeps the subscription active and only marks it
/// to stop at the end of the current cycle.
#[derive(Debug, Deserialize)]
pub struct CancelQuery {
    #[serde(default)]
    pub at_cycle_end: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SubscriptionList {
    pub subscriptions: Vec<SubscriptionOut>,
}

/* ── mapper ──────────────────────────────────────────────────────────────── */

pub fn doc_to_subscription(d: &Document) -> SubscriptionOut {
    SubscriptionOut {
        id: str_or(d, "subId", ""),
        mode: str_or(d, "mode", "test"),
        plan_id: str_or(d, "planId", ""),
        customer_id: str_opt(d, "customerId"),
        total_count: num_i64(d, "totalCount"),
        paid_count: num_i64(d, "paidCount"),
        missed_cycles: num_i64(d, "missedCycles"),
        status: str_or(d, "status", "created"),
        next_charge_at: iso_opt(d, "nextChargeAt"),
        cancel_at_cycle_end: match d.get("cancelAtCycleEnd") {
            Some(Bson::Boolean(b)) => Some(*b),
            _ => None,
        },
        notes: match d.get("notes") {
            Some(b) if !matches!(b, Bson::Null) => {
                let v = bson_to_clean_json(b.clone());
                if v.is_null() { None } else { Some(v) }
            }
            _ => None,
        },
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
        paused_at: iso_opt(d, "pausedAt"),
        cancelled_at: iso_opt(d, "cancelledAt"),
        ended_at: iso_opt(d, "endedAt"),
    }
}

/* ── store ───────────────────────────────────────────────────────────────── */

pub async fn create(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    body: CreateSubscriptionBody,
) -> Result<SubscriptionOut> {
    // Plan is required and must exist in the SAME mode (no mode bleed).
    let plan_id = body.plan_id.trim();
    if plan_id.is_empty() {
        return Err(ApiError::Validation("planId is required.".to_owned()));
    }
    let plan_found = mongo
        .collection::<Document>(store::PLANS)
        .find_one(doc! { "planId": plan_id, "userId": uid, "mode": mode })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.plan")))?;
    if plan_found.is_none() {
        return Err(ApiError::BadRequest(format!("No {mode}-mode plan \"{plan_id}\".")));
    }

    // Optional customer, also same-mode scoped.
    let mut customer_id: Option<String> = None;
    if let Some(cid) = body.customer_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let found = mongo
            .collection::<Document>(store::CUSTOMERS)
            .find_one(doc! { "customerId": cid, "userId": uid, "mode": mode })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.customer"))
            })?;
        if found.is_none() {
            return Err(ApiError::BadRequest(format!("No {mode}-mode customer \"{cid}\".")));
        }
        customer_id = Some(cid.to_owned());
    }

    if body.total_count < 1 {
        return Err(ApiError::Validation("totalCount must be at least 1.".to_owned()));
    }

    let notes = validate_notes(&body.notes)?;
    let now = store::now_iso();
    // The cron runner generates cycle invoices off nextChargeAt; default to now.
    let next_charge_at = body
        .start_at
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(40).collect::<String>())
        .unwrap_or_else(|| now.clone());

    let sub_id = new_id("sub");
    let mut d = doc! {
        "_id": ObjectId::new(),
        "subId": &sub_id,
        "userId": uid,
        "mode": mode,
        "planId": plan_id,
        "totalCount": body.total_count,
        "paidCount": 0_i64,
        "missedCycles": 0_i64,
        "status": "created",
        "nextChargeAt": &next_charge_at,
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(cid) = &customer_id {
        d.insert("customerId", cid);
    }
    if let Some(n) = notes {
        d.insert("notes", n);
    }
    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.insert")))?;
    Ok(doc_to_subscription(&d))
}

pub async fn list(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    status: Option<&str>,
    before: Option<&str>,
    limit: i64,
) -> Result<Vec<SubscriptionOut>> {
    let mut filter = doc! { "userId": uid, "mode": mode };
    if let Some(s) = status {
        filter.insert("status", s);
    }
    if let Some(b) = before {
        filter.insert("createdAt", doc! { "$lt": b });
    }
    let cursor = mongo
        .collection::<Document>(COLL)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit.clamp(1, 100))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.collect")))?;
    Ok(docs.iter().map(doc_to_subscription).collect())
}

pub async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "subId": id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.get")))
}

/* ── handlers ────────────────────────────────────────────────────────────── */

pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<SubscriptionList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let subscriptions = list(
        &mongo,
        uid,
        &mode,
        q.status.as_deref(),
        q.before.as_deref(),
        q.limit.unwrap_or(50),
    )
    .await?;
    Ok(Json(SubscriptionList { subscriptions }))
}

pub async fn create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateSubscriptionBody>,
) -> Result<Json<SubscriptionOut>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = match body.mode.as_deref() {
        Some(m @ ("test" | "live")) => m.to_owned(),
        _ => merchant.mode.clone(),
    };
    Ok(Json(create(&mongo, uid, &mode, body).await?))
}

pub async fn get_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SubscriptionOut>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No subscription \"{id}\".")))?;
    Ok(Json(doc_to_subscription(&d)))
}

/// `PATCH /subscriptions/{id}` — mutate `notes` and *increase* `totalCount`.
pub async fn update_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSubscriptionBody>,
) -> Result<Json<SubscriptionOut>> {
    let uid = user_oid(&user)?;
    let current = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No subscription \"{id}\".")))?;
    let notes = validate_notes(&body.notes)?;

    let mut set = doc! { "updatedAt": store::now_iso() };
    if let Some(n) = notes {
        set.insert("notes", n);
    }
    if let Some(total) = body.total_count {
        let existing = num_i64(&current, "totalCount");
        if total < existing {
            return Err(ApiError::BadRequest(format!(
                "totalCount can only be increased (currently {existing})."
            )));
        }
        set.insert("totalCount", total);
    }
    let res = mongo
        .collection::<Document>(COLL)
        .update_one(doc! { "subId": &id, "userId": uid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.update")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound(format!("No subscription \"{id}\".")));
    }
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No subscription \"{id}\".")))?;
    Ok(Json(doc_to_subscription(&d)))
}

/// `POST /subscriptions/{id}/cancel?at_cycle_end=1`
///
/// With `at_cycle_end` truthy: leave the subscription active and flag
/// `cancelAtCycleEnd` so the cron stops it after the running cycle (no webhook
/// yet). Otherwise cancel immediately: `status → cancelled`, stamp
/// `cancelledAt`, and fire `subscription.cancelled`.
pub async fn cancel_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(q): Query<CancelQuery>,
) -> Result<Json<SubscriptionOut>> {
    let uid = user_oid(&user)?;
    let current = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No subscription \"{id}\".")))?;
    let status = str_or(&current, "status", "created");
    if matches!(status.as_str(), "cancelled" | "completed") {
        return Err(ApiError::Conflict(format!(
            "Subscription \"{id}\" is already {status}."
        )));
    }
    let mode = str_or(&current, "mode", "test");
    let coll = mongo.collection::<Document>(COLL);
    let now = store::now_iso();

    let at_cycle_end = matches!(
        q.at_cycle_end.as_deref(),
        Some("1" | "true" | "yes")
    );

    if at_cycle_end {
        // Keep active; flag to stop after the running cycle. No webhook here —
        // the cron emits `subscription.cancelled` when it actually stops.
        let updated = coll
            .find_one_and_update(
                doc! { "subId": &id, "userId": uid },
                doc! { "$set": { "cancelAtCycleEnd": true, "updatedAt": &now } },
            )
            .return_document(ReturnDocument::After)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.cancel_at_end"))
            })?
            .ok_or_else(|| ApiError::NotFound(format!("No subscription \"{id}\".")))?;
        return Ok(Json(doc_to_subscription(&updated)));
    }

    let updated = coll
        .find_one_and_update(
            doc! {
                "subId": &id,
                "userId": uid,
                "status": { "$nin": ["cancelled", "completed"] },
            },
            doc! { "$set": {
                "status": "cancelled",
                "cancelledAt": &now,
                "endedAt": &now,
                "cancelAtCycleEnd": false,
                "updatedAt": &now,
            }},
        )
        .return_document(ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.cancel")))?
        .ok_or_else(|| {
            ApiError::Conflict(format!("Subscription \"{id}\" was already finished."))
        })?;

    let out = doc_to_subscription(&updated);
    let value = serde_json::to_value(&out).unwrap_or(Value::Null);
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        "subscription.cancelled".to_owned(),
        "subscription",
        value,
        id.clone(),
        mode,
    ));
    Ok(Json(out))
}

/// `POST /subscriptions/{id}/pause` — `active → paused`, stamp `pausedAt`, fire
/// `subscription.paused`. The cron skips paused subscriptions.
pub async fn pause_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SubscriptionOut>> {
    let uid = user_oid(&user)?;
    let current = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No subscription \"{id}\".")))?;
    let status = str_or(&current, "status", "created");
    if status != "active" {
        return Err(ApiError::BadRequest(format!(
            "Only an active subscription can be paused (currently {status})."
        )));
    }
    let mode = str_or(&current, "mode", "test");
    let now = store::now_iso();
    let updated = mongo
        .collection::<Document>(COLL)
        .find_one_and_update(
            doc! { "subId": &id, "userId": uid, "status": "active" },
            doc! { "$set": { "status": "paused", "pausedAt": &now, "updatedAt": &now } },
        )
        .return_document(ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.pause")))?
        .ok_or_else(|| {
            ApiError::Conflict(format!("Subscription \"{id}\" is no longer active."))
        })?;

    let out = doc_to_subscription(&updated);
    let value = serde_json::to_value(&out).unwrap_or(Value::Null);
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        "subscription.paused".to_owned(),
        "subscription",
        value,
        id.clone(),
        mode,
    ));
    Ok(Json(out))
}

/// `POST /subscriptions/{id}/resume` — `paused → active`, clear `pausedAt`, fire
/// `subscription.resumed`. The cron picks the subscription back up.
pub async fn resume_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SubscriptionOut>> {
    let uid = user_oid(&user)?;
    let current = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No subscription \"{id}\".")))?;
    let status = str_or(&current, "status", "created");
    if status != "paused" {
        return Err(ApiError::BadRequest(format!(
            "Only a paused subscription can be resumed (currently {status})."
        )));
    }
    let mode = str_or(&current, "mode", "test");
    let now = store::now_iso();
    let updated = mongo
        .collection::<Document>(COLL)
        .find_one_and_update(
            doc! { "subId": &id, "userId": uid, "status": "paused" },
            doc! {
                "$set": { "status": "active", "updatedAt": &now },
                "$unset": { "pausedAt": "" },
            },
        )
        .return_document(ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.subscription.resume")))?
        .ok_or_else(|| {
            ApiError::Conflict(format!("Subscription \"{id}\" is no longer paused."))
        })?;

    let out = doc_to_subscription(&updated);
    let value = serde_json::to_value(&out).unwrap_or(Value::Null);
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        "subscription.resumed".to_owned(),
        "subscription",
        value,
        id.clone(),
        mode,
    ));
    Ok(Json(out))
}
