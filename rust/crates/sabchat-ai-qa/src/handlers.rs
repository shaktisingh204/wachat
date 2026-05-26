//! HTTP handlers for the SabChat AI QA domain.
//!
//! Each handler maps 1:1 to a route registered in [`crate::router`]:
//!
//! | Endpoint                                      | Handler                              |
//! |-----------------------------------------------|--------------------------------------|
//! | `POST   /rubrics`                             | [`create_rubric`]                    |
//! | `GET    /rubrics`                             | [`list_rubrics`]                     |
//! | `GET    /rubrics/{id}`                        | [`get_rubric`]                       |
//! | `PATCH  /rubrics/{id}`                        | [`update_rubric`]                    |
//! | `DELETE /rubrics/{id}`                        | [`delete_rubric`]                    |
//! | `POST   /grade/{conversationId}`              | [`grade_conversation`]               |
//! | `POST   /manual/{conversationId}`             | [`manual_grade_conversation`]        |
//! | `GET    /scores`                              | [`list_scores`]                      |
//! | `GET    /scores/{id}`                         | [`get_score`]                        |
//! | `GET    /leaderboard`                         | [`leaderboard`]                      |
//!
//! ## Tenancy
//!
//! Every Mongo read + write is scoped by `tenantId == auth.tenant_id`.
//! A document that exists under a different tenant looks
//! indistinguishable from "not found" to the caller — that matches the
//! SabChat-wide convention.
//!
//! ## Score totalling
//!
//! `total = Σ score_i × weight_i`, `max = Σ weight_i`. The handler
//! computes both server-side from the supplied per-criterion scores and
//! the persisted rubric weights so callers cannot tamper with them on
//! the wire. Missing keys are treated as `0.0`; unknown keys submitted
//! on the manual path are dropped (a warning is logged but the request
//! still succeeds — partial coverage is fine, junk should not be
//! persisted).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabchat_types::SenderType;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::{instrument, warn};

use crate::dto::{
    CreateRubricBody, DocResponse, GradeRequest, LeaderboardEntry, LeaderboardQuery,
    LeaderboardResponse, ListRubricsQuery, ListRubricsResponse, ListScoresQuery,
    ListScoresResponse, MAX_LIST_LIMIT, ManualGradeRequest, ScoreResponse, SuccessResponse,
    UpdateRubricBody,
};
use crate::grader::{CriterionScore, GraderMessage, Rubric, RubricCriterion};
use crate::state::SabChatAiQaState;

// ---------------------------------------------------------------------------
// Collection names — match the slice spec verbatim.
// ---------------------------------------------------------------------------

const RUBRICS_COLL: &str = "sabchat_qa_rubrics";
const SCORES_COLL: &str = "sabchat_qa_scores";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";

/// Number of trailing messages the grader receives. Matches the slice
/// spec ("last 50 messages").
const HISTORY_WINDOW: i64 = 50;

// ===========================================================================
// Helpers — auth + tenant
// ===========================================================================

/// Parse `auth.tenant_id` into an `ObjectId` or fail with 401.
fn tenant_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Parse `auth.user_id` into an `ObjectId`. Used by the manual-grade
/// path to attribute the score to the submitting agent.
fn user_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

// ===========================================================================
// Helpers — rubric persistence
// ===========================================================================

/// Build the BSON form of a list of [`RubricCriterion`]s. Embedded as
/// an array of documents inside the rubric doc.
fn criteria_to_bson(criteria: &[RubricCriterion]) -> Bson {
    Bson::Array(
        criteria
            .iter()
            .map(|c| {
                Bson::Document(doc! {
                    "key": &c.key,
                    "label": &c.label,
                    "weight": c.weight as f64,
                })
            })
            .collect(),
    )
}

