//! HTTP handlers for the Messenger Profile / Personas / Saved Responses
//! domain.
//!
//! Each handler maps 1:1 to an `export async function` in
//! `src/app/actions/facebook.actions.ts`. The TS originals return
//! `{ success?, error?, … }` envelopes and never throw — we follow the same
//! convention so callers can branch on `body.error` without having to
//! special-case 4xx vs JSON envelope errors.
//!
//! ## Project access check
//!
//! [`load_project_for`] resolves a project by id and verifies the caller is
//! the owner (`project.userId === user._id`). Mirrors the TS
//! `getProjectById` helper.
//!
//! ## Token plumbing
//!
//! TS code passes the page access token as `?access_token=…` on every Graph
//! API call. We let `MetaClient` set `Authorization: Bearer` instead.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use wachat_meta_client::MetaError;

use crate::dto::{
    AckResult, CreatePersonaBody, CreatePersonaResp, CreateSavedResponseBody,
    DeleteProfileFieldsBody, MessageResult, PersistentMenuItem, PersonasResp, ProfileQuery,
    ProfileResp, SavePersistentMenuBody, SavedResponsesResp, SetGetStartedBody, SetGreetingBody,
    SetIceBreakersBody, SetWhitelistedDomainsBody, UpdateSavedResponseBody,
    UploadReusableAttachmentBody, UploadReusableAttachmentResp,
};
use crate::state::WachatFacebookMessengerProfileState;

const PROJECTS_COLLECTION: &str = "projects";

const ERR_PROJECT_MISSING_TOKEN: &str =
    "Project not found or is missing Facebook Page ID or access token.";
const ERR_ACCESS_DENIED: &str = "Access denied.";

// =========================================================================
//  Project / user helpers
// =========================================================================

fn parse_user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

fn parse_project_oid(id: &str) -> Result<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| ApiError::BadRequest("invalid project id".to_owned()))
}

/// Lightweight projection of the `projects` doc fields the handlers care
/// about.
pub struct ProjectCtx {
    pub facebook_page_id: Option<String>,
    pub access_token: Option<String>,
}

/// Resolve a project by id and confirm the caller owns it. Returns
/// `NotFound` for both "project missing" *and* "project belongs to another
/// user", so we don't leak project existence across tenants.
///
/// Mirrors the `getProjectById(projectId)` access path the TS module
/// invokes at the top of every action.
pub async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ProjectCtx> {
    let project_oid = parse_project_oid(project_id)?;
    let user_oid = parse_user_oid(user)?;

    let coll = mongo.collection::<Document>(PROJECTS_COLLECTION);
    let doc = coll
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("project".to_owned()))?;

    let owner = doc.get_object_id("userId").ok();
    if owner != Some(user_oid) {
        return Err(ApiError::NotFound("project".to_owned()));
    }

    Ok(ProjectCtx {
        facebook_page_id: doc.get_str("facebookPageId").ok().map(|s| s.to_owned()),
        access_token: doc.get_str("accessToken").ok().map(|s| s.to_owned()),
    })
}

fn require_token(p: &ProjectCtx) -> std::result::Result<&str, &'static str> {
    p.access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_TOKEN)
}

fn require_page(p: &ProjectCtx) -> std::result::Result<(&str, &str), &'static str> {
    let token = require_token(p)?;
    let page = p
        .facebook_page_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_TOKEN)?;
    Ok((page, token))
}

/// Squash a `MetaError` into the `String` shape the TS callers expect.
fn err_msg(e: MetaError) -> String {
    e.to_string()
}

// =========================================================================
//  getMessengerProfile  (GET /:project_id/profile)
// =========================================================================

const DEFAULT_PROFILE_FIELDS: &str =
    "greeting,get_started,persistent_menu,ice_breakers,whitelisted_domains";

