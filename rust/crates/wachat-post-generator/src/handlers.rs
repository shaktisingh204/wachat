//! HTTP handlers for the wachat post-generator domain.
//!
//! AI generation is NOT here — it stays in the Next streaming route
//! (`/wachat/post-generator/api`). This crate owns the *persistence* and
//! *publish* halves of the page: keeping drafts, recording publish intents,
//! and performing the Meta Graph publish to the connected Page feed.
//!
//! | Endpoint                                          | Action                       |
//! |---------------------------------------------------|------------------------------|
//! | `GET    /v1/wachat/post-generator/drafts`         | list drafts (per project)    |
//! | `POST   /v1/wachat/post-generator/drafts`         | save a draft                 |
//! | `DELETE /v1/wachat/post-generator/drafts/{id}`    | delete a draft               |
//! | `POST   /v1/wachat/post-generator/publish/facebook`        | publish to FB Page feed |
//! | `POST   /v1/wachat/post-generator/publish/whatsapp-status` | record status intent    |
//! | `GET    /v1/wachat/post-generator/publish-log`    | publish history (per project)|
//!
//! Tenancy: every read/write is scoped to a project the caller owns or is an
//! agent on (`load_project`), and the per-row `userId` is always the caller.
//! The Meta call is isolated in [`crate::graph_publish`]; with no/empty FB
//! token the publish endpoints persist a `failed` log row and return
//! `ApiError::BadRequest` — they never panic.

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
use tracing::instrument;

use crate::dto::{
    ListDraftsResponse, ProjectQuery, PublishBody, PublishLogResponse, PublishResponse,
    SaveDraftBody, SuccessResponse,
};
use crate::graph_publish;
use crate::state::WachatPostGeneratorState;

const DRAFTS_COLL: &str = "wa_post_drafts";
const PUBLISH_LOG_COLL: &str = "wa_post_publish_log";
const PROJECTS_COLL: &str = "projects";

// ===========================================================================
// Tenancy
// ===========================================================================

/// Caller's JWT subject as an `ObjectId` (401 on bad hex).
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// The connected Facebook Page for a project, after the owner-or-agent guard.
struct ProjectFb {
    page_id: Option<String>,
    access_token: Option<String>,
}

/// Load a project enforcing **owner-or-agent** access, returning its FB page
/// id + access token (either may be `None`/empty if the page isn't connected).
///
/// Mirrors the legacy TS `$or: [{ userId }, { 'agents.userId' }]` guard used
/// across the wachat crates.
///
/// * `BadRequest` for invalid project id hex.
/// * `NotFound` if the project doesn't exist or the caller has no access.
#[instrument(skip_all, fields(project_id = %project_id_hex))]
async fn load_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<ProjectFb> {
    let project_oid = oid_from_str(project_id_hex)?;
    let uid = user_oid(user)?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let doc = coll
        .find_one(doc! {
            "_id": project_oid,
            "$or": [
                { "userId": uid },
                { "agents.userId": uid },
            ],
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    let page_id = doc
        .get_str("facebookPageId")
        .ok()
        .map(str::to_owned)
        .filter(|s| !s.is_empty());
    let access_token = doc
        .get_str("accessToken")
        .ok()
        .map(str::to_owned)
        .filter(|s| !s.is_empty());

    Ok(ProjectFb {
        page_id,
        access_token,
    })
}

/// `BSON` for an optional string field (`Null` when empty/absent).
fn opt_str_bson(v: &Option<String>) -> Bson {
    match v.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => Bson::String(s.to_owned()),
        None => Bson::Null,
    }
}

/// Insert a `wa_post_publish_log` row and return its `_id`.
///
/// Best-effort observability — a logging failure must not mask the publish
/// outcome, so insert errors are surfaced as `Internal` only when the caller
/// has no other status to report.
#[instrument(skip_all)]
async fn record_log(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    project_oid: ObjectId,
    channel: &str,
    status: &str,
    reason: Option<&str>,
    post_id: Option<&str>,
    text: &str,
) -> Result<ObjectId> {
    let now = bson::DateTime::from_chrono(Utc::now());
    let log_oid = ObjectId::new();
    let row = doc! {
        "_id": log_oid,
        "userId": user_oid,
        "projectId": project_oid,
        "channel": channel,
        "status": status,
        "reason": match reason { Some(r) => Bson::String(r.to_owned()), None => Bson::Null },
        "postId": match post_id { Some(p) => Bson::String(p.to_owned()), None => Bson::Null },
        "text": text,
        "ts": now,
        "createdAt": now,
    };
    mongo
        .collection::<Document>(PUBLISH_LOG_COLL)
        .insert_one(row)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("publish_log.insert_one"))
        })?;
    Ok(log_oid)
}

