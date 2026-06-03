//! WABA / phone-number health, conversational automation, and
//! commerce-settings — thin wrappers over Meta Graph API calls that
//! previously lived in `src/app/actions/whatsapp.actions.ts`
//! (`getWabaHealthStatus`, `getPhoneNumberHealthStatus`,
//!  `getConversationalAutomation`, `handleUpdateConversationalAutomation`,
//!  `handleDeleteConversationalAutomation`,
//!  `getCommerceSettings`, `handleUpdateCommerceSettings`).
//!
//! All routes are scoped by `wabaId` or `phoneId`. The owning project is
//! resolved server-side from `(wabaId|phoneNumbers.id, userId)` so the
//! caller never has to pass a `projectId` — and a foreign tenant cannot
//! probe an id they do not own (the lookup just returns 404).

use axum::{
    Json,
    extract::{Path, State},
};
use bson::doc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use wachat_types::Project;

use crate::state::WachatFeaturesState;

const PROJECTS_COLL: &str = "projects";

// ---------------------------------------------------------------------------
// Tenancy helpers
// ---------------------------------------------------------------------------

/// Resolve the project that owns `waba_id` *and* belongs to the calling
/// user. Returns 404 if no such project exists for this tenant. Mirrors
/// `getProjectById(projectId)` semantics from the legacy action — except
/// the projectId is derived from `wabaId` so the route surface doesn't
/// have to carry it.
async fn load_project_by_waba(
    user: &AuthUser,
    mongo: &MongoHandle,
    waba_id: &str,
) -> Result<Project> {
    let user_oid = oid_from_str(&user.tenant_id)?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "wabaId": waba_id, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project for waba {waba_id}")))?;
    Ok(project)
}

/// Resolve the project that contains `phone_id` under
/// `phoneNumbers[].id` and belongs to the calling user. Returns 404 if
/// no such project exists for this tenant.
async fn load_project_by_phone(
    user: &AuthUser,
    mongo: &MongoHandle,
    phone_id: &str,
) -> Result<Project> {
    let user_oid = oid_from_str(&user.tenant_id)?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "phoneNumbers.id": phone_id, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project for phone {phone_id}")))?;
    Ok(project)
}

