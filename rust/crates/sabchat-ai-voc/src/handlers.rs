//! HTTP handlers for the SabChat AI voice-of-customer domain.
//!
//! Each handler maps 1:1 to a route:
//!
//! | Endpoint                                                  | Handler                  |
//! |-----------------------------------------------------------|--------------------------|
//! | `POST /v1/sabchat/ai/voc/run`                             | [`run_voc`]              |
//! | `GET  /v1/sabchat/ai/voc/runs`                            | [`list_runs`]            |
//! | `GET  /v1/sabchat/ai/voc/runs/{id}`                       | [`get_run`]              |
//! | `GET  /v1/sabchat/ai/voc/topics`                          | [`list_topics`]          |
//! | `GET  /v1/sabchat/ai/voc/topics/{id}/messages`            | [`list_topic_messages`]  |
//!
//! ## Persistence shape
//!
//! `sabchat_voc_topics` (replaced on each successful run):
//! ```text
//! { _id, tenantId, label, examples: [string], messageCount,
//!   lastSeenAt, sentimentSkew, computedAt }
//! ```
//!
//! `sabchat_voc_runs` (append-only history):
//! ```text
//! { _id, tenantId, startedAt, completedAt?, status: "running"|"done"|"failed",
//!   messageCount, topicCount, error?, createdAt }
//! ```
//!
//! ## Tenancy
//!
//! Every read + write scopes by `tenantId == auth.tenant_id`. Cross-
//! tenant ids look indistinguishable from "not found" — that matches
//! the SabChat-wide convention.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use regex::Regex;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use tracing::instrument;

use crate::cluster::{Cluster, keywords_for_label};
use crate::dto::{
    DEFAULT_LOOKBACK_DAYS, DEFAULT_RUN_LIMIT, DEFAULT_TOPIC_LIMIT, DEFAULT_TOPIC_MESSAGE_LIMIT,
    GetRunResponse, ListRunsQuery, ListRunsResponse, ListTopicMessagesQuery,
    ListTopicMessagesResponse, ListTopicsQuery, ListTopicsResponse, MAX_RUN_LIMIT, MAX_TOPIC_LIMIT,
    MAX_TOPIC_MESSAGE_LIMIT, RunVocBody, RunVocResponse, clamp_limit,
};
use crate::state::SabChatAiVocState;

// ---------------------------------------------------------------------------
// Collection names — match the sibling SabChat handler crates verbatim.
// ---------------------------------------------------------------------------

/// Where visitor messages live. Read-only from this slice.
const MESSAGES_COLL: &str = "sabchat_messages";
/// Current top topics. Replaced on every successful run.
const TOPICS_COLL: &str = "sabchat_voc_topics";
/// Append-only run history.
const RUNS_COLL: &str = "sabchat_voc_runs";

/// Upper bound on how many visitor messages we feed into the
/// clusterer per run. Keeps memory + clusterer wall time bounded even
/// on huge tenants. 10k is generous: the keyword stub is O(n·k).
const MESSAGE_FETCH_CAP: i64 = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Parse `auth.tenant_id` into an `ObjectId` or fail with 401.
fn tenant_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Pull the plain text out of a stored message document, when the
/// message is a text block. Returns `None` for non-text content blocks
/// (image / file / card / etc.) so the run handler can skip them
/// silently.
fn extract_text_content(message: &Document) -> Option<String> {
    let content = message.get_document("content").ok()?;
    let kind = content.get_str("kind").ok()?;
    if kind != "text" {
        return None;
    }
    content.get_str("text").ok().map(str::to_owned)
}

/// Wall-clock `bson::DateTime` for "now". Centralised so every doc this
/// crate writes shares an identical timestamp.
fn now_bson() -> bson::DateTime {
    bson::DateTime::from_chrono(Utc::now())
}

/// Mark a run document as failed with the given error message. Best-
/// effort — we swallow secondary errors so the original failure
/// reaches the caller intact.
async fn mark_run_failed(mongo: &MongoHandle, tenant: ObjectId, run_oid: ObjectId, err: &str) {
    let coll = mongo.collection::<Document>(RUNS_COLL);
    let _ = coll
        .update_one(
            doc! { "_id": run_oid, "tenantId": tenant },
            doc! { "$set": {
                "status": "failed",
                "completedAt": now_bson(),
                "error": err,
            } },
        )
        .await;
}

