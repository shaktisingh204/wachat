//! SabPay Disputes — `disp_…` chargeback objects against a succeeded payment.
//!
//! A dispute is a chargeback the issuing bank raised on a `succeeded` payment.
//! It moves `open → under_review → won|lost`; accepting it concedes the funds
//! (`lost`), contesting it submits evidence (`under_review`). There is no PayU
//! dispute API here: real disputes are seeded by the platform, and a **test**
//! dispute can be conjured (with an optional immediate outcome) via the
//! simulate endpoint so merchants can exercise their webhooks end-to-end.
//!
//! Mirrors the `orders` reference module: DTOs → `doc_to_dispute` mapper →
//! `{userId, mode}`-scoped store fns → Axum handlers. Routes are wired centrally
//! in `lib.rs`. Fires `dispute.created` / `dispute.under_review` / `dispute.won`
//! / `dispute.lost`, and keeps the linked payment's `disputeStatus` in lock-step.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Duration, SecondsFormat, Utc};
use futures::TryStreamExt;
use mongodb::options::ReturnDocument;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::ids::new_id;
use crate::store::{self, iso_opt, num_i64, str_or, user_oid};
use crate::webhooks;

const COLL: &str = store::DISPUTES;
const DEFAULT_NAME: &str = "My business";

/* ── DTOs ────────────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisputeEvidenceOut {
    pub summary: String,
    pub file_urls: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisputeOut {
    pub id: String,
    pub mode: String,
    pub payment_id: String,
    pub amount: i64,
    pub currency: String,
    pub reason_code: String,
    pub phase: String,
    pub status: String,
    pub respond_by: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence: Option<DisputeEvidenceOut>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence_submitted_at: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContestDisputeBody {
    pub summary: String,
    #[serde(default)]
    pub file_urls: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulateDisputeBody {
    pub payment_id: String,
    #[serde(default)]
    pub reason_code: Option<String>,
    #[serde(default)]
    pub amount: Option<i64>,
    /// When set to `"won"` / `"lost"`, the dispute resolves immediately.
    #[serde(default)]
    pub outcome: Option<String>,
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
pub struct DisputeList {
    pub disputes: Vec<DisputeOut>,
}

/* ── mapper ──────────────────────────────────────────────────────────────── */

pub fn doc_to_dispute(d: &Document) -> DisputeOut {
    DisputeOut {
        id: str_or(d, "dispId", ""),
        mode: str_or(d, "mode", "test"),
        payment_id: str_or(d, "paymentId", ""),
        amount: num_i64(d, "amount"),
        currency: str_or(d, "currency", "INR"),
        reason_code: str_or(d, "reasonCode", "fraud"),
        phase: str_or(d, "phase", "chargeback"),
        status: str_or(d, "status", "open"),
        respond_by: iso_opt(d, "respondBy").unwrap_or_else(store::now_iso),
        evidence: doc_to_evidence(d),
        evidence_submitted_at: iso_opt(d, "evidenceSubmittedAt"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
        resolved_at: iso_opt(d, "resolvedAt"),
    }
}

fn doc_to_evidence(d: &Document) -> Option<DisputeEvidenceOut> {
    let ev = match d.get("evidence") {
        Some(Bson::Document(doc)) => doc,
        _ => return None,
    };
    let summary = str_or(ev, "summary", "");
    let file_urls: Vec<String> = ev
        .get_array("fileUrls")
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    if summary.is_empty() && file_urls.is_empty() {
        return None;
    }
    Some(DisputeEvidenceOut { summary, file_urls })
}

/* ── store ───────────────────────────────────────────────────────────────── */

pub async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "dispId": id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.dispute.get")))
}

/// Persist the linked payment's `disputeStatus` so the payment object reflects
/// the dispute lifecycle (`open` while contested, `won`/`lost` on resolution).
async fn set_payment_dispute_status(
    mongo: &MongoHandle,
    uid: ObjectId,
    payment_id: &str,
    status: &str,
) {
    let _ = mongo
        .collection::<Document>(store::PAYMENTS)
        .update_one(
            doc! { "paymentId": payment_id, "userId": uid },
            doc! { "$set": { "disputeStatus": status, "updatedAt": store::now_iso() } },
        )
        .await;
}