fn require_token(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("Access token missing.".to_owned()))
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WabaHealthResp {
    pub health_status: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneHealthResp {
    pub health_status: Option<Value>,
    pub messaging_limit_tier: Option<Value>,
    pub name_status: Option<Value>,
    pub quality_rating: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct AutomationResp {
    pub automation: Value,
}

#[derive(Debug, Serialize)]
pub struct CommerceResp {
    pub settings: Value,
}

#[derive(Debug, Serialize)]
pub struct MsgResp {
    pub message: String,
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/// `GET /waba/{waba_id}/health` → Meta `GET /{wabaId}?fields=health_status`.
pub async fn waba_health(
    user: AuthUser,
    Path(waba_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<WabaHealthResp>> {
    let project = load_project_by_waba(&user, &state.mongo, &waba_id).await?;
    let token = require_token(&project)?;

    let path = format!("{waba_id}?fields=health_status");
    let resp: Value = state
        .meta
        .get_json(&path, token)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(WabaHealthResp {
        health_status: resp.get("health_status").cloned(),
    }))
}

/// `GET /phone-numbers/{phone_id}/health` → Meta
/// `GET /{phoneId}?fields=health_status,messaging_limit_tier,name_status,quality_rating`.
pub async fn phone_health(
    user: AuthUser,
    Path(phone_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<PhoneHealthResp>> {
    let project = load_project_by_phone(&user, &state.mongo, &phone_id).await?;
    let token = require_token(&project)?;

    let path =
        format!("{phone_id}?fields=health_status,messaging_limit_tier,name_status,quality_rating");
    let resp: Value = state
        .meta
        .get_json(&path, token)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(PhoneHealthResp {
        health_status: resp.get("health_status").cloned(),
        messaging_limit_tier: resp.get("messaging_limit_tier").cloned(),
        name_status: resp.get("name_status").cloned(),
        quality_rating: resp.get("quality_rating").cloned(),
    }))
}

// ---------------------------------------------------------------------------
// Conversational automation
// ---------------------------------------------------------------------------

/// `GET /phone-numbers/{phone_id}/conversational-automation`.
///
/// Meta returns either `{ data: [...] }` (paginated) or the entity object
/// directly depending on shape — the legacy action preserved both, so we
/// do too.
pub async fn get_conversational_automation(
    user: AuthUser,
    Path(phone_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<AutomationResp>> {
    let project = load_project_by_phone(&user, &state.mongo, &phone_id).await?;
    let token = require_token(&project)?;

    let path = format!("{phone_id}/conversational_automation");
    let resp: Value = state
        .meta
        .get_json(&path, token)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let automation = resp.get("data").cloned().unwrap_or_else(|| resp.clone());

    Ok(Json(AutomationResp { automation }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AutomationCommand {
    pub command_name: String,
    pub command_description: String,
}

#[derive(Debug, Deserialize, Default)]
#[serde(default, rename_all = "snake_case")]
pub struct UpdateAutomationBody {
    pub enable_welcome_message: Option<bool>,
    pub prompts: Option<Vec<String>>,
    pub commands: Option<Vec<AutomationCommand>>,
}

/// `POST /phone-numbers/{phone_id}/conversational-automation`.
pub async fn update_conversational_automation(
    user: AuthUser,
    Path(phone_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<UpdateAutomationBody>,
) -> Result<Json<MsgResp>> {
    let project = load_project_by_phone(&user, &state.mongo, &phone_id).await?;
    let token = require_token(&project)?;

    let mut payload = serde_json::Map::new();
    if let Some(v) = body.enable_welcome_message {
        payload.insert("enable_welcome_message".to_owned(), json!(v));
    }
    if let Some(v) = body.prompts {
        payload.insert("prompts".to_owned(), json!(v));
    }
    if let Some(v) = body.commands {
        let arr: Vec<Value> = v
            .into_iter()
            .map(|c| {
                json!({
                    "command_name": c.command_name,
                    "command_description": c.command_description,
                })
            })
            .collect();
        payload.insert("commands".to_owned(), Value::Array(arr));
    }

    let path = format!("{phone_id}/conversational_automation");
    state
        .meta
        .post_json::<_, Value>(&path, token, &Value::Object(payload))
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(MsgResp {
        message: "Conversational automation settings updated successfully.".to_owned(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct DeleteAutomationBody {
    pub fields: Vec<String>,
}

/// `DELETE /phone-numbers/{phone_id}/conversational-automation`.
///
/// Meta accepts a `fields` list in the request body for this DELETE.
/// The shared `MetaClient::delete` does not support a body, so we issue
/// the request directly via the underlying `reqwest::Client` is not
/// exposed; we instead encode `fields` as a URL query — Meta accepts both
/// forms. The legacy axios call sent the array as `data`, which axios
/// serializes into the body; replicating that exactly would require a
/// new `MetaClient` helper. To keep the same on-the-wire effect (clear
/// the listed fields) we send a query-string variant which Meta documents
/// for `conversational_automation` field deletion.
pub async fn delete_conversational_automation(
    user: AuthUser,
    Path(phone_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<DeleteAutomationBody>,
) -> Result<Json<MsgResp>> {
    let project = load_project_by_phone(&user, &state.mongo, &phone_id).await?;
    let token = require_token(&project)?;

    if body.fields.is_empty() {
        return Err(ApiError::BadRequest(
            "fields[] is required and must be non-empty.".to_owned(),
        ));
    }

    // Comma-separated list, URL-encoded. Meta's Graph API accepts
    // `?fields=a,b` on the DELETE for this resource as the documented
    // alternative to a JSON body.
    let joined = body.fields.join(",");
    let path = format!(
        "{phone_id}/conversational_automation?fields={}",
        urlencoding_encode(&joined)
    );
    state
        .meta
        .delete(&path, token)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(MsgResp {
        message: "Conversational automation settings removed.".to_owned(),
    }))
}

// ---------------------------------------------------------------------------
// Commerce settings
// ---------------------------------------------------------------------------

/// `GET /phone-numbers/{phone_id}/commerce-settings` → Meta
/// `GET /{phoneId}/whatsapp_commerce_settings`.
pub async fn get_commerce_settings(
    user: AuthUser,
    Path(phone_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<CommerceResp>> {
    let project = load_project_by_phone(&user, &state.mongo, &phone_id).await?;
    let token = require_token(&project)?;

    let path = format!("{phone_id}/whatsapp_commerce_settings");
    let resp: Value = state
        .meta
        .get_json(&path, token)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let settings = resp
        .get("data")
        .and_then(|d| d.as_array())
        .and_then(|arr| arr.first().cloned())
        .unwrap_or_else(|| resp.clone());

    Ok(Json(CommerceResp { settings }))
}

#[derive(Debug, Deserialize, Default)]
#[serde(default, rename_all = "snake_case")]
pub struct UpdateCommerceBody {
    pub is_cart_enabled: Option<bool>,
    pub is_catalog_visible: Option<bool>,
}

/// `POST /phone-numbers/{phone_id}/commerce-settings`.
pub async fn update_commerce_settings(
    user: AuthUser,
    Path(phone_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<UpdateCommerceBody>,
) -> Result<Json<MsgResp>> {
    let project = load_project_by_phone(&user, &state.mongo, &phone_id).await?;
    let token = require_token(&project)?;

    let mut payload = serde_json::Map::new();
    if let Some(v) = body.is_cart_enabled {
        payload.insert("is_cart_enabled".to_owned(), json!(v));
    }
    if let Some(v) = body.is_catalog_visible {
        payload.insert("is_catalog_visible".to_owned(), json!(v));
    }

    let path = format!("{phone_id}/whatsapp_commerce_settings");
    state
        .meta
        .post_json::<_, Value>(&path, token, &Value::Object(payload))
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(MsgResp {
        message: "Commerce settings updated successfully.".to_owned(),
    }))
}

// ---------------------------------------------------------------------------
// Tiny URL-encoder — copied locally so we don't pull in `urlencoding`
// just for one call.
// ---------------------------------------------------------------------------

fn urlencoding_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b',' => {
                out.push(b as char);
            }
            _ => {
                out.push('%');
                out.push_str(&format!("{:02X}", b));
            }
        }
    }
    out
}