// ===========================================================================
// POST /v1/sabchat/ai/voc/run
// ===========================================================================

/// `POST /run` — kick off a clustering run for the caller's tenant.
///
/// Pipeline:
///
/// 1. Insert a `sabchat_voc_runs` document with `status: "running"`.
/// 2. Pull visitor text messages since `body.since` (default 7 days),
///    capped at [`MESSAGE_FETCH_CAP`].
/// 3. Run the configured [`Clusterer`](crate::cluster::Clusterer).
/// 4. Replace `sabchat_voc_topics` for the tenant with the new set.
/// 5. Stamp the run as `done` with `messageCount` + `topicCount`.
///
/// On any failure between steps 2-4 the run is stamped `failed` with
/// the error message and the topics collection is left untouched. The
/// caller sees a normal `ApiError::Internal`.
#[instrument(skip_all, fields(tenant_id = %auth.tenant_id))]
pub async fn run_voc(
    auth: AuthUser,
    State(state): State<SabChatAiVocState>,
    Json(body): Json<RunVocBody>,
) -> Result<Json<RunVocResponse>> {
    let tenant = tenant_oid(&auth)?;

    // ---- 1. Insert the run doc in "running" state ---------------------
    let run_oid = ObjectId::new();
    let now = now_bson();
    let runs_coll = state.mongo.collection::<Document>(RUNS_COLL);
    runs_coll
        .insert_one(doc! {
            "_id": run_oid,
            "tenantId": tenant,
            "startedAt": now,
            "status": "running",
            "messageCount": 0_i64,
            "topicCount": 0_i64,
            "createdAt": now,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_runs.insert_one"))
        })?;

    // From here on, any error path must `mark_run_failed` before
    // propagating so the run document never gets stuck in "running".
    let outcome = run_voc_inner(&auth, &state, tenant, run_oid, body).await;

    match outcome {
        Ok(resp) => Ok(Json(resp)),
        Err(err) => {
            // Render the chain for the run-doc body without leaking it
            // to the HTTP response (the ApiError IntoResponse impl
            // redacts internal errors to "internal server error").
            let detail = match &err {
                ApiError::Internal(e) => format!("{e:#}"),
                other => other.to_string(),
            };
            mark_run_failed(&state.mongo, tenant, run_oid, &detail).await;
            Err(err)
        }
    }
}

