//! SabPay Plans — `plan_…` subscription-plan objects.
//!
//! A plan is an immutable billing template (amount + interval) that
//! subscriptions reference via `planId`. Razorpay parity: a plan is **never**
//! edited after creation — to change pricing you create a new plan and migrate
//! subscriptions. There is no update handler here. Deletion is refused while any
//! subscription still references the plan, so a live billing relationship can't
//! lose its template out from under it. No webhooks originate from this module.
//!
//! Mirrors the `orders` reference module: DTOs → `doc_to_plan` mapper →
//! `{userId, mode}`-scoped store fns → Axum handlers. Routes are wired centrally
//! in `lib.rs`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_to_clean_json, mongo::MongoHandle};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ids::new_id;
use crate::store::{self, iso_opt, num_i64, str_opt, str_or, user_oid, validate_amount, validate_notes};

const COLL: &str = store::PLANS;
const DEFAULT_NAME: &str = "My business";

/// Allowed billing intervals (Razorpay parity).
const INTERVALS: &[&str] = &["daily", "weekly", "monthly", "yearly"];

/* ── DTOs ────────────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanOut {
    pub id: String,
    pub mode: String,
    pub name: String,
    pub amount: i64,
    pub currency: String,
    pub interval: String,
    pub interval_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<Value>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlanBody {
    pub name: String,
    pub amount: i64,
    #[serde(default)]
    pub currency: Option<String>,
    pub interval: String,
    #[serde(default)]
    pub interval_count: Option<i64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub notes: Option<Value>,
    /// Mode to stamp on the plan. Omitted by the dashboard (uses the merchant's
    /// mode); set by the public API from the key prefix.
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub before: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PlanList {
    pub plans: Vec<PlanOut>,
}

/* ── mapper ──────────────────────────────────────────────────────────────── */

pub fn doc_to_plan(d: &Document) -> PlanOut {
    PlanOut {
        id: str_or(d, "planId", ""),
        mode: str_or(d, "mode", "test"),
        name: str_or(d, "name", ""),
        amount: num_i64(d, "amount"),
        currency: str_or(d, "currency", "INR"),
        interval: str_or(d, "interval", "monthly"),
        interval_count: {
            let n = num_i64(d, "intervalCount");
            if n >= 1 { n } else { 1 }
        },
        description: str_opt(d, "description"),
        notes: match d.get("notes") {
            Some(b) if !matches!(b, Bson::Null) => {
                let v = bson_to_clean_json(b.clone());
                if v.is_null() { None } else { Some(v) }
            }
            _ => None,
        },
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
    }
}

/* ── store ───────────────────────────────────────────────────────────────── */

pub async fn create(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    body: CreatePlanBody,
) -> Result<PlanOut> {
    let name: String = body.name.trim().chars().take(140).collect();
    if name.is_empty() {
        return Err(ApiError::Validation("Plan name is required.".to_owned()));
    }
    validate_amount(body.amount)?;
    let currency = body.currency.as_deref().unwrap_or("INR").to_uppercase();
    if currency != "INR" {
        return Err(ApiError::BadRequest("Only INR is supported right now.".to_owned()));
    }
    let interval = body.interval.trim().to_lowercase();
    if !INTERVALS.contains(&interval.as_str()) {
        return Err(ApiError::Validation(format!(
            "interval must be one of {}.",
            INTERVALS.join(", ")
        )));
    }
    let interval_count = body.interval_count.unwrap_or(1);
    if interval_count < 1 {
        return Err(ApiError::Validation(
            "intervalCount must be at least 1.".to_owned(),
        ));
    }
    let notes = validate_notes(&body.notes)?;

    let plan_id = new_id("plan");
    let now = store::now_iso();
    let mut d = doc! {
        "_id": ObjectId::new(),
        "planId": &plan_id,
        "userId": uid,
        "mode": mode,
        "name": &name,
        "amount": body.amount,
        "currency": &currency,
        "interval": &interval,
        "intervalCount": interval_count,
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(desc) = body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("description", desc.chars().take(500).collect::<String>());
    }
    if let Some(n) = notes {
        d.insert("notes", n);
    }
    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.plan.insert")))?;
    Ok(doc_to_plan(&d))
}

pub async fn list(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    before: Option<&str>,
    limit: i64,
) -> Result<Vec<PlanOut>> {
    let mut filter = doc! { "userId": uid, "mode": mode };
    if let Some(b) = before {
        filter.insert("createdAt", doc! { "$lt": b });
    }
    let cursor = mongo
        .collection::<Document>(COLL)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit.clamp(1, 100))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.plan.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.plan.collect")))?;
    Ok(docs.iter().map(doc_to_plan).collect())
}

pub async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "planId": id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.plan.get")))
}

/* ── handlers ────────────────────────────────────────────────────────────── */

pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<PlanList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let plans = list(&mongo, uid, &mode, q.before.as_deref(), q.limit.unwrap_or(50)).await?;
    Ok(Json(PlanList { plans }))
}

pub async fn create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreatePlanBody>,
) -> Result<Json<PlanOut>> {
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
) -> Result<Json<PlanOut>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No plan \"{id}\".")))?;
    Ok(Json(doc_to_plan(&d)))
}

/// `DELETE /plans/{id}` — refuse while any subscription references this plan.
pub async fn delete_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<crate::dto::Ack>> {
    let uid = user_oid(&user)?;

    // Confirm the plan exists for this caller before checking references, so a
    // missing plan reads as 404 (not a misleading conflict / silent success).
    if get_doc(&mongo, uid, &id).await?.is_none() {
        return Err(ApiError::NotFound(format!("No plan \"{id}\".")));
    }

    // Guard: a plan with live subscription relationships is immutable here.
    let referenced = mongo
        .collection::<Document>(store::SUBSCRIPTIONS)
        .find_one(doc! { "planId": &id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.plan.refcheck")))?
        .is_some();
    if referenced {
        return Err(ApiError::Conflict(
            "This plan has subscriptions and can't be deleted.".to_owned(),
        ));
    }

    let res = mongo
        .collection::<Document>(COLL)
        .delete_one(doc! { "planId": &id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.plan.delete")))?;
    if res.deleted_count == 1 {
        Ok(Json(crate::dto::Ack::ok()))
    } else {
        Err(ApiError::NotFound(format!("No plan \"{id}\".")))
    }
}
