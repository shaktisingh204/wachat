//! HTTP handlers for the wachat ab-testing domain.
//!
//! Backs the `/wachat/campaign-ab-test` page. Every endpoint is scoped
//! to the authenticated user (`userId`) AND the owning project
//! (`projectId`), via the owner-or-agent guard mirrored from
//! `wachat-contacts`.
//!
//! | Endpoint                                              | Action                          |
//! |-------------------------------------------------------|---------------------------------|
//! | `GET    /v1/wachat/ab-tests?projectId=`               | list tests (+ live summary)     |
//! | `POST   /v1/wachat/ab-tests`                          | create + launch a test          |
//! | `GET    /v1/wachat/ab-tests/{id}`                     | detail + live per-variant stats |
//! | `POST   /v1/wachat/ab-tests/{id}/variants/{variant}/broadcast` | attach launched broadcast |
//! | `POST   /v1/wachat/ab-tests/{id}/stop`                | mark `status="stopped"`         |
//! | `POST   /v1/wachat/ab-tests/{id}/promote-winner`      | `status="completed"` + winner   |
//! | `DELETE /v1/wachat/ab-tests/{id}`                     | delete test + its results       |
//!
//! ## Storage & live results
//!
//! - `wa_ab_tests`        — one config doc per test. Each variant sub-doc
//!   carries an optional `broadcastId` once the page launches the split
//!   broadcast and calls `POST /{id}/variants/{variant}/broadcast`.
//! - `wa_ab_test_results` — kept as an OPTIONAL legacy cache (seeded with
//!   zeros on create). It is no longer the source of truth.
//!
//! Per-variant `sent/delivered/read/failed` are computed **live** by
//! aggregating the broadcast engine's own collections — the SAME ones the
//! broadcast worker + status webhook write (see the two-store gotcha):
//!
//! - `broadcast_contacts` — one row per recipient, `status` in
//!   `PENDING < SENT < DELIVERED < READ` (`FAILED` terminal). Each row's
//!   `status` is the highest state reached, so a `READ` row was also sent
//!   and delivered. (Field names confirmed against
//!   `wachat-webhook-status::broadcast` + `src/workers/broadcast/*`.)
//! - `broadcasts` / `contacts` / `incoming_messages` — used for the
//!   best-effort `replied` signal (recipients who messaged back after
//!   launch). When that signal cannot be resolved, `replied` is `0` — no
//!   fabrication.
//!
//! A variant with no `broadcastId` yet returns all-zero counts.
//!
//! This crate deliberately does NOT call `wachat-broadcast` cross-crate.
//! It only persists the config + variant→broadcast links and reads the
//! broadcast result collections; the Next server action fires the actual
//! split broadcast and then posts the resulting broadcast ids back here.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    AttachBroadcastBody, CreateTestBody, ListTestsQuery, ListTestsResponse, PromoteWinnerBody,
    SuccessResponse, TestDetailResponse, VariantInput, VariantResult,
};
use crate::state::WachatAbTestingState;

/// Test config docs.
const TESTS_COLL: &str = "wa_ab_tests";
/// Per-variant result rows (`{ testId, variant, sent, opened, replied }`).
/// Kept as an optional legacy cache only — live aggregation is preferred.
const RESULTS_COLL: &str = "wa_ab_test_results";
/// Project membership lookups (shared collection — must match the real
/// name; see the two-store gotcha).
const PROJECTS_COLL: &str = "projects";
/// Broadcast engine collections (owned by `wachat-broadcast` +
/// `wachat-webhook-status` + `src/workers/broadcast/*`). We READ these to
/// compute live variant metrics — never write them.
const BROADCASTS_COLL: &str = "broadcasts";
const BROADCAST_CONTACTS_COLL: &str = "broadcast_contacts";
const CONTACTS_COLL: &str = "contacts";
const INCOMING_MESSAGES_COLL: &str = "incoming_messages";

