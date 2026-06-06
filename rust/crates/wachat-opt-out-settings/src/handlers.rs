//! HTTP handlers for the wachat opt-out-settings domain.
//!
//! Project-level opt-out SETTINGS toggle (the AI Settings panel on the
//! `/wachat/opt-out` page). The opt-out LIST itself lives elsewhere
//! (`wachat-features`); this crate only persists the per-project flag(s).
//!
//! Exactly one upserted doc per `{userId, projectId}` in
//! `wa_opt_out_settings`, scoped to the authenticated user.
//!
//! | Endpoint                                  | Action          |
//! |-------------------------------------------|-----------------|
//! | `GET  /v1/wachat/opt-out-settings/projects/{project_id}` | read settings (or defaults) |
//! | `POST /v1/wachat/opt-out-settings/projects/{project_id}` | upsert settings |

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::json;
use tracing::instrument;

use crate::dto::{OptOutSettingsBody, OptOutSettingsResponse, SuccessResponse};
use crate::state::WachatOptOutSettingsState;

const COLL: &str = "wa_opt_out_settings";

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Default settings payload returned when no doc exists yet.
fn default_settings(project_id: &str) -> serde_json::Value {
    json!({
        "projectId": project_id,
        "sentimentAutoOptOut": false,
    })
}

// ===========================================================================
// GET /v1/wachat/opt-out-settings/projects/{project_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn get_settings(
    user: AuthUser,
    State(state): State<WachatOptOutSettingsState>,
    Path(project_id): Path<String>,
) -> Result<Json<OptOutSettingsResponse>> {
    let uid = user_oid(&user)?;
    let pid = oid_from_str(&project_id)?;

    let existing = state
        .mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "userId": uid, "projectId": pid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("opt_out_settings.find_one")))?;

    let settings = match existing {
        Some(doc) => document_to_clean_json(doc),
        None => default_settings(&project_id),
    };
    Ok(Json(OptOutSettingsResponse { settings }))
}

// ===========================================================================
// POST /v1/wachat/opt-out-settings/projects/{project_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn upsert_settings(
    user: AuthUser,
    State(state): State<WachatOptOutSettingsState>,
    Path(project_id): Path<String>,
    Json(body): Json<OptOutSettingsBody>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let pid = oid_from_str(&project_id)?;
    let now = bson::DateTime::from_chrono(Utc::now());

    // Only set fields the caller actually provided; default missing flags so a
    // first-time upsert lands a complete doc.
    let mut set_doc = doc! {
        "sentimentAutoOptOut": body.sentiment_auto_opt_out.unwrap_or(false),
        "updatedAt": now,
    };
    // Keep userId/projectId on the doc for tenancy-scoped reads.
    set_doc.insert("userId", uid);
    set_doc.insert("projectId", pid);

    state
        .mongo
        .collection::<Document>(COLL)
        .update_one(
            doc! { "userId": uid, "projectId": pid },
            doc! {
                "$set": set_doc,
                "$setOnInsert": { "createdAt": now },
            },
        )
        .upsert(true)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("opt_out_settings.upsert"))
        })?;

    Ok(Json(SuccessResponse::ok()))
}
