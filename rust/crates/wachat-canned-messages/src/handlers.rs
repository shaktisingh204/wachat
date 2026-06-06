//! HTTP handlers for the wachat canned-messages domain.
//!
//! Every endpoint is scoped to the authenticated user (`userId`) and, where a
//! `project_id` is present in the path, also to that project (`projectId`).
//! The `/wachat/settings/canned` page is the consumer.
//!
//! | Endpoint                                            | Action            |
//! |-----------------------------------------------------|-------------------|
//! | `GET    /v1/wachat/canned-messages/{project_id}`            | list messages     |
//! | `POST   /v1/wachat/canned-messages/{project_id}`            | create message    |
//! | `PUT    /v1/wachat/canned-messages/{project_id}/{message_id}` | update message  |
//! | `DELETE /v1/wachat/canned-messages/{message_id}`            | delete message    |
//! | `GET    /v1/wachat/canned-messages/{project_id}/settings`   | get settings      |
//! | `PUT    /v1/wachat/canned-messages/{project_id}/settings`   | upsert settings   |

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CannedMessageBody, CannedSettingsBody, CannedSettingsResponse, ListMessagesResponse,
    SuccessResponse,
};
use crate::state::WachatCannedMessagesState;

/// Canned-message documents.
const COLL: &str = "wa_canned_messages";
/// Per-user/per-project canned-message settings (one doc per tenant scope).
const SETTINGS_COLL: &str = "wa_canned_message_settings";

/// Accepted message types.
const VALID_TYPES: [&str; 5] = ["text", "image", "video", "audio", "document"];

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Validate a create/update body and return the BSON `content` sub-document.
fn validate_and_build_content(body: &CannedMessageBody) -> Result<Document> {
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("Name is required.".to_owned()));
    }
    if !VALID_TYPES.contains(&body.r#type.as_str()) {
        return Err(ApiError::Validation(
            "Type must be one of: text, image, video, audio, document.".to_owned(),
        ));
    }

    let mut content = Document::new();
    if body.r#type == "text" {
        let text = body.resolved_text().ok_or_else(|| {
            ApiError::Validation("Text content is required for text messages.".to_owned())
        })?;
        content.insert("text", text);
    } else {
        let media_url = body.resolved_media_url().ok_or_else(|| {
            ApiError::Validation("Media URL is required for media messages.".to_owned())
        })?;
        content.insert("mediaUrl", media_url);
        if let Some(caption) = body.resolved_caption() {
            content.insert("caption", caption);
        }
        if let Some(file_name) = body.resolved_file_name() {
            content.insert("fileName", file_name);
        }
    }
    Ok(content)
}

// ===========================================================================
// GET /v1/wachat/canned-messages/{project_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_messages(
    user: AuthUser,
    State(state): State<WachatCannedMessagesState>,
    Path(project_id): Path<String>,
) -> Result<Json<ListMessagesResponse>> {
    let uid = user_oid(&user)?;
    let pid = oid_from_str(&project_id)?;

    let cursor = state
        .mongo
        .collection::<Document>(COLL)
        .find(doc! { "userId": uid, "projectId": pid })
        // Favourites first, then alphabetical by name.
        .sort(doc! { "isFavourite": -1, "name": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("canned.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("canned.collect")))?;
    let messages = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListMessagesResponse { messages }))
}

// ===========================================================================
// POST /v1/wachat/canned-messages/{project_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_message(
    user: AuthUser,
    State(state): State<WachatCannedMessagesState>,
    Path(project_id): Path<String>,
    Json(body): Json<CannedMessageBody>,
) -> Result<Json<Value>> {
    let uid = user_oid(&user)?;
    let pid = oid_from_str(&project_id)?;
    let content = validate_and_build_content(&body)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    let new_doc = doc! {
        "_id": new_oid,
        "userId": uid,
        "projectId": pid,
        "name": body.name.trim(),
        "type": &body.r#type,
        "content": content,
        "isFavourite": body.is_favourite,
        "createdBy": &user.user_id,
        "createdAt": now,
        "updatedAt": now,
    };
    state
        .mongo
        .collection::<Document>(COLL)
        .insert_one(new_doc.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("canned.insert_one")))?;
    Ok(Json(document_to_clean_json(new_doc)))
}