pub async fn get_messenger_profile(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Query(q): Query<ProfileQuery>,
) -> Json<ProfileResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(ProfileResp {
                error: Some(ERR_PROJECT_MISSING_TOKEN.to_owned()),
                ..Default::default()
            });
        }
    };
    // The TS getMessengerProfile insists on both Page ID + token being set
    // before issuing the request, even though the call itself is to /me.
    let (_page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(ProfileResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = q
        .fields
        .unwrap_or_else(|| DEFAULT_PROFILE_FIELDS.to_owned());
    let path = format!(
        "me/messenger_profile?fields={}",
        urlencoding::encode(&fields)
    );
    match s.meta.get_json::<Value>(&path, token).await {
        Ok(v) => {
            // Mirror TS: `response.data.data?.[0] || {}`.
            let profile = v
                .get("data")
                .and_then(|d| d.as_array())
                .and_then(|a| a.first())
                .cloned()
                .unwrap_or(Value::Object(serde_json::Map::new()));
            Json(ProfileResp {
                profile: Some(profile),
                ..Default::default()
            })
        }
        Err(e) => Json(ProfileResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  setMessengerGreeting  (POST /:project_id/profile/greeting)
// =========================================================================

pub async fn set_messenger_greeting(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Json(body): Json<SetGreetingBody>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };

    let payload = json!({
        "greeting": [{ "locale": "default", "text": body.greeting }]
    });
    match s
        .meta
        .post_json::<_, Value>("me/messenger_profile", token, &payload)
        .await
    {
        Ok(_) => ack_ok(),
        Err(e) => ack_err_owned(err_msg(e)),
    }
}

// =========================================================================
//  setMessengerGetStarted  (POST /:project_id/profile/get-started)
// =========================================================================

pub async fn set_messenger_get_started(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Json(body): Json<SetGetStartedBody>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };

    let payload = json!({ "get_started": { "payload": body.payload } });
    match s
        .meta
        .post_json::<_, Value>("me/messenger_profile", token, &payload)
        .await
    {
        Ok(_) => ack_ok(),
        Err(e) => ack_err_owned(err_msg(e)),
    }
}

// =========================================================================
//  setMessengerIceBreakers  (POST /:project_id/profile/ice-breakers)
// =========================================================================

pub async fn set_messenger_ice_breakers(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Json(body): Json<SetIceBreakersBody>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };

    let ice = body
        .ice_breakers
        .into_iter()
        .map(|ib| {
            json!({
                "call_to_actions": [
                    { "question": ib.question, "payload": ib.payload }
                ]
            })
        })
        .collect::<Vec<_>>();
    let payload = json!({ "ice_breakers": ice });
    match s
        .meta
        .post_json::<_, Value>("me/messenger_profile", token, &payload)
        .await
    {
        Ok(_) => ack_ok(),
        Err(e) => ack_err_owned(err_msg(e)),
    }
}

// =========================================================================
//  setWhitelistedDomains  (POST /:project_id/profile/whitelisted-domains)
// =========================================================================

pub async fn set_whitelisted_domains(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Json(body): Json<SetWhitelistedDomainsBody>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };

    let payload = json!({ "whitelisted_domains": body.domains });
    match s
        .meta
        .post_json::<_, Value>("me/messenger_profile", token, &payload)
        .await
    {
        Ok(_) => ack_ok(),
        Err(e) => ack_err_owned(err_msg(e)),
    }
}

// =========================================================================
//  deleteMessengerProfileFields  (DELETE /:project_id/profile)
// =========================================================================
//
// The TS implementation issues `axios.delete(url, { params, data: { fields }})`
// — i.e. a DELETE with a JSON body. The Graph API accepts the field list as
// either query string or JSON body; `MetaClient::delete` doesn't support
// bodies, so we encode the fields as a comma-separated `fields=` query
// parameter, which Graph also accepts (and matches the Messenger Profile
// reference docs).