/// Inner pipeline for [`run_voc`]. Split out so the outer wrapper can
/// flip the run-doc status to `failed` on any error without polluting
/// every `?` site with manual cleanup.
async fn run_voc_inner(
    _auth: &AuthUser,
    state: &SabChatAiVocState,
    tenant: ObjectId,
    run_oid: ObjectId,
    body: RunVocBody,
) -> Result<RunVocResponse> {
    // ---- 2. Load visitor text messages since `since` -------------------
    let since = body
        .since
        .unwrap_or_else(|| Utc::now() - Duration::days(DEFAULT_LOOKBACK_DAYS));
    let since_bson = bson::DateTime::from_chrono(since);

    let messages_coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let opts = FindOptions::builder()
        // Sort newest-first so the cap drops the oldest messages when
        // a tenant blows past `MESSAGE_FETCH_CAP`.
        .sort(doc! { "createdAt": -1 })
        .limit(MESSAGE_FETCH_CAP)
        .build();

    let cursor = messages_coll
        .find(doc! {
            "tenantId": tenant,
            "senderType": "visitor",
            "content.kind": "text",
            "createdAt": { "$gte": since_bson },
        })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find(voc)"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.collect(voc)"))
    })?;

    // `texts[i]` aligns 1:1 with `created_at[i]` so we can compute each
    // cluster's `lastSeenAt` without re-querying.
    let mut texts: Vec<String> = Vec::with_capacity(docs.len());
    let mut created_at: Vec<bson::DateTime> = Vec::with_capacity(docs.len());
    for d in &docs {
        if let Some(t) = extract_text_content(d) {
            texts.push(t);
            // Fall back to "now" when the document is missing a
            // timestamp — should never happen in practice but keeps
            // the inner pipeline total.
            let ts = d
                .get_datetime("createdAt")
                .copied()
                .unwrap_or_else(|_| now_bson());
            created_at.push(ts);
        }
    }
    let message_count = texts.len() as u32;

    // ---- 3. Cluster ----------------------------------------------------
    let clusters: Vec<Cluster> = state
        .clusterer
        .cluster(&texts)
        .await
        .map_err(|e| ApiError::Internal(e.context("clusterer.cluster")))?;

    // ---- 4. Replace existing topics for this tenant -------------------
    let topics_coll = state.mongo.collection::<Document>(TOPICS_COLL);
    topics_coll
        .delete_many(doc! { "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_topics.delete_many"))
        })?;

    let computed_at = now_bson();
    let mut new_docs: Vec<Document> = Vec::with_capacity(clusters.len());
    for c in &clusters {
        // `lastSeenAt` = max(createdAt) across the messages assigned
        // to this cluster. Since `texts`/`created_at` were built newest-
        // first the first index in `indices` is the newest message.
        let last_seen = c
            .indices
            .first()
            .and_then(|i| created_at.get(*i).copied())
            .unwrap_or(computed_at);

        let examples_bson: Vec<Bson> = c.examples.iter().map(|s| Bson::String(s.clone())).collect();

        new_docs.push(doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "label": &c.label,
            "examples": Bson::Array(examples_bson),
            "messageCount": c.indices.len() as i64,
            "lastSeenAt": last_seen,
            "sentimentSkew": c.sentiment_skew as f64,
            "computedAt": computed_at,
        });
    }

    let topic_count = new_docs.len() as u32;
    if !new_docs.is_empty() {
        topics_coll.insert_many(new_docs).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_topics.insert_many"))
        })?;
    }

    // ---- 5. Stamp the run as done -------------------------------------
    let runs_coll = state.mongo.collection::<Document>(RUNS_COLL);
    runs_coll
        .update_one(
            doc! { "_id": run_oid, "tenantId": tenant },
            doc! { "$set": {
                "status": "done",
                "completedAt": now_bson(),
                "messageCount": message_count as i64,
                "topicCount": topic_count as i64,
            } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_runs.update_one(done)"))
        })?;

    Ok(RunVocResponse {
        run_id: run_oid.to_hex(),
        topic_count,
        message_count,
    })
}

// ===========================================================================
// GET /v1/sabchat/ai/voc/runs
// ===========================================================================

/// `GET /runs` — newest-first list of run documents for the caller's
/// tenant. `limit` clamped into `[1, MAX_RUN_LIMIT]`.
#[instrument(skip_all, fields(tenant_id = %auth.tenant_id))]
pub async fn list_runs(
    auth: AuthUser,
    State(state): State<SabChatAiVocState>,
    Query(query): Query<ListRunsQuery>,
) -> Result<Json<ListRunsResponse>> {
    let tenant = tenant_oid(&auth)?;
    let limit = clamp_limit(query.limit, DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT);

    let coll = state.mongo.collection::<Document>(RUNS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "startedAt": -1 })
        .limit(limit)
        .build();
    let cursor = coll
        .find(doc! { "tenantId": tenant })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_runs.find")))?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_runs.collect"))
    })?;
    let runs = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListRunsResponse { runs }))
}

// ===========================================================================
// GET /v1/sabchat/ai/voc/runs/{id}
// ===========================================================================