/// Load a rubric by `_id + tenantId`. 404 if not found / cross-tenant.
async fn load_rubric(
    mongo: &MongoHandle,
    tenant: ObjectId,
    rubric_id_hex: &str,
) -> Result<(ObjectId, Rubric)> {
    let rubric_oid = oid_from_str(rubric_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid rubric id.".to_owned()))?;
    let coll = mongo.collection::<Document>(RUBRICS_COLL);
    let doc_ = coll
        .find_one(doc! { "_id": rubric_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_rubrics.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Rubric not found.".to_owned()))?;
    Ok((rubric_oid, rubric_from_doc(&doc_)?))
}

/// Read a stored rubric document back into the [`Rubric`] view the
/// grader expects. Stored field names are camelCase (Mongo convention
/// across SabChat) — see [`crate::lib`] doc for the shape.
fn rubric_from_doc(doc_: &Document) -> Result<Rubric> {
    let id_hex = doc_
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("rubric missing _id")))?
        .to_hex();
    let name = doc_
        .get_str("name")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("rubric missing name")))?
        .to_owned();

    let mut criteria: Vec<RubricCriterion> = Vec::new();
    if let Ok(arr) = doc_.get_array("criteria") {
        for entry in arr {
            let Bson::Document(d) = entry else {
                continue;
            };
            let Ok(key) = d.get_str("key") else { continue };
            let label = d.get_str("label").unwrap_or(key).to_owned();
            // Mongo can store the weight as int (`i32`/`i64`) or
            // double — accept either, fall back to `1.0`.
            let weight = d
                .get_f64("weight")
                .ok()
                .or_else(|| d.get_i32("weight").ok().map(|v| v as f64))
                .or_else(|| d.get_i64("weight").ok().map(|v| v as f64))
                .unwrap_or(1.0) as f32;
            criteria.push(RubricCriterion {
                key: key.to_owned(),
                label,
                weight,
            });
        }
    }

    Ok(Rubric {
        id: id_hex,
        name,
        criteria,
    })
}

/// Reject empty / malformed rubrics at the edge. Mirrors the legacy TS
/// validation a manager would face in the UI.
fn validate_create_body(body: &CreateRubricBody) -> Result<()> {
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("Rubric name is required.".to_owned()));
    }
    if body.criteria.is_empty() {
        return Err(ApiError::Validation(
            "Rubric must contain at least one criterion.".to_owned(),
        ));
    }
    for c in &body.criteria {
        if c.key.trim().is_empty() || c.label.trim().is_empty() {
            return Err(ApiError::Validation(
                "Every criterion must have a key and a label.".to_owned(),
            ));
        }
        if !c.weight.is_finite() || c.weight < 0.0 {
            return Err(ApiError::Validation(
                "Criterion weight must be a non-negative finite number.".to_owned(),
            ));
        }
    }
    Ok(())
}

// ===========================================================================
// POST /rubrics
// ===========================================================================

/// `POST /rubrics` — create a new rubric under the caller's tenant.
#[instrument(skip_all, fields(name = %body.name))]
pub async fn create_rubric(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Json(body): Json<CreateRubricBody>,
) -> Result<Json<DocResponse>> {
    validate_create_body(&body)?;
    let tenant = tenant_oid(&auth)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let doc_ = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "name": body.name.trim(),
        "criteria": criteria_to_bson(&body.criteria),
        "active": body.active,
        "createdAt": now,
        "updatedAt": now,
    };

    state
        .mongo
        .collection::<Document>(RUBRICS_COLL)
        .insert_one(doc_.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_rubrics.insert_one"))
        })?;

    Ok(Json(DocResponse {
        doc: document_to_clean_json(doc_),
    }))
}

// ===========================================================================
// GET /rubrics
// ===========================================================================

/// `GET /rubrics` — list every rubric for the caller's tenant.
#[instrument(skip_all)]
pub async fn list_rubrics(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Query(q): Query<ListRubricsQuery>,
) -> Result<Json<ListRubricsResponse>> {
    let tenant = tenant_oid(&auth)?;
    let mut filter = doc! { "tenantId": tenant };
    if let Some(active) = q.active {
        filter.insert("active", active);
    }
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).build();
    let coll = state.mongo.collection::<Document>(RUBRICS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_rubrics.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_rubrics.collect"))
    })?;
    let rubrics: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListRubricsResponse { rubrics }))
}

// ===========================================================================
// GET /rubrics/{id}
// ===========================================================================

