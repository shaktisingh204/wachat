//! HTTP handlers for the wachat ab-testing domain.
//!
//! Backs the `/wachat/campaign-ab-test` page. Every endpoint is scoped
//! to the authenticated user (`userId`) AND the owning project
//! (`projectId`), via the owner-or-agent guard mirrored from
//! `wachat-contacts`.
//!
//! | Endpoint                                       | Action                       |
//! |------------------------------------------------|------------------------------|
//! | `GET    /v1/wachat/ab-tests?projectId=`        | list tests (+ summary)       |
//! | `POST   /v1/wachat/ab-tests`                   | create + launch a test       |
//! | `GET    /v1/wachat/ab-tests/{id}`              | detail + per-variant results |
//! | `POST   /v1/wachat/ab-tests/{id}/stop`         | mark `status="stopped"`      |
//! | `POST   /v1/wachat/ab-tests/{id}/promote-winner` | `status="completed"` + winner |
//! | `DELETE /v1/wachat/ab-tests/{id}`              | delete test + its results    |
//!
//! ## Storage
//!
//! Two NEW collections (no pre-existing data — confirmed by grep, so
//! these `wa_*` names do not collide with the two-store gotcha):
//!
//! - `wa_ab_tests`        — one config doc per test.
//! - `wa_ab_test_results` — one row per `{ testId, variant }`, seeded
//!   with zeros on create and later updated by the broadcast webhook.
//!
//! This crate deliberately does NOT call `wachat-broadcast` cross-crate.
//! It only persists the config + results scaffold; the Next server
//! action fires the actual split broadcast.

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
    CreateTestBody, ListTestsQuery, ListTestsResponse, PromoteWinnerBody, SuccessResponse,
    TestDetailResponse, VariantInput, VariantResult,
};
use crate::state::WachatAbTestingState;

/// Test config docs.
const TESTS_COLL: &str = "wa_ab_tests";
/// Per-variant result rows (`{ testId, variant, sent, opened, replied }`).
const RESULTS_COLL: &str = "wa_ab_test_results";
/// Project membership lookups (shared collection — must match the real
/// name; see the two-store gotcha).
const PROJECTS_COLL: &str = "projects";

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

/// Read an integer metric off a results doc, defaulting to 0.
fn metric(doc: &Document, key: &str) -> i64 {
    doc.get(key)
        .and_then(Bson::as_i64)
        .or_else(|| doc.get(key).and_then(Bson::as_i32).map(i64::from))
        .unwrap_or(0)
}

/// Compute a rate in `0.0..=1.0`, guarding divide-by-zero.
fn rate(num: i64, den: i64) -> f64 {
    if den > 0 {
        num as f64 / den as f64
    } else {
        0.0
    }
}

/// Fetch the two result rows for a test and fold them into `VariantResult`s.
/// Missing rows surface as all-zero variants so the UI always has A and B.
async fn variant_results(mongo: &MongoHandle, test_oid: ObjectId) -> Result<Vec<VariantResult>> {
    let coll = mongo.collection::<Document>(RESULTS_COLL);
    let cursor = coll
        .find(doc! { "testId": test_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("results.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("results.collect")))?;

    let mut out = Vec::with_capacity(2);
    for variant in ["A", "B"] {
        let row = docs
            .iter()
            .find(|d| d.get_str("variant").map(|s| s == variant).unwrap_or(false));
        let (sent, opened, replied) = match row {
            Some(d) => (metric(d, "sent"), metric(d, "opened"), metric(d, "replied")),
            None => (0, 0, 0),
        };
        out.push(VariantResult {
            variant: variant.to_owned(),
            sent,
            opened,
            replied,
            open_rate: rate(opened, sent),
            reply_rate: rate(replied, sent),
        });
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

    // Enrich each test with a light summary of its result metrics so the
    // list view can render totals without a second round trip per row.
    let mut tests = Vec::with_capacity(docs.len());
    for d in docs {
        let test_oid = d
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("test missing _id")))?;
        let variants = variant_results(&state.mongo, test_oid).await?;
        let total_sent: i64 = variants.iter().map(|v| v.sent).sum();
        let total_replied: i64 = variants.iter().map(|v| v.replied).sum();

        let mut row = document_to_clean_json(d);
        if let Value::Object(map) = &mut row {
            map.insert(
                "summary".to_owned(),
                serde_json::json!({
                    "totalSent": total_sent,
                    "totalReplied": total_replied,
                    "variants": variants.iter().map(|v| serde_json::json!({
                        "variant": v.variant,
                        "sent": v.sent,
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

    let variants = variant_results(&state.mongo, oid).await?;
    Ok(Json(TestDetailResponse {
        test: document_to_clean_json(test),
        variants,
    }))
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