/// `GET /runs/{id}` — fetch one run document. 404s on cross-tenant ids.
#[instrument(skip_all, fields(run_id = %run_id))]
pub async fn get_run(
    auth: AuthUser,
    State(state): State<SabChatAiVocState>,
    Path(run_id): Path<String>,
) -> Result<Json<GetRunResponse>> {
    let tenant = tenant_oid(&auth)?;
    let run_oid =
        oid_from_str(&run_id).map_err(|_| ApiError::BadRequest("Invalid run id.".to_owned()))?;
    let coll = state.mongo.collection::<Document>(RUNS_COLL);
    let doc = coll
        .find_one(doc! { "_id": run_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_runs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Run not found.".to_owned()))?;
    Ok(Json(GetRunResponse {
        run: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// GET /v1/sabchat/ai/voc/topics
// ===========================================================================

/// `GET /topics` — current top topics for the caller's tenant, sorted
/// by `messageCount DESC`. `limit` clamped into `[1, MAX_TOPIC_LIMIT]`.
#[instrument(skip_all, fields(tenant_id = %auth.tenant_id))]
pub async fn list_topics(
    auth: AuthUser,
    State(state): State<SabChatAiVocState>,
    Query(query): Query<ListTopicsQuery>,
) -> Result<Json<ListTopicsResponse>> {
    let tenant = tenant_oid(&auth)?;
    let limit = clamp_limit(query.limit, DEFAULT_TOPIC_LIMIT, MAX_TOPIC_LIMIT);

    let coll = state.mongo.collection::<Document>(TOPICS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "messageCount": -1, "lastSeenAt": -1 })
        .limit(limit)
        .build();
    let cursor = coll
        .find(doc! { "tenantId": tenant })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_topics.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_topics.collect"))
    })?;
    let topics = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListTopicsResponse { topics }))
}

// ===========================================================================
// GET /v1/sabchat/ai/voc/topics/{id}/messages
// ===========================================================================

/// `GET /topics/{id}/messages` — best-effort sampling of visitor
/// messages whose text matched the topic's keyword(s).
///
/// Lookup steps:
/// 1. Load the topic by id + tenant.
/// 2. Build a case-insensitive regex from the topic's keyword
///    dictionary (or its raw label when the label isn't one of the
///    named buckets — e.g. a future LLM-derived label).
/// 3. Find the most-recent visitor text messages for the tenant whose
///    `content.text` matches.
#[instrument(skip_all, fields(topic_id = %topic_id))]
pub async fn list_topic_messages(
    auth: AuthUser,
    State(state): State<SabChatAiVocState>,
    Path(topic_id): Path<String>,
    Query(query): Query<ListTopicMessagesQuery>,
) -> Result<Json<ListTopicMessagesResponse>> {
    let tenant = tenant_oid(&auth)?;
    let topic_oid = oid_from_str(&topic_id)
        .map_err(|_| ApiError::BadRequest("Invalid topic id.".to_owned()))?;
    let limit = clamp_limit(
        query.limit,
        DEFAULT_TOPIC_MESSAGE_LIMIT,
        MAX_TOPIC_MESSAGE_LIMIT,
    );

    // ---- 1. Load the topic --------------------------------------------
    let topics_coll = state.mongo.collection::<Document>(TOPICS_COLL);
    let topic = topics_coll
        .find_one(doc! { "_id": topic_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_voc_topics.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Topic not found.".to_owned()))?;

    let label = topic
        .get_str("label")
        .map(str::to_owned)
        .unwrap_or_default();

    // ---- 2. Build a regex from the label or its keywords --------------
    //
    // For known buckets (refund / billing / bug / …) we OR together
    // every trigger keyword. For unknown labels (future LLM output) we
    // fall back to the raw label, escaped. Empty / pathological labels
    // short-circuit to an empty result.
    let pattern = match keywords_for_label(&label) {
        Some(kws) => kws
            .iter()
            .map(|kw| regex::escape(kw))
            .collect::<Vec<_>>()
            .join("|"),
        None => regex::escape(&label),
    };
    if pattern.is_empty() {
        return Ok(Json(ListTopicMessagesResponse { messages: vec![] }));
    }
    // Validate the regex compiles before pushing it into Mongo — keeps
    // a malformed label from blowing up the server with a 500.
    if Regex::new(&format!("(?i){pattern}")).is_err() {
        return Ok(Json(ListTopicMessagesResponse { messages: vec![] }));
    }

    // ---- 3. Find recent matching visitor messages ---------------------
    let messages_coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(limit)
        .build();
    let cursor = messages_coll
        .find(doc! {
            "tenantId": tenant,
            "senderType": "visitor",
            "content.kind": "text",
            "content.text": { "$regex": &pattern, "$options": "i" },
        })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find(topic)"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.collect(topic)"))
    })?;
    let messages = docs.into_iter().map(document_to_clean_json).collect();

    Ok(Json(ListTopicMessagesResponse { messages }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_limit_defaults_and_bounds() {
        assert_eq!(clamp_limit(None, 20, 100), 20);
        assert_eq!(clamp_limit(Some(0), 20, 100), 20);
        assert_eq!(clamp_limit(Some(50), 20, 100), 50);
        assert_eq!(clamp_limit(Some(9999), 20, 100), 100);
    }
}