/// `GET /rubrics/{id}` — fetch one rubric scoped to the caller's tenant.
#[instrument(skip_all, fields(rubric_id = %rubric_id))]
pub async fn get_rubric(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Path(rubric_id): Path<String>,
) -> Result<Json<DocResponse>> {
    let tenant = tenant_oid(&auth)?;
    let rubric_oid = oid_from_str(&rubric_id)
        .map_err(|_| ApiError::BadRequest("Invalid rubric id.".to_owned()))?;
    let doc_ = state
        .mongo
        .collection::<Document>(RUBRICS_COLL)
        .find_one(doc! { "_id": rubric_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_rubrics.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Rubric not found.".to_owned()))?;
    Ok(Json(DocResponse {
        doc: document_to_clean_json(doc_),
    }))
}

// ===========================================================================
// PATCH /rubrics/{id}
// ===========================================================================

/// `PATCH /rubrics/{id}` — partial update. Only supplied fields are
/// `$set`. `updatedAt` is bumped on every call (even an empty body) so
/// callers have a reliable "last touched" timestamp.
#[instrument(skip_all, fields(rubric_id = %rubric_id))]
pub async fn update_rubric(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Path(rubric_id): Path<String>,
    Json(body): Json<UpdateRubricBody>,
) -> Result<Json<DocResponse>> {
    let tenant = tenant_oid(&auth)?;
    let rubric_oid = oid_from_str(&rubric_id)
        .map_err(|_| ApiError::BadRequest("Invalid rubric id.".to_owned()))?;

    let mut set_doc = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(name) = body.name.as_deref().filter(|s| !s.trim().is_empty()) {
        set_doc.insert("name", name.trim());
    }
    if let Some(criteria) = body.criteria.as_ref() {
        // Re-validate criteria shape (mirrors `validate_create_body`'s
        // per-criterion rules so an update cannot smuggle in junk).
        if criteria.is_empty() {
            return Err(ApiError::Validation(
                "Rubric must contain at least one criterion.".to_owned(),
            ));
        }
        for c in criteria {
            if c.key.trim().is_empty() || c.label.trim().is_empty() {
                return Err(ApiError::Validation(
                    "Every criterion must have a key and a label.".to_owned(),
                ));
            }
            if !c.weight.is_finite() || c.weight < 0.0 {
                return Err(ApiError::Validation(
                    "Criterion weight must be a non-negative finite number.".to_owned(),
                ));
            }
        }
        set_doc.insert("criteria", criteria_to_bson(criteria));
    }
    if let Some(active) = body.active {
        set_doc.insert("active", active);
    }

    let coll = state.mongo.collection::<Document>(RUBRICS_COLL);
    let res = coll
        .find_one_and_update(
            doc! { "_id": rubric_oid, "tenantId": tenant },
            doc! { "$set": set_doc },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_qa_rubrics.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Rubric not found.".to_owned()))?;

    Ok(Json(DocResponse {
        doc: document_to_clean_json(res),
    }))
}

// ===========================================================================
// DELETE /rubrics/{id}
// ===========================================================================

/// `DELETE /rubrics/{id}` — remove a rubric. Persisted scores that
/// reference the rubric stay intact (they preserve a snapshot of the
/// criteria, so historical leaderboards remain meaningful).
#[instrument(skip_all, fields(rubric_id = %rubric_id))]
pub async fn delete_rubric(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Path(rubric_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&auth)?;
    let rubric_oid = oid_from_str(&rubric_id)
        .map_err(|_| ApiError::BadRequest("Invalid rubric id.".to_owned()))?;
    let res = state
        .mongo
        .collection::<Document>(RUBRICS_COLL)
        .delete_one(doc! { "_id": rubric_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_rubrics.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Rubric not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /grade/{conversationId}
// ===========================================================================

/// `POST /grade/{conversationId}` — AI auto-grade.
///
/// Loads the conversation under the caller's tenant, pulls the last
/// [`HISTORY_WINDOW`] messages in chronological order, hands them to
/// the configured [`Grader`](crate::grader::Grader), computes the
/// weighted total, and persists into `sabchat_qa_scores` with
/// `gradedBy: "ai"`.
#[instrument(skip_all, fields(conversation_id = %conversation_id))]
pub async fn grade_conversation(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<GradeRequest>,
) -> Result<Json<ScoreResponse>> {
    let tenant = tenant_oid(&auth)?;
    let (conv_oid, conv_doc) = load_conversation(&state.mongo, tenant, &conversation_id).await?;
    let (rubric_oid, rubric) = load_rubric(&state.mongo, tenant, &body.rubric_id).await?;
    let history = load_grader_history(&state.mongo, tenant, conv_oid).await?;

    let grade = state
        .grader
        .grade(&rubric, &history)
        .await
        .map_err(|e| ApiError::Internal(e.context("grader.grade")))?;

    // Normalise: keep only scores whose keys appear in the rubric. Out
    // of order is fine; missing keys are inserted as 0.0 so totalling
    // is deterministic.
    let scores = normalise_scores(&rubric, grade.scores);
    let (total, max) = compute_totals(&rubric, &scores);

    let assignee = conv_doc.get_object_id("assigneeId").ok();
    let inbox = conv_doc.get_object_id("inboxId").ok();

    let now = Utc::now();
    let new_oid = ObjectId::new();
    let stored = build_score_doc(
        new_oid,
        tenant,
        conv_oid,
        rubric_oid,
        &scores,
        total,
        max,
        grade.coaching.as_deref(),
        "ai",
        assignee,
        inbox,
        now,
    );
    state
        .mongo
        .collection::<Document>(SCORES_COLL)
        .insert_one(stored)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_scores.insert_one"))
        })?;

    Ok(Json(score_response(
        new_oid,
        tenant,
        conv_oid,
        rubric_oid,
        scores,
        total,
        max,
        grade.coaching,
        "ai",
        assignee,
        now,
    )))
}

// ===========================================================================
// POST /manual/{conversationId}
// ===========================================================================

/// `POST /manual/{conversationId}` — agent-submitted manual grade.
///
/// The agent's user id is read off the auth context (NOT the body) and
/// recorded as `agentId` / `gradedBy: "agent"`. Scores are validated
/// against the rubric: unknown criterion keys are dropped (logged), and
/// every kept score is clamped into `[0.0, 1.0]`.
#[instrument(skip_all, fields(conversation_id = %conversation_id))]
pub async fn manual_grade_conversation(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<ManualGradeRequest>,
) -> Result<Json<ScoreResponse>> {
    let tenant = tenant_oid(&auth)?;
    let agent = user_oid(&auth)?;
    let (conv_oid, conv_doc) = load_conversation(&state.mongo, tenant, &conversation_id).await?;
    let (rubric_oid, rubric) = load_rubric(&state.mongo, tenant, &body.rubric_id).await?;

    // ---- Filter + clamp submitted scores --------------------------------
    let mut accepted: Vec<CriterionScore> = Vec::new();
    let valid_keys: std::collections::HashSet<&str> =
        rubric.criteria.iter().map(|c| c.key.as_str()).collect();
    for s in body.scores {
        if !valid_keys.contains(s.key.as_str()) {
            warn!(key = %s.key, "manual grade: ignoring unknown criterion key");
            continue;
        }
        let clamped = s.score.clamp(0.0, 1.0);
        accepted.push(CriterionScore {
            key: s.key,
            score: clamped,
            notes: s.notes,
        });
    }
    let scores = normalise_scores(&rubric, accepted);
    let (total, max) = compute_totals(&rubric, &scores);

    let inbox = conv_doc.get_object_id("inboxId").ok();

    let now = Utc::now();
    let new_oid = ObjectId::new();
    let stored = build_score_doc(
        new_oid,
        tenant,
        conv_oid,
        rubric_oid,
        &scores,
        total,
        max,
        body.coaching.as_deref(),
        "agent",
        Some(agent),
        inbox,
        now,
    );
    state
        .mongo
        .collection::<Document>(SCORES_COLL)
        .insert_one(stored)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_qa_scores.insert_one(manual)"),
            )
        })?;

    Ok(Json(score_response(
        new_oid,
        tenant,
        conv_oid,
        rubric_oid,
        scores,
        total,
        max,
        body.coaching,
        "agent",
        Some(agent),
        now,
    )))
}

// ===========================================================================
// GET /scores
// ===========================================================================

/// `GET /scores` — filtered, cursor-paginated score listing. Sorted
/// newest-first on `_id` (which is monotonic with `gradedAt` because
/// we mint it via [`ObjectId::new`] at write time).
#[instrument(skip_all)]
pub async fn list_scores(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Query(q): Query<ListScoresQuery>,
) -> Result<Json<ListScoresResponse>> {
    let tenant = tenant_oid(&auth)?;
    let mut filter = doc! { "tenantId": tenant };
    if let Some(id) = q.conversation_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("conversationId", oid_from_str(id)?);
    }
    if let Some(id) = q.rubric_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("rubricId", oid_from_str(id)?);
    }
    if let Some(id) = q.agent_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("agentId", oid_from_str(id)?);
    }

    let mut bounds = Document::new();
    if let Some(raw) = q.from.as_deref().filter(|s| !s.is_empty()) {
        bounds.insert("$gte", parse_rfc3339("from", raw)?);
    }
    if let Some(raw) = q.to.as_deref().filter(|s| !s.is_empty()) {
        bounds.insert("$lt", parse_rfc3339("to", raw)?);
    }
    if !bounds.is_empty() {
        filter.insert("gradedAt", bounds);
    }

    if let Some(raw) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        let cursor_oid = oid_from_str(raw)?;
        filter.insert("_id", doc! { "$lt": cursor_oid });
    }

    let limit = q.limit.clamp(1, MAX_LIST_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();
    let coll = state.mongo.collection::<Document>(SCORES_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_scores.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_scores.collect"))
    })?;

    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    };

    let scores: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListScoresResponse {
        scores,
        next_cursor,
    }))
}