pub async fn delete_messenger_profile_fields(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Json(body): Json<DeleteProfileFieldsBody>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    if body.fields.is_empty() {
        return ack_err("At least one field is required.");
    }

    let fields_csv = body.fields.join(",");
    let path = format!(
        "me/messenger_profile?fields={}",
        urlencoding::encode(&fields_csv)
    );
    match s.meta.delete(&path, token).await {
        Ok(_) => ack_ok(),
        Err(e) => ack_err_owned(err_msg(e)),
    }
}

// =========================================================================
//  savePersistentMenu  (POST /:project_id/profile/persistent-menu)
// =========================================================================
//
// Legacy form body in TS reads `projectId` and `menuItems` (a JSON-encoded
// array) from `FormData`. The Rust BFF takes the parsed array directly and
// also performs the "empty menu = DELETE" branch the legacy code did.

pub async fn save_persistent_menu(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Json(body): Json<SavePersistentMenuBody>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };

    if body.menu_items.is_empty() {
        // TS legacy: DELETE with `fields: ['persistent_menu']`.
        let path = "me/messenger_profile?fields=persistent_menu";
        match s.meta.delete(path, token).await {
            Ok(_) => ack_ok(),
            Err(e) => ack_err_owned(err_msg(e)),
        }
    } else {
        let cta = body
            .menu_items
            .into_iter()
            .map(|item| match item {
                PersistentMenuItem::WebUrl { title, url } => json!({
                    "type": "web_url",
                    "title": title,
                    "url": url,
                }),
                PersistentMenuItem::Postback { title, payload } => json!({
                    "type": "postback",
                    "title": title,
                    "payload": payload,
                }),
            })
            .collect::<Vec<_>>();
        let payload = json!({
            "persistent_menu": [{
                "locale": "default",
                "composer_input_disabled": false,
                "call_to_actions": cta,
            }]
        });
        match s
            .meta
            .post_json::<_, Value>("me/messenger_profile", token, &payload)
            .await
        {
            Ok(_) => ack_ok(),
            Err(e) => ack_err_owned(err_msg(e)),
        }
    }
}

// =========================================================================
//  Personas
// =========================================================================