// ===========================================================================
// Tenancy guards
// ===========================================================================

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Load a project and enforce **owner-or-agent** access for the caller.
/// Returns `404` if no matching project exists (collapses not-found and
/// forbidden into one message to avoid leaking project existence) —
/// mirrors the `wachat-contacts` guard.
async fn load_project_with_membership(
    user_oid: ObjectId,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<ObjectId> {
    let project_oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let filter = doc! {
        "_id": project_oid,
        "$or": [
            { "userId": user_oid },
            { "agents.userId": user_oid },
        ],
    };
    coll.find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound("Project not found or you do not have permission.".to_owned())
        })?;
    Ok(project_oid)
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Build a BSON sub-doc for one variant of the config.
fn variant_doc(v: &VariantInput) -> Document {
    let template_id: Bson = match v.template_id.as_deref().filter(|s| !s.is_empty()) {
        Some(t) => Bson::String(t.to_owned()),
        None => Bson::Null,
    };
    doc! {
        "templateId": template_id,
        "name": &v.name,
    }
}

/// Validate the create body.
fn validate_create(body: &CreateTestBody) -> Result<()> {
    if body.project_id.trim().is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("Test name is required.".to_owned()));
    }
    if body.variant_a.name.trim().is_empty() || body.variant_b.name.trim().is_empty() {
        return Err(ApiError::Validation(
            "Both variant templates are required.".to_owned(),
        ));
    }
    if body.variant_a.name.trim() == body.variant_b.name.trim()
        && body.variant_a.template_id == body.variant_b.template_id
    {
        return Err(ApiError::Validation(
            "Variant A and Variant B must use different templates.".to_owned(),
        ));
    }
    if body.split_pct < 10 || body.split_pct > 90 {
        return Err(ApiError::Validation(
            "splitPct must be between 10 and 90.".to_owned(),
        ));
    }
    if body.audience.trim().is_empty() {
        return Err(ApiError::Validation("audience is required.".to_owned()));
    }
    Ok(())
}

/// Compute a rate in `0.0..=1.0`, guarding divide-by-zero.
fn rate(num: i64, den: i64) -> f64 {
    if den > 0 {
        num as f64 / den as f64
    } else {
        0.0
    }
}

/// Pull a variant's attached `broadcastId` (hex string) off the test doc.
/// `variant` is `"A"` or `"B"`; the field lives at `variant{A,B}.broadcastId`.
fn variant_broadcast_id(test: &Document, variant: &str) -> Option<String> {
    let key = if variant == "A" { "variantA" } else { "variantB" };
    let sub = test.get_document(key).ok()?;
    match sub.get("broadcastId") {
        Some(Bson::ObjectId(oid)) => Some(oid.to_hex()),
        Some(Bson::String(s)) if !s.is_empty() => Some(s.clone()),
        _ => None,
    }
}

/// Count `broadcast_contacts` rows for one broadcast whose `status` is in
/// `statuses`. Each row holds the highest state reached, so DELIVERED rows
/// were also SENT, etc. — callers pass the inclusive status set they want.
async fn count_contacts_in(
    mongo: &MongoHandle,
    broadcast_oid: ObjectId,
    statuses: &[&str],
) -> Result<i64> {
    let coll = mongo.collection::<Document>(BROADCAST_CONTACTS_COLL);
    let n = coll
        .count_documents(doc! {
            "broadcastId": broadcast_oid,
            "status": { "$in": statuses },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("broadcast_contacts.count_documents"))
        })?;
    Ok(n as i64)
}