// ===========================================================================
// GET /scores/{id}
// ===========================================================================

/// `GET /scores/{id}` — fetch one persisted score scoped to the
/// caller's tenant.
#[instrument(skip_all, fields(score_id = %score_id))]
pub async fn get_score(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Path(score_id): Path<String>,
) -> Result<Json<DocResponse>> {
    let tenant = tenant_oid(&auth)?;
    let score_oid = oid_from_str(&score_id)
        .map_err(|_| ApiError::BadRequest("Invalid score id.".to_owned()))?;
    let doc_ = state
        .mongo
        .collection::<Document>(SCORES_COLL)
        .find_one(doc! { "_id": score_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_scores.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Score not found.".to_owned()))?;
    Ok(Json(DocResponse {
        doc: document_to_clean_json(doc_),
    }))
}

// ===========================================================================
// GET /leaderboard
// ===========================================================================

/// `GET /leaderboard` — per-agent mean total score. Implemented with a
/// straight `$group` aggregation so we get correct means even when an
/// agent has dozens of grades.
#[instrument(skip_all)]
pub async fn leaderboard(
    auth: AuthUser,
    State(state): State<SabChatAiQaState>,
    Query(q): Query<LeaderboardQuery>,
) -> Result<Json<LeaderboardResponse>> {
    let tenant = tenant_oid(&auth)?;
    let mut match_doc = doc! { "tenantId": tenant };
    if let Some(id) = q.rubric_id.as_deref().filter(|s| !s.is_empty()) {
        match_doc.insert("rubricId", oid_from_str(id)?);
    }
    let mut bounds = Document::new();
    if let Some(raw) = q.from.as_deref().filter(|s| !s.is_empty()) {
        bounds.insert("$gte", parse_rfc3339("from", raw)?);
    }
    if let Some(raw) = q.to.as_deref().filter(|s| !s.is_empty()) {
        bounds.insert("$lt", parse_rfc3339("to", raw)?);
    }
    if !bounds.is_empty() {
        match_doc.insert("gradedAt", bounds);
    }

    let pipeline = vec![
        doc! { "$match": match_doc },
        doc! { "$group": {
            "_id": "$agentId",
            "count": { "$sum": 1i32 },
            "meanTotal": { "$avg": "$total" },
            "meanMax": { "$avg": "$max" },
        } },
        doc! { "$sort": { "meanTotal": -1i32 } },
    ];

    let coll = state.mongo.collection::<Document>(SCORES_COLL);
    let cursor = coll.aggregate(pipeline).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_qa_scores.aggregate"))
    })?;
    let rows: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_qa_scores.aggregate.collect"),
        )
    })?;

    let entries: Vec<LeaderboardEntry> = rows
        .iter()
        .map(|d| {
            let agent_id = d
                .get("_id")
                .and_then(|b| match b {
                    Bson::ObjectId(o) => Some(o.to_hex()),
                    _ => None,
                });
            let count = d
                .get_i32("count")
                .map(|v| v as u64)
                .or_else(|_| d.get_i64("count").map(|v| v as u64))
                .unwrap_or(0);
            let mean_total = d.get_f64("meanTotal").unwrap_or(0.0) as f32;
            let mean_max = d.get_f64("meanMax").unwrap_or(0.0) as f32;
            LeaderboardEntry {
                agent_id,
                count,
                mean_total,
                mean_max,
            }
        })
        .collect();

    Ok(Json(LeaderboardResponse { entries }))
}

