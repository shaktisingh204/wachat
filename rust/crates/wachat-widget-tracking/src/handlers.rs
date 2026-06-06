//! HTTP handlers for the wachat widget-tracking domain.
//!
//! Backs the `/wachat/integrations/whatsapp-widget-generator` page and
//! the public widget-embed tracking pings. All data lives on the **real**
//! `projects` collection under `widgetSettings`:
//!
//! | Endpoint                                          | TS source                                   |
//! |---------------------------------------------------|---------------------------------------------|
//! | `GET  /v1/wachat/widget/{project_id}/stats`       | `page.tsx` `project.widgetSettings.stats`   |
//! | `POST /v1/wachat/widget/{project_id}/track`       | `api/widget/track` + `api/widget/[projectId]` |
//! | `PUT  /v1/wachat/widget/{project_id}/advanced-settings` | new `widgetSettings.advanced` knobs    |
//!
//! ## Tenancy guards
//!
//! `stats` (read) and `advanced-settings` (write) are owner-or-agent
//! guarded via [`load_project_with_membership`] — only members of the
//! project may read its analytics or change its settings.
//!
//! `track` deliberately uses a **looser** scope: it requires a valid
//! auth subject (the [`AuthUser`] extractor enforces this at the router
//! edge) but scopes only by **project existence**. This mirrors the
//! legacy public tracking routes (`/api/widget/track`,
//! `/api/widget/[projectId]`), which `$inc`-ed the counter for any valid
//! project id without checking project membership — the embed pings the
//! counter from the visitor's browser, not the owner's session.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{AdvancedSettingsBody, SuccessResponse, TrackEventBody, WidgetStats};
use crate::state::WachatWidgetTrackingState;

/// The real WhatsApp project collection (NOT a `wa_*` shadow store).
const PROJECTS_COLL: &str = "projects";

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Load a project and enforce **owner-or-agent** access for the calling
/// user. Returns `404` if no matching project exists (collapses not-found
/// and forbidden into one message to avoid leaking project existence).
async fn load_project_with_membership(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let project_oid = oid_from_str(project_id_hex)?;
    let uid = user_oid(user)?;

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let filter = doc! {
        "_id": project_oid,
        "$or": [
            { "userId": uid },
            { "agents.userId": uid },
        ],
    };
    coll.find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound("Project not found or you do not have permission.".to_owned())
        })
}

// ===========================================================================
// GET /v1/wachat/widget/{project_id}/stats
// ===========================================================================

/// `GET /{project_id}/stats` — owner-or-agent guarded widget analytics.
///
/// Reads `widgetSettings.stats` off the project and returns
/// `{ loads, opens, clicks }`, defaulting any missing field to `0`
/// (mirrors the page's `project?.widgetSettings?.stats || { loads: 0, ... }`).
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn get_stats(
    user: AuthUser,
    State(state): State<WachatWidgetTrackingState>,
    Path(project_id): Path<String>,
) -> Result<Json<WidgetStats>> {
    let project = load_project_with_membership(&user, &state.mongo, &project_id).await?;

    // widgetSettings.stats may be absent on projects that never embedded
    // the widget — fall back to all-zeros rather than erroring.
    let stats = project
        .get_document("widgetSettings")
        .ok()
        .and_then(|ws| ws.get_document("stats").ok())
        .map(|s| WidgetStats {
            loads: counter(s, "loads"),
            opens: counter(s, "opens"),
            clicks: counter(s, "clicks"),
        })
        .unwrap_or_default();

    Ok(Json(stats))
}

/// Read a counter field as `i64`, tolerating either int32 or int64
/// storage (Mongo `$inc` keeps the type of the existing value, and the
/// legacy TS writes started from `1` as an int32). Missing → `0`.
fn counter(stats: &Document, key: &str) -> i64 {
    stats
        .get_i64(key)
        .or_else(|_| stats.get_i32(key).map(i64::from))
        .unwrap_or(0)
}

// ===========================================================================
// POST /v1/wachat/widget/{project_id}/track
// ===========================================================================

/// `POST /{project_id}/track` — `$inc` the matching widget counter.
///
/// Scoped by **project existence** only (see module docs). `eventType`
/// must be `"load"`, `"open"`, or `"click"`; anything else is a 422.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn track_event(
    _user: AuthUser,
    State(state): State<WachatWidgetTrackingState>,
    Path(project_id): Path<String>,
    Json(body): Json<TrackEventBody>,
) -> Result<Json<SuccessResponse>> {
    let project_oid = oid_from_str(&project_id)?;

    let field = match body.event_type.as_str() {
        "load" => "widgetSettings.stats.loads",
        "open" => "widgetSettings.stats.opens",
        "click" => "widgetSettings.stats.clicks",
        _ => {
            return Err(ApiError::Validation(
                "eventType must be 'load', 'open', or 'click'.".to_owned(),
            ));
        }
    };

    let res = state
        .mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(doc! { "_id": project_oid }, doc! { "$inc": { field: 1_i64 } })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.track.$inc")))?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Project not found.".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PUT /v1/wachat/widget/{project_id}/advanced-settings
// ===========================================================================

/// `PUT /{project_id}/advanced-settings` — owner-or-agent guarded `$set`
/// of `widgetSettings.advanced` (`{ autoOpenDelay, abTestEnabled,
/// styleVariant }`). These are new behaviour knobs alongside the existing
/// `widgetSettings.stats` / appearance fields.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn update_advanced_settings(
    user: AuthUser,
    State(state): State<WachatWidgetTrackingState>,
    Path(project_id): Path<String>,
    Json(body): Json<AdvancedSettingsBody>,
) -> Result<Json<SuccessResponse>> {
    // Owner-or-agent guard; also resolves the canonical `_id`.
    let project = load_project_with_membership(&user, &state.mongo, &project_id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;

    let now = bson::DateTime::from_chrono(Utc::now());
    let res = state
        .mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project_oid },
            doc! { "$set": {
                "widgetSettings.advanced.autoOpenDelay": body.auto_open_delay,
                "widgetSettings.advanced.abTestEnabled": body.ab_test_enabled,
                "widgetSettings.advanced.styleVariant": &body.style_variant,
                "widgetSettings.advanced.updatedAt": now,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.advanced.$set"))
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Project not found.".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}
