//! HTTP handlers for the wachat ads-roadmap domain.
//!
//! Roadmap *phases* are global (one shared plan for everyone), stored in
//! `wa_ads_roadmap_phases`. *Votes* live in `wa_ads_roadmap_votes`, scoped
//! and deduped by `userId` so a caller can upvote a phase at most once.
//! The list endpoint enriches each phase with the aggregated vote count.
//!
//! | Endpoint                                    | Action                |
//! |---------------------------------------------|-----------------------|
//! | `GET  /v1/wachat/ads-roadmap/phases`        | list phases + votes   |
//! | `POST /v1/wachat/ads-roadmap/phases/{phase}/vote` | idempotent upvote |
//! | `POST /v1/wachat/ads-roadmap/sync`          | stub (no external PM)  |

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::document_to_clean_json;
use serde_json::{Value, json};
use tracing::instrument;

use crate::dto::{ListPhasesResponse, SyncResponse, VoteResponse};
use crate::state::WachatAdsRoadmapState;

const PHASES_COLL: &str = "wa_ads_roadmap_phases";
const VOTES_COLL: &str = "wa_ads_roadmap_votes";

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Best-effort extraction of a phase's stable slug from its document.
/// Phases key their slug under `slug` (preferred) or fall back to `phase`.
fn phase_slug(doc: &Document) -> Option<String> {
    doc.get_str("slug")
        .ok()
        .or_else(|| doc.get_str("phase").ok())
        .map(str::to_owned)
}

// ===========================================================================
// GET /v1/wachat/ads-roadmap/phases
// ===========================================================================

/// List the global roadmap phases, each enriched with an aggregated
/// `voteCount` (a count of distinct voters in `wa_ads_roadmap_votes`).
#[instrument(skip_all)]
pub async fn list_phases(
    _user: AuthUser,
    State(state): State<WachatAdsRoadmapState>,
) -> Result<Json<ListPhasesResponse>> {
    let phases_coll = state.mongo.collection::<Document>(PHASES_COLL);
    let votes_coll = state.mongo.collection::<Document>(VOTES_COLL);

    let cursor = phases_coll
        .find(doc! {})
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("phases.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("phases.collect")))?;

    let mut phases: Vec<Value> = Vec::with_capacity(docs.len());
    for doc in docs {
        let count = match phase_slug(&doc) {
            Some(slug) => votes_coll
                .count_documents(doc! { "phaseSlug": slug })
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("votes.count_documents"))
                })?,
            None => 0,
        };
        let mut json_doc = document_to_clean_json(doc);
        if let Value::Object(map) = &mut json_doc {
            // `voteCount` is the canonical aggregate; `votes` mirrors it so
            // the existing page (which reads `votes`) keeps working.
            map.insert("voteCount".to_owned(), json!(count));
            map.insert("votes".to_owned(), json!(count));
        }
        phases.push(json_doc);
    }

    Ok(Json(ListPhasesResponse { phases }))
}

// ===========================================================================
// POST /v1/wachat/ads-roadmap/phases/{phase}/vote
// ===========================================================================

/// Record the caller's upvote for a phase. Idempotent: the vote is an
/// upsert keyed on `{ userId, phaseSlug }`, so a second call by the same
/// user is a no-op (`created: false`). Returns the post-call vote count.
#[instrument(skip_all)]
pub async fn vote_phase(
    user: AuthUser,
    State(state): State<WachatAdsRoadmapState>,
    Path(phase): Path<String>,
) -> Result<Json<VoteResponse>> {
    let slug = phase.trim();
    if slug.is_empty() {
        return Err(ApiError::Validation("Phase slug is required.".to_owned()));
    }
    let uid = user_oid(&user)?;

    let phases_coll = state.mongo.collection::<Document>(PHASES_COLL);
    let exists = phases_coll
        .find_one(doc! { "$or": [ { "slug": slug }, { "phase": slug } ] })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("phases.find_one")))?;
    if exists.is_none() {
        return Err(ApiError::NotFound(format!("Phase \"{slug}\" not found.")));
    }

    let votes_coll = state.mongo.collection::<Document>(VOTES_COLL);
    let now = bson::DateTime::from_chrono(Utc::now());
    let id = ObjectId::new();
    let res = votes_coll
        .update_one(
            doc! { "userId": uid, "phaseSlug": slug },
            doc! {
                "$setOnInsert": {
                    "_id": id,
                    "userId": uid,
                    "phaseSlug": slug,
                    "createdAt": now,
                },
            },
        )
        .upsert(true)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("votes.upsert")))?;

    let created = res.upserted_id.is_some();
    let vote_count = votes_coll
        .count_documents(doc! { "phaseSlug": slug })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("votes.count_documents")))?;

    Ok(Json(VoteResponse {
        success: true,
        created,
        vote_count,
    }))
}

// ===========================================================================
// POST /v1/wachat/ads-roadmap/sync
// ===========================================================================

/// Stub sync endpoint. No external project-management tool is wired, so
/// this always reports `synced: false` without performing any external
/// call.
#[instrument(skip_all)]
pub async fn sync(
    _user: AuthUser,
    State(_state): State<WachatAdsRoadmapState>,
) -> Result<Json<SyncResponse>> {
    Ok(Json(SyncResponse::not_configured()))
}