// ===========================================================================
// Shared helpers — conversation / history / totals / score doc shape
// ===========================================================================

/// Load a conversation by `_id + tenantId`. Returns 404 if not found
/// or cross-tenant. Also surfaces the raw document so the grading
/// handlers can read `assigneeId` / `inboxId` for denormalisation.
async fn load_conversation(
    mongo: &MongoHandle,
    tenant: ObjectId,
    conv_id_hex: &str,
) -> Result<(ObjectId, Document)> {
    let oid = oid_from_str(conv_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;
    let doc_ = mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.find_one(qa)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))?;
    Ok((oid, doc_))
}

/// Load the last [`HISTORY_WINDOW`] messages of a conversation in
/// chronological order and project them into [`GraderMessage`] form.
async fn load_grader_history(
    mongo: &MongoHandle,
    tenant: ObjectId,
    conversation_oid: ObjectId,
) -> Result<Vec<GraderMessage>> {
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(HISTORY_WINDOW)
        .build();
    let cursor = mongo
        .collection::<Document>(MESSAGES_COLL)
        .find(doc! {
            "tenantId": tenant,
            "conversationId": conversation_oid,
        })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find(qa)"))
        })?;
    let mut docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.collect(qa)"))
    })?;
    docs.reverse();

    Ok(docs.iter().map(message_to_grader).collect())
}