/// Best-effort count of recipients of `broadcast_oid` who messaged back
/// after the broadcast was launched.
///
/// There is no direct broadcast→reply link in the schema, so we join the
/// real collections: `broadcast_contacts.phone` → `contacts.waId` (same
/// project) → an inbound `incoming_messages` row whose `messageTimestamp`
/// is at/after the broadcast's `createdAt`. Distinct replying contacts are
/// counted. Any unresolved step yields `0` — never fabricated, never an
/// error that fails the whole read.
async fn count_replies(mongo: &MongoHandle, broadcast_oid: ObjectId) -> Result<i64> {
    // Load the broadcast for its project + launch time. A missing broadcast
    // (e.g. deleted) means no reply signal — return 0, don't error.
    let broadcast = mongo
        .collection::<Document>(BROADCASTS_COLL)
        .find_one(doc! { "_id": broadcast_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("broadcasts.find_one")))?;
    let Some(broadcast) = broadcast else {
        return Ok(0);
    };
    let Ok(project_oid) = broadcast.get_object_id("projectId") else {
        return Ok(0);
    };
    let since = broadcast.get_datetime("createdAt").ok().copied();

    // Recipient phones that were actually messaged (SENT/DELIVERED/READ).
    let recipients = mongo.collection::<Document>(BROADCAST_CONTACTS_COLL);
    let cursor = recipients
        .find(doc! {
            "broadcastId": broadcast_oid,
            "status": { "$in": ["SENT", "DELIVERED", "READ"] },
        })
        .projection(doc! { "phone": 1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("broadcast_contacts.find(replies)"))
        })?;
    let recipient_docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("broadcast_contacts.collect(replies)"))
    })?;
    let phones: Vec<String> = recipient_docs
        .iter()
        .filter_map(|d| d.get_str("phone").ok().map(str::to_owned))
        .collect();
    if phones.is_empty() {
        return Ok(0);
    }

    // Resolve those phones to contact ids within the project.
    let contacts = mongo.collection::<Document>(CONTACTS_COLL);
    let cursor = contacts
        .find(doc! { "projectId": project_oid, "waId": { "$in": &phones } })
        .projection(doc! { "_id": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find(replies)")))?;
    let contact_docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("contacts.collect(replies)"))
    })?;
    let contact_ids: Vec<ObjectId> = contact_docs
        .iter()
        .filter_map(|d| d.get_object_id("_id").ok())
        .collect();
    if contact_ids.is_empty() {
        return Ok(0);
    }

    // Distinct contacts with an inbound message after launch.
    let mut inbound_filter = doc! {
        "projectId": project_oid,
        "direction": "in",
        "contactId": { "$in": &contact_ids },
    };
    if let Some(ts) = since {
        inbound_filter.insert("messageTimestamp", doc! { "$gte": ts });
    }
    let incoming = mongo.collection::<Document>(INCOMING_MESSAGES_COLL);
    let distinct = incoming
        .distinct("contactId", inbound_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("incoming_messages.distinct(replies)"))
        })?;
    Ok(distinct.len() as i64)
}

/// Compute one variant's live metrics from the broadcast it's attached to.
/// Returns all-zero (with `broadcast_id: None`) when nothing is attached.
async fn compute_variant(
    mongo: &MongoHandle,
    variant: &str,
    broadcast_id: Option<String>,
) -> Result<VariantResult> {
    let Some(hex) = broadcast_id else {
        return Ok(zero_variant(variant));
    };
    // A malformed stored id must not crash the read — treat as no data.
    let Ok(broadcast_oid) = ObjectId::parse_str(&hex) else {
        return Ok(zero_variant(variant));
    };

    // `status` holds the highest state reached: count inclusively.
    let sent = count_contacts_in(mongo, broadcast_oid, &["SENT", "DELIVERED", "READ"]).await?;
    let delivered = count_contacts_in(mongo, broadcast_oid, &["DELIVERED", "READ"]).await?;
    let read = count_contacts_in(mongo, broadcast_oid, &["READ"]).await?;
    let failed = count_contacts_in(mongo, broadcast_oid, &["FAILED"]).await?;
    let replied = count_replies(mongo, broadcast_oid).await?;

    Ok(VariantResult {
        variant: variant.to_owned(),
        broadcast_id: Some(hex),
        sent,
        delivered,
        read,
        failed,
        opened: read,
        replied,
        open_rate: rate(read, sent),
        reply_rate: rate(replied, sent),
    })
}

/// All-zero variant result (no broadcast attached / unresolvable).
fn zero_variant(variant: &str) -> VariantResult {
    VariantResult {
        variant: variant.to_owned(),
        broadcast_id: None,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        opened: 0,
        replied: 0,
        open_rate: 0.0,
        reply_rate: 0.0,
    }
}

/// Fold a test doc into its two live `VariantResult`s (A then B).
async fn variant_results(mongo: &MongoHandle, test: &Document) -> Result<Vec<VariantResult>> {
    let mut out = Vec::with_capacity(2);
    for variant in ["A", "B"] {
        let bid = variant_broadcast_id(test, variant);
        out.push(compute_variant(mongo, variant, bid).await?);
    }
    Ok(out)
}

