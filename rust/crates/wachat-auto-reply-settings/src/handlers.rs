//! HTTP handlers for the wachat auto-reply-settings domain.
//!
//! Backs the `/wachat/auto-reply` page. Each handler maps 1:1 to a
//! native-Mongo write in `src/app/actions/project.actions.ts`:
//!
//! | Endpoint                                          | TS source                       |
//! |---------------------------------------------------|---------------------------------|
//! | `GET   /v1/wachat/auto-reply-settings/{pid}`      | `getProjectById` projection     |
//! | `PATCH /…/{pid}/master-switch`                    | `handleUpdateMasterSwitch`      |
//! | `PUT   /…/{pid}/welcome-message`                  | `handleUpdateAutoReplySettings` |
//! | `PUT   /…/{pid}/inactive-hours`                   | `handleUpdateAutoReplySettings` |
//! | `PUT   /…/{pid}/general`                          | `handleUpdateAutoReplySettings` |
//! | `PUT   /…/{pid}/ai-assistant`                     | `handleUpdateAutoReplySettings` |
//! | `PUT   /…/{pid}/opt-in-out`                       | `handleUpdateOptInOutSettings`  |
//!
//! ## Tenancy
//!
//! All endpoints are scoped via the **owner-or-agent** project guard
//! (mirroring the TS `getProjectById` access check used by every one of
//! these actions). Reads and writes target the REAL `projects`
//! collection (the two-store gotcha: an invented name would silently
//! drop the data). Each mutation is a single scoped `update_one` whose
//! filter doubles as the access guard — a non-member never matches, so
//! we surface a `403`/`404` instead of touching another tenant's row.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    AiAssistantBody, GeneralBody, GeneralReplyRule, InactiveHoursBody, MasterSwitchBody,
    OptInOutBody, SettingsResponse, SuccessResponse, WelcomeMessageBody,
};
use crate::state::WachatAutoReplySettingsState;

/// The REAL Mongo collection — auto-reply + opt-in/out config live as
/// sub-documents on the project. Matches the TS literal `'projects'`.
const PROJECTS_COLL: &str = "projects";

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Owner-or-agent filter for a project the caller may touch. Mirrors the
/// TS `getProjectById` access query (`userId` OR `agents.userId`).
fn membership_filter(project_oid: ObjectId, user_oid: ObjectId) -> Document {
    doc! {
        "_id": project_oid,
        "$or": [
            { "userId": user_oid },
            { "agents.userId": user_oid },
        ],
    }
}

/// Apply a single `$set` to the caller's project, scoped by the
/// owner-or-agent guard. `404` when no project matches (collapses
/// not-found and forbidden, matching the TS "Access denied." contract).
async fn set_on_project(
    mongo: &MongoHandle,
    project_id_hex: &str,
    user: &AuthUser,
    set: Document,
) -> Result<()> {
    let project_oid = oid_from_str(project_id_hex)?;
    let uid = user_oid(user)?;

    let res = mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            membership_filter(project_oid, uid),
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.update_one")))?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound(
            "Project not found or you do not have permission.".to_owned(),
        ));
    }
    Ok(())
}

// ===========================================================================
// GET /v1/wachat/auto-reply-settings/{project_id}
// ===========================================================================

/// Return the project's `autoReplySettings` + `optInOutSettings`
/// sub-documents (cleaned JSON), scoped to the caller. Missing
/// sub-docs come back as JSON `null`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn get_settings(
    user: AuthUser,
    State(state): State<WachatAutoReplySettingsState>,
    Path(project_id): Path<String>,
) -> Result<Json<SettingsResponse>> {
    let project_oid = oid_from_str(&project_id)?;
    let uid = user_oid(&user)?;

    let project = state
        .mongo
        .collection::<Document>(PROJECTS_COLL)
        .find_one(membership_filter(project_oid, uid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound("Project not found or you do not have permission.".to_owned())
        })?;

    let auto_reply_settings = sub_doc_to_json(&project, "autoReplySettings");
    let opt_in_out_settings = sub_doc_to_json(&project, "optInOutSettings");

    Ok(Json(SettingsResponse {
        auto_reply_settings,
        opt_in_out_settings,
    }))
}

// ===========================================================================
// PATCH /v1/wachat/auto-reply-settings/{project_id}/master-switch
// ===========================================================================