/// Project a stored message document into the [`GraderMessage`] view.
/// Text is extracted from the `content.kind == "text"` block; non-text
/// blocks render to a short placeholder so the grader sees the shape.
fn message_to_grader(d: &Document) -> GraderMessage {
    let sender_type = d
        .get_str("senderType")
        .map(str::to_owned)
        .unwrap_or_else(|_| sender_type_as_str(SenderType::Visitor).to_owned());
    let private = d.get_bool("private").unwrap_or(false);
    let text = extract_message_text(d);
    GraderMessage {
        sender_type,
        text,
        private,
    }
}

fn sender_type_as_str(s: SenderType) -> &'static str {
    match s {
        SenderType::Visitor => "visitor",
        SenderType::Agent => "agent",
        SenderType::Bot => "bot",
        SenderType::System => "system",
    }
}

/// Pull text out of a stored message's `content` block. Falls back to
/// a `[kind]` placeholder for non-text blocks so the grader receives
/// a complete history slice (an image-only customer reply is still
/// useful signal — "agent left an image unanswered").
fn extract_message_text(d: &Document) -> String {
    let Ok(content) = d.get_document("content") else {
        return String::new();
    };
    let Ok(kind) = content.get_str("kind") else {
        return String::new();
    };
    if kind == "text" {
        content.get_str("text").unwrap_or("").to_owned()
    } else {
        format!("[{kind}]")
    }
}

/// Re-order + backfill scores so the persisted array matches the
/// rubric criterion order exactly. Missing keys are inserted as
/// `0.0`; the caller is expected to have already dropped unknown
/// keys.
fn normalise_scores(rubric: &Rubric, scored: Vec<CriterionScore>) -> Vec<CriterionScore> {
    let mut by_key: std::collections::HashMap<String, CriterionScore> =
        scored.into_iter().map(|s| (s.key.clone(), s)).collect();
    rubric
        .criteria
        .iter()
        .map(|c| {
            by_key.remove(&c.key).unwrap_or_else(|| CriterionScore {
                key: c.key.clone(),
                score: 0.0,
                notes: None,
            })
        })
        .collect()
}

/// Compute `(total, max)` from the rubric weights and the supplied
/// scores. `scores` is expected to be aligned with `rubric.criteria`
/// (see [`normalise_scores`]).
fn compute_totals(rubric: &Rubric, scores: &[CriterionScore]) -> (f32, f32) {
    let mut total = 0.0_f32;
    let mut max = 0.0_f32;
    for (c, s) in rubric.criteria.iter().zip(scores.iter()) {
        total += s.score * c.weight;
        max += c.weight;
    }
    (total, max)
}