/// Resolve the post text for a publish: inline `text` wins, else the saved
/// draft `body`. Errors with `BadRequest` if neither yields content.
#[instrument(skip_all)]
async fn resolve_text(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    project_oid: ObjectId,
    body: &PublishBody,
) -> Result<String> {
    if let Some(t) = body.text.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        return Ok(t.to_owned());
    }
    if let Some(draft_id) = body.draft_id.as_deref().filter(|s| !s.is_empty()) {
        let draft_oid = oid_from_str(draft_id)?;
        let draft = mongo
            .collection::<Document>(DRAFTS_COLL)
            .find_one(doc! { "_id": draft_oid, "userId": user_oid, "projectId": project_oid })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("drafts.find_one")))?
            .ok_or_else(|| ApiError::NotFound(format!("draft {draft_id}")))?;
        let text = draft
            .get_str("body")
            .map(str::trim)
            .unwrap_or("")
            .to_owned();
        if text.is_empty() {
            return Err(ApiError::BadRequest("Draft has no body to publish.".to_owned()));
        }
        return Ok(text);
    }
    Err(ApiError::BadRequest(
        "Provide draftId or text to publish.".to_owned(),
    ))
}

// ===========================================================================
// GET /drafts
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_drafts(
    user: AuthUser,
    State(state): State<WachatPostGeneratorState>,
    Query(q): Query<ProjectQuery>,
) -> Result<Json<ListDraftsResponse>> {
    let _ = load_project(&user, &state.mongo, &q.project_id).await?;
    let uid = user_oid(&user)?;
    let project_oid = oid_from_str(&q.project_id)?;

    let cursor = state
        .mongo
        .collection::<Document>(DRAFTS_COLL)
        .find(doc! { "userId": uid, "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("drafts.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("drafts.collect")))?;
    let drafts = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListDraftsResponse { drafts }))
}

// ===========================================================================
// POST /drafts
// ===========================================================================

#[instrument(skip_all)]
pub async fn save_draft(
    user: AuthUser,
    State(state): State<WachatPostGeneratorState>,
    Json(body): Json<SaveDraftBody>,
) -> Result<Json<serde_json::Value>> {
    if body.body.trim().is_empty() {
        return Err(ApiError::Validation("Draft body is required.".to_owned()));
    }
    let _ = load_project(&user, &state.mongo, &body.project_id).await?;
    let uid = user_oid(&user)?;
    let project_oid = oid_from_str(&body.project_id)?;
    let channel = body
        .channel
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("facebook")
        .to_owned();
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "userId": uid,
        "projectId": project_oid,
        "title": opt_str_bson(&body.title),
        "body": body.body.trim(),
        "channel": channel,
        "createdAt": now,
        "updatedAt": now,
    };
    state
        .mongo
        .collection::<Document>(DRAFTS_COLL)
        .insert_one(new_doc.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("drafts.insert_one")))?;
    Ok(Json(document_to_clean_json(new_doc)))
}

