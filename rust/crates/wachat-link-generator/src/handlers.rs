//! HTTP handlers for the wachat link-generator domain.
//!
//! Backs the `/wachat/whatsapp-link-generator` page. Two surfaces:
//!
//! | Endpoint                                       | TS source / purpose                       |
//! |------------------------------------------------|-------------------------------------------|
//! | `POST /v1/wachat/link-generator/projects/{id}/links` | `saveGeneratedLink` (persist a wa.me link) |
//! | `GET  /v1/wachat/link-generator/projects/{id}/links` | list a project's saved links        |
//! | `POST /v1/wachat/link-generator/shorten`       | internal URL shortener (replaces tinyurl) |
//!
//! ## Tenancy
//!
//! The project-scoped endpoints reuse the contacts **owner-or-agent**
//! guard ([`load_project_with_membership`]) so an agent on a project can
//! save/list its links, but no tenant ever sees another tenant's rows.
//! `/shorten` is not project-scoped — it stores `{ shortCode, originalUrl }`
//! owned by the calling `userId`.
//!
//! ## Collections
//!
//! - `wa_link_clicks` — **existing** collection (read by the link-tracking
//!   page and `wachat-features` analytics). We write `clickedAt` alongside
//!   `createdAt` so a saved link surfaces in tracking exactly as the legacy
//!   `saveGeneratedLink` did.
//! - `wa_short_links` — **new** collection for the internal shortener.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{ListLinksResponse, SaveLinkBody, ShortenBody, ShortenResponse};
use crate::state::WachatLinkGeneratorState;

/// Existing collection — also read by `wachat-features` link-click
/// analytics and the `/wachat/link-tracking` page. Keep the literal
/// name in sync; an invented name silently hides the data (two-store
/// gotcha).
const LINK_CLICKS_COLL: &str = "wa_link_clicks";
/// New collection for the internal URL shortener.
const SHORT_LINKS_COLL: &str = "wa_short_links";
const PROJECTS_COLL: &str = "projects";

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Load a project and enforce **owner-or-agent** access for the caller.
/// Returns the project `_id` on success, or `404` (collapsing not-found
/// and forbidden into one message to avoid leaking project existence).
///
/// Mirrors the contacts guard:
///
/// ```text
/// projects.findOne({
///   _id: ObjectId(projectId),
///   $or: [{ userId: ObjectId(uid) }, { 'agents.userId': ObjectId(uid) }],
/// })
/// ```
async fn load_project_with_membership(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<ObjectId> {
    let project_oid = oid_from_str(project_id_hex)?;
    let uid = user_oid(user)?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! {
            "_id": project_oid,
            "$or": [
                { "userId": uid },
                { "agents.userId": uid },
            ],
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound("Project not found or you do not have permission.".to_owned())
        })?;
    project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))
}

// ===========================================================================
// POST /v1/wachat/link-generator/projects/{project_id}/links
// ===========================================================================

/// Persist a generated `wa.me` link under the caller's project.
///
/// Migrates `saveGeneratedLink` (lines 7-24 of
/// `integrations/whatsapp-link-generator/actions.ts`). Writes both
/// `clickedAt` and `createdAt` so the link surfaces on the tracking
/// page, exactly as the legacy action did.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn save_link(
    user: AuthUser,
    State(state): State<WachatLinkGeneratorState>,
    Path(project_id): Path<String>,
    Json(body): Json<SaveLinkBody>,
) -> Result<Json<Value>> {
    if body.url.trim().is_empty() {
        return Err(ApiError::Validation("A link URL is required.".to_owned()));
    }
    let project_oid = load_project_with_membership(&user, &state.mongo, &project_id).await?;
    let uid = user_oid(&user)?;
    let now = bson::DateTime::from_chrono(Utc::now());

    let phone: Bson = match body.phone.as_deref().filter(|s| !s.is_empty()) {
        Some(p) => Bson::String(p.to_owned()),
        None => Bson::Null,
    };
    let message: Bson = match body.message.as_deref().filter(|s| !s.is_empty()) {
        Some(m) => Bson::String(m.to_owned()),
        None => Bson::Null,
    };

    let new_doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_oid,
        "userId": uid,
        "url": body.url.trim(),
        "phone": phone,
        "message": message,
        "createdAt": now,
        // Legacy parity: a saved link doubles as a click event so it
        // shows up in /wachat/link-tracking (sorted on `clickedAt`).
        "clickedAt": now,
    };
    state
        .mongo
        .collection::<Document>(LINK_CLICKS_COLL)
        .insert_one(new_doc.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("link_clicks.insert_one")))?;

    Ok(Json(document_to_clean_json(new_doc)))
}

// ===========================================================================
// GET /v1/wachat/link-generator/projects/{project_id}/links
// ===========================================================================

/// List a project's saved links, newest first.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn list_links(
    user: AuthUser,
    State(state): State<WachatLinkGeneratorState>,
    Path(project_id): Path<String>,
) -> Result<Json<ListLinksResponse>> {
    let project_oid = load_project_with_membership(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(LINK_CLICKS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(500)
        .build();
    let cursor = coll
        .find(doc! { "projectId": project_oid })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("link_clicks.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("link_clicks.collect")))?;
    let links = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListLinksResponse { links }))
}

// ===========================================================================
// POST /v1/wachat/link-generator/shorten
// ===========================================================================

/// Internal URL shortener. Replaces the legacy `shortenUrlAction` that
/// called `tinyurl.com` — no external request, no `reqwest` dep.
///
/// Stores `{ shortCode, originalUrl }` in `wa_short_links` scoped to the
/// caller. The `shortCode` is the first 8 hex chars of the inserted doc
/// `_id` (deterministic, no randomness), and the response returns the
/// internal short path `/s/{shortCode}`.
#[instrument(skip_all)]
pub async fn shorten(
    user: AuthUser,
    State(state): State<WachatLinkGeneratorState>,
    Json(body): Json<ShortenBody>,
) -> Result<Json<ShortenResponse>> {
    let original = body.url.trim();
    if original.is_empty() {
        return Err(ApiError::Validation("A URL is required.".to_owned()));
    }
    let uid = user_oid(&user)?;

    let new_oid = ObjectId::new();
    // Deterministic 8-char code from the ObjectId hex — no RNG.
    let short_code: String = new_oid.to_hex().chars().take(8).collect();
    let now = bson::DateTime::from_chrono(Utc::now());

    let new_doc = doc! {
        "_id": new_oid,
        "userId": uid,
        "shortCode": &short_code,
        "originalUrl": original,
        "createdAt": now,
    };
    state
        .mongo
        .collection::<Document>(SHORT_LINKS_COLL)
        .insert_one(new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("short_links.insert_one")))?;

    Ok(Json(ShortenResponse {
        success: true,
        short_path: format!("/s/{short_code}"),
        short_code,
        original_url: original.to_owned(),
    }))
}