/// `$set { "autoReplySettings.masterEnabled": enabled }`. Mirrors
/// `handleUpdateMasterSwitch`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn update_master_switch(
    user: AuthUser,
    State(state): State<WachatAutoReplySettingsState>,
    Path(project_id): Path<String>,
    Json(body): Json<MasterSwitchBody>,
) -> Result<Json<SuccessResponse>> {
    set_on_project(
        &state.mongo,
        &project_id,
        &user,
        doc! { "autoReplySettings.masterEnabled": body.enabled },
    )
    .await?;
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PUT /v1/wachat/auto-reply-settings/{project_id}/welcome-message
// ===========================================================================

/// `$set { "autoReplySettings.welcomeMessage": { enabled, message } }`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn update_welcome_message(
    user: AuthUser,
    State(state): State<WachatAutoReplySettingsState>,
    Path(project_id): Path<String>,
    Json(body): Json<WelcomeMessageBody>,
) -> Result<Json<SuccessResponse>> {
    let payload = doc! {
        "enabled": body.enabled,
        "message": &body.message,
    };
    set_on_project(
        &state.mongo,
        &project_id,
        &user,
        doc! { "autoReplySettings.welcomeMessage": payload },
    )
    .await?;
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PUT /v1/wachat/auto-reply-settings/{project_id}/inactive-hours
// ===========================================================================

/// `$set { "autoReplySettings.inactiveHours":
/// { enabled, message, startTime, endTime, timezone, days } }`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn update_inactive_hours(
    user: AuthUser,
    State(state): State<WachatAutoReplySettingsState>,
    Path(project_id): Path<String>,
    Json(body): Json<InactiveHoursBody>,
) -> Result<Json<SuccessResponse>> {
    let days: Vec<Bson> = body.days.iter().map(|d| Bson::Int32(*d)).collect();
    let payload = doc! {
        "enabled": body.enabled,
        "message": &body.message,
        "startTime": &body.start_time,
        "endTime": &body.end_time,
        "timezone": &body.timezone,
        "days": Bson::Array(days),
    };
    set_on_project(
        &state.mongo,
        &project_id,
        &user,
        doc! { "autoReplySettings.inactiveHours": payload },
    )
    .await?;
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PUT /v1/wachat/auto-reply-settings/{project_id}/general
// ===========================================================================

/// `$set { "autoReplySettings.general": { enabled, replies } }`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn update_general(
    user: AuthUser,
    State(state): State<WachatAutoReplySettingsState>,
    Path(project_id): Path<String>,
    Json(body): Json<GeneralBody>,
) -> Result<Json<SuccessResponse>> {
    let replies: Vec<Bson> = body.replies.iter().map(reply_rule_to_bson).collect();
    let payload = doc! {
        "enabled": body.enabled,
        "replies": Bson::Array(replies),
    };
    set_on_project(
        &state.mongo,
        &project_id,
        &user,
        doc! { "autoReplySettings.general": payload },
    )
    .await?;
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PUT /v1/wachat/auto-reply-settings/{project_id}/ai-assistant
// ===========================================================================

/// `$set { "autoReplySettings.aiAssistant":
/// { enabled, context, autoTranslate } }`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn update_ai_assistant(
    user: AuthUser,
    State(state): State<WachatAutoReplySettingsState>,
    Path(project_id): Path<String>,
    Json(body): Json<AiAssistantBody>,
) -> Result<Json<SuccessResponse>> {
    let payload = doc! {
        "enabled": body.enabled,
        "context": &body.context,
        "autoTranslate": body.auto_translate,
    };
    set_on_project(
        &state.mongo,
        &project_id,
        &user,
        doc! { "autoReplySettings.aiAssistant": payload },
    )
    .await?;
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PUT /v1/wachat/auto-reply-settings/{project_id}/opt-in-out
// ===========================================================================

/// `$set { optInOutSettings: { enabled, optInKeywords, optOutKeywords,
/// optInResponse, optOutResponse } }`. Mirrors
/// `handleUpdateOptInOutSettings` (writes the whole sub-document).
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn update_opt_in_out(
    user: AuthUser,
    State(state): State<WachatAutoReplySettingsState>,
    Path(project_id): Path<String>,
    Json(body): Json<OptInOutBody>,
) -> Result<Json<SuccessResponse>> {
    let opt_in: Vec<Bson> = body
        .opt_in_keywords
        .iter()
        .map(|k| Bson::String(k.clone()))
        .collect();
    let opt_out: Vec<Bson> = body
        .opt_out_keywords
        .iter()
        .map(|k| Bson::String(k.clone()))
        .collect();
    let payload = doc! {
        "enabled": body.enabled,
        "optInKeywords": Bson::Array(opt_in),
        "optOutKeywords": Bson::Array(opt_out),
        "optInResponse": &body.opt_in_response,
        "optOutResponse": &body.opt_out_response,
    };
    set_on_project(
        &state.mongo,
        &project_id,
        &user,
        doc! { "optInOutSettings": payload },
    )
    .await?;
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Pull a sub-document field off the project and clean it for the
/// client, or yield JSON `null` when absent/non-document.
fn sub_doc_to_json(project: &Document, key: &str) -> Value {
    match project.get_document(key) {
        Ok(sub) => document_to_clean_json(sub.clone()),
        Err(_) => Value::Null,
    }
}

/// Serialize one `GeneralReplyRule` to a BSON document for storage.
///
/// Note: the TS actions for these settings do not stamp `updatedAt` on
/// the project, so we intentionally omit it to preserve identical write
/// shapes against the existing data.
fn reply_rule_to_bson(rule: &GeneralReplyRule) -> Bson {
    Bson::Document(doc! {
        "id": &rule.id,
        "keywords": &rule.keywords,
        "reply": &rule.reply,
        "matchType": &rule.match_type,
    })
}