pub async fn get_personas(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
) -> Json<PersonasResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(PersonasResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (_page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(PersonasResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    match s.meta.get_json::<Value>("me/personas", token).await {
        Ok(v) => {
            let data = v
                .get("data")
                .and_then(|d| d.as_array())
                .cloned()
                .unwrap_or_default();
            Json(PersonasResp {
                personas: Some(data),
                ..Default::default()
            })
        }
        Err(e) => Json(PersonasResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn create_persona(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreatePersonaBody>,
) -> Json<CreatePersonaResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(CreatePersonaResp {
                error: Some(ERR_ACCESS_DENIED.to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(CreatePersonaResp {
                error: Some(ERR_ACCESS_DENIED.to_owned()),
                ..Default::default()
            });
        }
    };

    let payload = json!({
        "name": body.name,
        "profile_picture_url": body.profile_picture_url,
    });
    match s
        .meta
        .post_json::<_, Value>("me/personas", token, &payload)
        .await
    {
        Ok(v) => Json(CreatePersonaResp {
            persona_id: v.get("id").and_then(|i| i.as_str()).map(|s| s.to_owned()),
            ..Default::default()
        }),
        Err(e) => Json(CreatePersonaResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn delete_persona(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path((project_id, persona_id)): Path<(String, String)>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };

    match s.meta.delete(&persona_id, token).await {
        Ok(_) => ack_ok(),
        Err(e) => ack_err_owned(err_msg(e)),
    }
}

// =========================================================================
//  Saved Responses
// =========================================================================

pub async fn get_saved_responses(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
) -> Json<SavedResponsesResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(SavedResponsesResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (_page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(SavedResponsesResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = "me/saved_message_responses?fields=id,title,message,is_enabled,image";
    match s.meta.get_json::<Value>(path, token).await {
        Ok(v) => {
            let data = v
                .get("data")
                .and_then(|d| d.as_array())
                .cloned()
                .unwrap_or_default();
            Json(SavedResponsesResp {
                responses: Some(data),
                ..Default::default()
            })
        }
        Err(e) => Json(SavedResponsesResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

/// `createSavedResponse` legacy returns `{ message?, error? }` (rather than
/// `{ success, error }`) because it was written as a `useFormState` action.
/// We keep that shape so the TS shim is a 1:1 forward.
pub async fn create_saved_response(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateSavedResponseBody>,
) -> Json<MessageResult> {
    if body.title.is_empty() || body.message.is_empty() {
        return Json(MessageResult {
            error: Some("Project ID, title, and message are required.".to_owned()),
            ..Default::default()
        });
    }

    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(MessageResult {
                error: Some("Project is not fully configured for Facebook.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(MessageResult {
                error: Some("Project is not fully configured for Facebook.".to_owned()),
                ..Default::default()
            });
        }
    };

    let mut payload = serde_json::Map::new();
    payload.insert("title".into(), Value::String(body.title));
    payload.insert("message".into(), Value::String(body.message));
    if let Some(img) = body.image.filter(|s| !s.is_empty()) {
        payload.insert("image".into(), Value::String(img));
    }
    let path = format!("{page}/saved_message_responses");
    match s
        .meta
        .post_json::<_, Value>(&path, token, &Value::Object(payload))
        .await
    {
        Ok(_) => Json(MessageResult {
            message: Some("Saved response created successfully.".to_owned()),
            ..Default::default()
        }),
        Err(e) => Json(MessageResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn update_saved_response(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path((project_id, response_id)): Path<(String, String)>,
    Json(body): Json<UpdateSavedResponseBody>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };

    let payload = json!({
        "title": body.title,
        "message": body.message,
    });
    match s
        .meta
        .post_json::<_, Value>(&response_id, token, &payload)
        .await
    {
        Ok(_) => ack_ok(),
        Err(e) => ack_err_owned(err_msg(e)),
    }
}

pub async fn delete_saved_response(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path((project_id, response_id)): Path<(String, String)>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => return ack_err(ERR_ACCESS_DENIED),
    };

    match s.meta.delete(&response_id, token).await {
        Ok(_) => ack_ok(),
        Err(e) => ack_err_owned(err_msg(e)),
    }
}

// =========================================================================
//  uploadReusableAttachment  (POST /:project_id/attachments)
// =========================================================================

pub async fn upload_reusable_attachment(
    user: AuthUser,
    State(s): State<WachatFacebookMessengerProfileState>,
    Path(project_id): Path<String>,
    Json(body): Json<UploadReusableAttachmentBody>,
) -> Json<UploadReusableAttachmentResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(UploadReusableAttachmentResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (_page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(UploadReusableAttachmentResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let payload = json!({
        "message": {
            "attachment": {
                "type": body.attachment_type,
                "payload": {
                    "is_reusable": true,
                    "url": body.url,
                }
            }
        }
    });
    match s
        .meta
        .post_json::<_, Value>("me/message_attachments", token, &payload)
        .await
    {
        Ok(v) => Json(UploadReusableAttachmentResp {
            attachment_id: v
                .get("attachment_id")
                .and_then(|i| i.as_str())
                .map(|s| s.to_owned()),
            ..Default::default()
        }),
        Err(e) => Json(UploadReusableAttachmentResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  Tiny ack-helpers (keep the handler bodies legible)
// =========================================================================

fn ack_ok() -> Json<AckResult> {
    Json(AckResult {
        success: Some(true),
        ..Default::default()
    })
}

fn ack_err(msg: &'static str) -> Json<AckResult> {
    Json(AckResult {
        error: Some(msg.to_owned()),
        ..Default::default()
    })
}

fn ack_err_owned(msg: String) -> Json<AckResult> {
    Json(AckResult {
        error: Some(msg),
        ..Default::default()
    })
}