fn fire(mongo: &MongoHandle, uid: ObjectId, event: &str, out: &DisputeOut, mode: &str) {
    let value = serde_json::to_value(out).unwrap_or(serde_json::Value::Null);
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        event.to_owned(),
        "dispute",
        value,
        out.id.clone(),
        mode.to_owned(),
    ));
}

/* ── handlers ────────────────────────────────────────────────────────────── */

/// `GET /disputes` — list the merchant's disputes for the resolved mode.
pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<DisputeList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let mut filter = doc! { "userId": uid, "mode": &mode };
    if let Some(s) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
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
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.dispute.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.dispute.collect")))?;
    Ok(Json(DisputeList {
        disputes: docs.iter().map(doc_to_dispute).collect(),
    }))
}

/// `GET /disputes/{id}` — fetch one dispute the caller owns.
pub async fn get_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DisputeOut>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No dispute \"{id}\".")))?;
    Ok(Json(doc_to_dispute(&d)))
}

/// `POST /disputes/{id}/accept` — concede the chargeback. Any non-resolved
/// dispute (`open` / `under_review`) transitions to `lost`; the linked payment's
/// `disputeStatus` is set to `lost`; fires `dispute.lost`.
pub async fn accept_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DisputeOut>> {
    let uid = user_oid(&user)?;
    let now = store::now_iso();
    let updated = mongo
        .collection::<Document>(COLL)
        .find_one_and_update(
            doc! {
                "dispId": &id,
                "userId": uid,
                "status": { "$in": ["open", "under_review"] },
            },
            doc! { "$set": { "status": "lost", "resolvedAt": &now, "updatedAt": &now } },
        )
        .return_document(ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.dispute.accept")))?;

    let updated = match updated {
        Some(d) => d,
        None => {
            // Distinguish "missing" from "already resolved" for a clearer error.
            return Err(match get_doc(&mongo, uid, &id).await? {
                Some(_) => ApiError::Conflict("This dispute is already resolved.".to_owned()),
                None => ApiError::NotFound(format!("No dispute \"{id}\".")),
            });
        }
    };

    let out = doc_to_dispute(&updated);
    set_payment_dispute_status(&mongo, uid, &out.payment_id, "lost").await;
    fire(&mongo, uid, "dispute.lost", &out, &out.mode);
    Ok(Json(out))
}

/// `POST /disputes/{id}/contest` — submit evidence. Only `open` / `under_review`
/// disputes accept evidence; stores `evidence` + `evidenceSubmittedAt`, moves to
/// `under_review`; fires `dispute.under_review`.
pub async fn contest_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<ContestDisputeBody>,
) -> Result<Json<DisputeOut>> {
    let uid = user_oid(&user)?;

    let summary: String = body.summary.trim().chars().take(2000).collect();
    if summary.is_empty() {
        return Err(ApiError::Validation(
            "Evidence summary is required.".to_owned(),
        ));
    }
    let file_urls: Vec<String> = body
        .file_urls
        .unwrap_or_default()
        .into_iter()
        .filter_map(|u| {
            let t = u.trim();
            if t.is_empty() || !store::valid_http_url(t) {
                None
            } else {
                Some(t.chars().take(500).collect::<String>())
            }
        })
        .take(20)
        .collect();

    let now = store::now_iso();
    let evidence = doc! { "summary": &summary, "fileUrls": &file_urls };
    let updated = mongo
        .collection::<Document>(COLL)
        .find_one_and_update(
            doc! {
                "dispId": &id,
                "userId": uid,
                "status": { "$in": ["open", "under_review"] },
            },
            doc! { "$set": {
                "status": "under_review",
                "evidence": &evidence,
                "evidenceSubmittedAt": &now,
                "updatedAt": &now,
            }},
        )
        .return_document(ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.dispute.contest")))?;

    let updated = match updated {
        Some(d) => d,
        None => {
            return Err(match get_doc(&mongo, uid, &id).await? {
                Some(_) => ApiError::Conflict("This dispute is already resolved.".to_owned()),
                None => ApiError::NotFound(format!("No dispute \"{id}\".")),
            });
        }
    };

    let out = doc_to_dispute(&updated);
    fire(&mongo, uid, "dispute.under_review", &out, &out.mode);
    Ok(Json(out))
}

/// `POST /test/disputes` — conjure a test-mode chargeback against a succeeded
/// payment (test mode only). Defaults the amount to the payment's amount and the
/// deadline to 7 days out; sets the payment's `disputeStatus` to `open`; fires
/// `dispute.created`. When `outcome` is `won`/`lost`, resolves immediately and
/// fires the matching event (and updates the payment's `disputeStatus`).
pub async fn simulate_create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<SimulateDisputeBody>,
) -> Result<Json<DisputeOut>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = merchant.mode.clone();
    if mode != "test" {
        return Err(ApiError::BadRequest(
            "Disputes can only be simulated in test mode.".to_owned(),
        ));
    }

    let payment_id = body.payment_id.trim().to_owned();
    if payment_id.is_empty() {
        return Err(ApiError::Validation("paymentId is required.".to_owned()));
    }
    let pay = store::get_payment_doc_by_id(&mongo, &payment_id)
        .await?
        .filter(|d| d.get_object_id("userId").ok() == Some(uid))
        .ok_or_else(|| ApiError::NotFound(format!("No payment \"{payment_id}\".")))?;
    if str_or(&pay, "mode", "") != "test" {
        return Err(ApiError::BadRequest(
            "Only test-mode payments can be disputed in test mode.".to_owned(),
        ));
    }
    if str_or(&pay, "status", "") != "succeeded" {
        return Err(ApiError::BadRequest(
            "Only succeeded payments can be disputed.".to_owned(),
        ));
    }

    let pay_amount = num_i64(&pay, "amount");
    let currency = str_or(&pay, "currency", "INR");
    let amount = match body.amount {
        Some(a) => {
            if a < 1 {
                return Err(ApiError::BadRequest(
                    "Dispute amount must be at least 1 paisa.".to_owned(),
                ));
            }
            if a > pay_amount {
                return Err(ApiError::BadRequest(format!(
                    "Dispute amount exceeds the payment amount ({pay_amount} paise)."
                )));
            }
            a
        }
        None => pay_amount,
    };
    let reason_code: String = body
        .reason_code
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(60).collect())
        .unwrap_or_else(|| "fraud".to_owned());

    let outcome = match body.outcome.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(o @ ("won" | "lost")) => Some(o.to_owned()),
        Some(_) => {
            return Err(ApiError::BadRequest(
                "outcome must be \"won\" or \"lost\".".to_owned(),
            ));
        }
    };

    let dispute_id = new_id("disp");
    let now = store::now_iso();
    let respond_by = (Utc::now() + Duration::days(7)).to_rfc3339_opts(SecondsFormat::Millis, true);
    let mut d = doc! {
        "_id": ObjectId::new(),
        "dispId": &dispute_id,
        "userId": uid,
        "mode": &mode,
        "paymentId": &payment_id,
        "amount": amount,
        "currency": &currency,
        "reasonCode": &reason_code,
        "phase": "chargeback",
        "status": "open",
        "respondBy": &respond_by,
        "createdAt": &now,
        "updatedAt": &now,
    };

    // If an outcome is requested, write the resolved state directly so the
    // persisted doc matches the events we fire below.
    if let Some(o) = &outcome {
        d.insert("status", o.as_str());
        d.insert("resolvedAt", &now);
    }

    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.dispute.insert")))?;

    // The payment first reflects an open dispute; an immediate outcome overrides.
    set_payment_dispute_status(&mongo, uid, &payment_id, "open").await;

    let out = doc_to_dispute(&d);
    // dispute.created always fires from a clean "open" snapshot.
    let created_snapshot = DisputeOut {
        status: "open".to_owned(),
        resolved_at: None,
        ..out.clone()
    };
    fire(&mongo, uid, "dispute.created", &created_snapshot, &mode);

    if let Some(o) = &outcome {
        set_payment_dispute_status(&mongo, uid, &payment_id, o).await;
        fire(&mongo, uid, &format!("dispute.{o}"), &out, &mode);
    }

    Ok(Json(out))
}