// ===========================================================================
// PUT /v1/wachat/canned-messages/{project_id}/{message_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn update_message(
    user: AuthUser,
    State(state): State<WachatCannedMessagesState>,
    Path((project_id, message_id)): Path<(String, String)>,
    Json(body): Json<CannedMessageBody>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let pid = oid_from_str(&project_id)?;
    let mid = oid_from_str(&message_id)?;
    let content = validate_and_build_content(&body)?;
    let now = bson::DateTime::from_chrono(Utc::now());

    let res = state
        .mongo
        .collection::<Document>(COLL)
        .update_one(
            doc! { "_id": mid, "userId": uid, "projectId": pid },
            doc! { "$set": {
                "name": body.name.trim(),
                "type": &body.r#type,
                "content": content,
                "isFavourite": body.is_favourite,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("canned.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Canned message not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/wachat/canned-messages/{message_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn delete_message(
    user: AuthUser,
    State(state): State<WachatCannedMessagesState>,
    Path(message_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let mid = oid_from_str(&message_id)?;

    let res = state
        .mongo
        .collection::<Document>(COLL)
        .delete_one(doc! { "_id": mid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("canned.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Canned message not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// GET /v1/wachat/canned-messages/{project_id}/settings
// ===========================================================================

#[instrument(skip_all)]
pub async fn get_settings(
    user: AuthUser,
    State(state): State<WachatCannedMessagesState>,
    Path(project_id): Path<String>,
) -> Result<Json<CannedSettingsResponse>> {
    let uid = user_oid(&user)?;
    let pid = oid_from_str(&project_id)?;

    let existing = state
        .mongo
        .collection::<Document>(SETTINGS_COLL)
        .find_one(doc! { "userId": uid, "projectId": pid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("canned_settings.find_one")))?;

    let resp = match existing {
        Some(doc) => CannedSettingsResponse {
            sync_across_projects: doc.get_bool("syncAcrossProjects").unwrap_or(false),
            keyboard_trigger: doc
                .get_str("keyboardTrigger")
                .map(str::to_owned)
                .unwrap_or_default(),
        },
        // Sensible defaults when the tenant has never saved settings.
        None => CannedSettingsResponse {
            sync_across_projects: false,
            keyboard_trigger: "Cmd + /".to_owned(),
        },
    };
    Ok(Json(resp))
}

// ===========================================================================
// PUT /v1/wachat/canned-messages/{project_id}/settings
// ===========================================================================

#[instrument(skip_all)]
pub async fn update_settings(
    user: AuthUser,
    State(state): State<WachatCannedMessagesState>,
    Path(project_id): Path<String>,
    Json(body): Json<CannedSettingsBody>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let pid = oid_from_str(&project_id)?;
    let now = bson::DateTime::from_chrono(Utc::now());

    let trigger: Bson = match body.keyboard_trigger.as_deref() {
        Some(t) => Bson::String(t.to_owned()),
        None => Bson::Null,
    };

    state
        .mongo
        .collection::<Document>(SETTINGS_COLL)
        .update_one(
            doc! { "userId": uid, "projectId": pid },
            doc! {
                "$set": {
                    "syncAcrossProjects": body.sync_across_projects,
                    "keyboardTrigger": trigger,
                    "updatedAt": now,
                },
                "$setOnInsert": {
                    "userId": uid,
                    "projectId": pid,
                    "createdAt": now,
                },
            },
        )
        .upsert(true)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("canned_settings.upsert"))
        })?;
    Ok(Json(SuccessResponse::ok()))
}