/// Build the persisted `sabchat_qa_scores` document.
#[allow(clippy::too_many_arguments)]
fn build_score_doc(
    new_oid: ObjectId,
    tenant: ObjectId,
    conv_oid: ObjectId,
    rubric_oid: ObjectId,
    scores: &[CriterionScore],
    total: f32,
    max: f32,
    coaching: Option<&str>,
    graded_by: &str,
    agent_id: Option<ObjectId>,
    inbox_id: Option<ObjectId>,
    graded_at: DateTime<Utc>,
) -> Document {
    let scores_bson = Bson::Array(
        scores
            .iter()
            .map(|s| {
                let mut d = doc! {
                    "key": &s.key,
                    "score": s.score as f64,
                };
                if let Some(n) = s.notes.as_deref() {
                    d.insert("notes", n);
                }
                Bson::Document(d)
            })
            .collect(),
    );
    let mut d = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "conversationId": conv_oid,
        "rubricId": rubric_oid,
        "scores": scores_bson,
        "total": total as f64,
        "max": max as f64,
        "gradedBy": graded_by,
        "gradedAt": bson::DateTime::from_chrono(graded_at),
    };
    if let Some(c) = coaching {
        d.insert("coaching", c);
    }
    if let Some(a) = agent_id {
        d.insert("agentId", a);
    }
    if let Some(i) = inbox_id {
        d.insert("inboxId", i);
    }
    d
}

/// Build the wire-format response that mirrors what we just persisted.
#[allow(clippy::too_many_arguments)]
fn score_response(
    new_oid: ObjectId,
    tenant: ObjectId,
    conv_oid: ObjectId,
    rubric_oid: ObjectId,
    scores: Vec<CriterionScore>,
    total: f32,
    max: f32,
    coaching: Option<String>,
    graded_by: &str,
    agent_id: Option<ObjectId>,
    graded_at: DateTime<Utc>,
) -> ScoreResponse {
    ScoreResponse {
        id: new_oid.to_hex(),
        tenant_id: tenant.to_hex(),
        conversation_id: conv_oid.to_hex(),
        rubric_id: rubric_oid.to_hex(),
        scores,
        total,
        max,
        coaching,
        graded_by: graded_by.to_owned(),
        graded_at: graded_at.to_rfc3339(),
        agent_id: agent_id.map(|a| a.to_hex()),
    }
}

/// RFC 3339 → `bson::DateTime`. Returns a 400 on parse failure with a
/// field-named message so the caller can localise the error.
fn parse_rfc3339(field: &str, raw: &str) -> Result<bson::DateTime> {
    let parsed = DateTime::parse_from_rfc3339(raw)
        .map_err(|e| ApiError::BadRequest(format!("invalid `{field}` timestamp: {e}")))?;
    Ok(bson::DateTime::from_chrono(parsed.with_timezone(&Utc)))
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_rubric() -> Rubric {
        Rubric {
            id: "000000000000000000000000".to_owned(),
            name: "default".to_owned(),
            criteria: vec![
                RubricCriterion {
                    key: "greeting".to_owned(),
                    label: "Greeting".to_owned(),
                    weight: 1.0,
                },
                RubricCriterion {
                    key: "empathy".to_owned(),
                    label: "Empathy".to_owned(),
                    weight: 2.0,
                },
            ],
        }
    }

    #[test]
    fn compute_totals_weighted_sum() {
        let r = sample_rubric();
        let scores = vec![
            CriterionScore {
                key: "greeting".to_owned(),
                score: 1.0,
                notes: None,
            },
            CriterionScore {
                key: "empathy".to_owned(),
                score: 0.5,
                notes: None,
            },
        ];
        let (total, max) = compute_totals(&r, &scores);
        // 1.0*1.0 + 0.5*2.0 = 2.0, 1.0 + 2.0 = 3.0
        assert!((total - 2.0).abs() < f32::EPSILON);
        assert!((max - 3.0).abs() < f32::EPSILON);
    }

    #[test]
    fn normalise_scores_fills_missing_with_zero_and_reorders() {
        let r = sample_rubric();
        // Submit out of order, only "empathy".
        let submitted = vec![CriterionScore {
            key: "empathy".to_owned(),
            score: 0.9,
            notes: None,
        }];
        let out = normalise_scores(&r, submitted);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].key, "greeting");
        assert!((out[0].score - 0.0).abs() < f32::EPSILON);
        assert_eq!(out[1].key, "empathy");
        assert!((out[1].score - 0.9).abs() < f32::EPSILON);
    }
}