// ===========================================================================
// GET /v1/wachat/ab-tests?projectId=
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_tests(
    user: AuthUser,
    State(state): State<WachatAbTestingState>,
    Query(query): Query<ListTestsQuery>,
) -> Result<Json<ListTestsResponse>> {
    let uid = user_oid(&user)?;
    let project_oid = load_project_with_membership(uid, &state.mongo, &query.project_id).await?;

    let coll = state.mongo.collection::<Document>(TESTS_COLL);
    let cursor = coll
        .find(doc! { "userId": uid, "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("ab_tests.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("ab_tests.collect")))?;

    // Enrich each test with a live summary of its result metrics so the
    // list view can render totals without a second round trip per row.
    let mut tests = Vec::with_capacity(docs.len());
    for d in docs {
        let variants = variant_results(&state.mongo, &d).await?;
        let total_sent: i64 = variants.iter().map(|v| v.sent).sum();
        let total_delivered: i64 = variants.iter().map(|v| v.delivered).sum();
        let total_read: i64 = variants.iter().map(|v| v.read).sum();
        let total_failed: i64 = variants.iter().map(|v| v.failed).sum();
        let total_replied: i64 = variants.iter().map(|v| v.replied).sum();

        let mut row = document_to_clean_json(d);
        if let Value::Object(map) = &mut row {
            map.insert(
                "summary".to_owned(),
                serde_json::json!({
                    "totalSent": total_sent,
                    "totalDelivered": total_delivered,
                    "totalRead": total_read,
                    "totalFailed": total_failed,
                    "totalReplied": total_replied,
                    "variants": variants.iter().map(|v| serde_json::json!({
                        "variant": v.variant,
                        "broadcastId": v.broadcast_id,
                        "sent": v.sent,
                        "delivered": v.delivered,
                        "read": v.read,
                        "failed": v.failed,
                        "opened": v.opened,
                        "replied": v.replied,
                        "openRate": v.open_rate,
                        "replyRate": v.reply_rate,
                    })).collect::<Vec<_>>(),
                }),
            );
        }
        tests.push(row);
    }

    Ok(Json(ListTestsResponse { tests }))
}

// ===========================================================================
// POST /v1/wachat/ab-tests
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_test(
    user: AuthUser,
    State(state): State<WachatAbTestingState>,
    Json(body): Json<CreateTestBody>,
) -> Result<Json<Value>> {
    validate_create(&body)?;
    let uid = user_oid(&user)?;
    let project_oid = load_project_with_membership(uid, &state.mongo, &body.project_id).await?;

    let now = bson::DateTime::from_chrono(Utc::now());
    let test_oid = ObjectId::new();
    let phone_number_id: Bson = match body.phone_number_id.as_deref().filter(|s| !s.is_empty()) {
        Some(p) => Bson::String(p.to_owned()),
        None => Bson::Null,
    };

    let test_doc = doc! {
        "_id": test_oid,
        "userId": uid,
        "projectId": project_oid,
        "name": &body.name,
        "variantA": variant_doc(&body.variant_a),
        "variantB": variant_doc(&body.variant_b),
        "splitPct": body.split_pct as i32,
        "audience": &body.audience,
        "phoneNumberId": phone_number_id,
        "status": "running",
        "winnerVariant": Bson::Null,
        "createdAt": now,
        "updatedAt": now,
    };

    state
        .mongo
        .collection::<Document>(TESTS_COLL)
        .insert_one(test_doc.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("ab_tests.insert_one")))?;

    // Seed both result rows with zeros — the broadcast webhook updates
    // them later. Done as two inserts so each `{ testId, variant }` row
    // is independently addressable by the webhook.
    let results_coll = state.mongo.collection::<Document>(RESULTS_COLL);
    for variant in ["A", "B"] {
        let result_doc = doc! {
            "_id": ObjectId::new(),
            "testId": test_oid,
            "userId": uid,
            "projectId": project_oid,
            "variant": variant,
            "sent": 0_i64,
            "opened": 0_i64,
            "replied": 0_i64,
            "createdAt": now,
            "updatedAt": now,
        };
        results_coll
            .insert_one(result_doc)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("ab_test_results.insert_one"))
            })?;
    }

    Ok(Json(document_to_clean_json(test_doc)))
}

// ===========================================================================
// GET /v1/wachat/ab-tests/{id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn get_test(
    user: AuthUser,
    State(state): State<WachatAbTestingState>,
    Path(id): Path<String>,
) -> Result<Json<TestDetailResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;

    let test = state
        .mongo
        .collection::<Document>(TESTS_COLL)
        .find_one(doc! { "_id": oid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("ab_tests.find_one")))?
        .ok_or_else(|| ApiError::NotFound("A/B test not found.".to_owned()))?;

    let variants = variant_results(&state.mongo, &test).await?;
    Ok(Json(TestDetailResponse {
        test: document_to_clean_json(test),
        variants,
    }))
}

// ===========================================================================
// POST /v1/wachat/ab-tests/{id}/variants/{variant}/broadcast
// ===========================================================================