// ===========================================================================
// DELETE /drafts/{id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn delete_draft(
    user: AuthUser,
    State(state): State<WachatPostGeneratorState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let res = state
        .mongo
        .collection::<Document>(DRAFTS_COLL)
        .delete_one(doc! { "_id": oid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("drafts.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Draft not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /publish/facebook
// ===========================================================================

/// Publish a draft / inline text to the project's connected Facebook Page
/// feed. The external Graph call is isolated in [`crate::graph_publish`].
///
/// Degradation: if the project has no FB page id / access token, we persist a
/// `publish_log` row with `status="failed", reason="no FB token"` and return
/// `ApiError::BadRequest` — never a panic. Graph/transport failures likewise
/// record a `failed` row and surface as a typed `ApiError`.
#[instrument(skip_all)]
pub async fn publish_facebook(
    user: AuthUser,
    State(state): State<WachatPostGeneratorState>,
    Json(body): Json<PublishBody>,
) -> Result<Json<PublishResponse>> {
    let project = load_project(&user, &state.mongo, &body.project_id).await?;
    let uid = user_oid(&user)?;
    let project_oid = oid_from_str(&body.project_id)?;
    let text = resolve_text(&state.mongo, uid, project_oid, &body).await?;

    // --- degradation: no connected page / token -------------------------
    let (page_id, token) = match (project.page_id, project.access_token) {
        (Some(p), Some(t)) => (p, t),
        _ => {
            let log_oid = record_log(
                &state.mongo,
                uid,
                project_oid,
                "facebook",
                "failed",
                Some("no FB token"),
                None,
                &text,
            )
            .await?;
            tracing::warn!(log_id = %log_oid, "facebook publish skipped: no FB token");
            return Err(ApiError::BadRequest(
                "This project has no connected Facebook Page. Connect a page first.".to_owned(),
            ));
        }
    };

    // --- external seam: Meta Graph publish ------------------------------
    match graph_publish::publish_text_to_feed(&page_id, &token, &text).await {
        Ok(post_id) => {
            let log_oid = record_log(
                &state.mongo,
                uid,
                project_oid,
                "facebook",
                "published",
                None,
                Some(&post_id),
                &text,
            )
            .await?;
            Ok(Json(PublishResponse {
                success: true,
                log_id: log_oid.to_hex(),
                status: "published".to_owned(),
                post_id: Some(post_id),
                reason: None,
            }))
        }
        Err(e) => {
            let reason = e.reason();
            let log_oid = record_log(
                &state.mongo,
                uid,
                project_oid,
                "facebook",
                "failed",
                Some(&reason),
                None,
                &text,
            )
            .await?;
            tracing::warn!(log_id = %log_oid, reason = %reason, "facebook publish failed");
            Err(ApiError::Internal(anyhow::anyhow!(
                "Facebook publish failed: {reason}"
            )))
        }
    }
}

// ===========================================================================
// POST /publish/whatsapp-status
// ===========================================================================

/// Record a WhatsApp-status publish intent. There is no Graph status-publish
/// API wired yet, so this persists the intent + a `queued` log row and
/// returns it. No external call, no panic.
#[instrument(skip_all)]
pub async fn publish_whatsapp_status(
    user: AuthUser,
    State(state): State<WachatPostGeneratorState>,
    Json(body): Json<PublishBody>,
) -> Result<Json<PublishResponse>> {
    let _ = load_project(&user, &state.mongo, &body.project_id).await?;
    let uid = user_oid(&user)?;
    let project_oid = oid_from_str(&body.project_id)?;
    let text = resolve_text(&state.mongo, uid, project_oid, &body).await?;

    let log_oid = record_log(
        &state.mongo,
        uid,
        project_oid,
        "whatsapp-status",
        "queued",
        None,
        None,
        &text,
    )
    .await?;
    Ok(Json(PublishResponse {
        success: true,
        log_id: log_oid.to_hex(),
        status: "queued".to_owned(),
        post_id: None,
        reason: None,
    }))
}

// ===========================================================================
// GET /publish-log
// ===========================================================================

#[instrument(skip_all)]
pub async fn publish_log(
    user: AuthUser,
    State(state): State<WachatPostGeneratorState>,
    Query(q): Query<ProjectQuery>,
) -> Result<Json<PublishLogResponse>> {
    let _ = load_project(&user, &state.mongo, &q.project_id).await?;
    let uid = user_oid(&user)?;
    let project_oid = oid_from_str(&q.project_id)?;

    let cursor = state
        .mongo
        .collection::<Document>(PUBLISH_LOG_COLL)
        .find(doc! { "userId": uid, "projectId": project_oid })
        .sort(doc! { "ts": -1 })
        .limit(200)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("publish_log.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("publish_log.collect")))?;
    let entries = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(PublishLogResponse { entries }))
}