/// Associate the launched broadcast with a variant so its metrics can be
/// computed live. `variant` is `"A"` or `"B"`. The broadcast must belong to
/// the same project as the test (multi-tenant guard); the test must belong
/// to the caller (`userId` scope). Idempotent — re-attaching overwrites.
#[instrument(skip_all)]
pub async fn attach_broadcast(
    user: AuthUser,
    State(state): State<WachatAbTestingState>,
    Path((id, variant)): Path<(String, String)>,
    Json(body): Json<AttachBroadcastBody>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;

    let variant = variant.trim().to_uppercase();
    if variant != "A" && variant != "B" {
        return Err(ApiError::Validation(
            "variant must be 'A' or 'B'.".to_owned(),
        ));
    }
    if body.broadcast_id.trim().is_empty() {
        return Err(ApiError::Validation("broadcastId is required.".to_owned()));
    }
    let broadcast_oid = oid_from_str(body.broadcast_id.trim())?;

    // Load the test (scoped to caller) so we know its project for the guard.
    let test = state
        .mongo
        .collection::<Document>(TESTS_COLL)
        .find_one(doc! { "_id": oid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("ab_tests.find_one")))?
        .ok_or_else(|| ApiError::NotFound("A/B test not found.".to_owned()))?;
    let project_oid = test
        .get_object_id("projectId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("test missing projectId")))?;

    // Multi-tenant guard: the broadcast must live under the same project,
    // and the caller must own-or-agent that project.
    load_project_with_membership(uid, &state.mongo, &project_oid.to_hex()).await?;
    let broadcast = state
        .mongo
        .collection::<Document>(BROADCASTS_COLL)
        .find_one(doc! { "_id": broadcast_oid, "projectId": project_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("broadcasts.find_one")))?;
    if broadcast.is_none() {
        return Err(ApiError::NotFound(
            "Broadcast not found in this project.".to_owned(),
        ));
    }

    let field = if variant == "A" {
        "variantA.broadcastId"
    } else {
        "variantB.broadcastId"
    };
    let now = bson::DateTime::from_chrono(Utc::now());
    let res = state
        .mongo
        .collection::<Document>(TESTS_COLL)
        .update_one(
            doc! { "_id": oid, "userId": uid },
            doc! { "$set": { field: broadcast_oid, "updatedAt": now } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("ab_tests.attach_broadcast"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("A/B test not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/wachat/ab-tests/{id}/stop
// ===========================================================================

#[instrument(skip_all)]
pub async fn stop_test(
    user: AuthUser,
    State(state): State<WachatAbTestingState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = bson::DateTime::from_chrono(Utc::now());

    let res = state
        .mongo
        .collection::<Document>(TESTS_COLL)
        .update_one(
            doc! { "_id": oid, "userId": uid },
            doc! { "$set": { "status": "stopped", "updatedAt": now } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("ab_tests.stop")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("A/B test not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/wachat/ab-tests/{id}/promote-winner
// ===========================================================================

#[instrument(skip_all)]
pub async fn promote_winner(
    user: AuthUser,
    State(state): State<WachatAbTestingState>,
    Path(id): Path<String>,
    Json(body): Json<PromoteWinnerBody>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;

    let winner = body.winner_variant.trim().to_uppercase();
    if winner != "A" && winner != "B" {
        return Err(ApiError::Validation(
            "winnerVariant must be 'A' or 'B'.".to_owned(),
        ));
    }
    let now = bson::DateTime::from_chrono(Utc::now());

    let res = state
        .mongo
        .collection::<Document>(TESTS_COLL)
        .update_one(
            doc! { "_id": oid, "userId": uid },
            doc! { "$set": {
                "status": "completed",
                "winnerVariant": &winner,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("ab_tests.promote")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("A/B test not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/wachat/ab-tests/{id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn delete_test(
    user: AuthUser,
    State(state): State<WachatAbTestingState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;

    let res = state
        .mongo
        .collection::<Document>(TESTS_COLL)
        .delete_one(doc! { "_id": oid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("ab_tests.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("A/B test not found.".to_owned()));
    }

    // Best-effort cleanup of the orphaned result rows.
    state
        .mongo
        .collection::<Document>(RESULTS_COLL)
        .delete_many(doc! { "testId": oid, "userId": uid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("ab_test_results.delete_many"))
        })?;

    Ok(Json(SuccessResponse::ok()))
}
