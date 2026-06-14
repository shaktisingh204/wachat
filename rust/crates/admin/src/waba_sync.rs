//! Admin-gated WhatsApp Business Account (WABA) onboarding.
//!
//! Ports `handleSyncWabas` from `src/app/actions/user.actions.ts` (lines
//! 110–223). The TS function is reachable from `/admin/dashboard/system` and
//! lets staff paste a Meta `wabaId` + `accessToken` + `appId` to attach an
//! existing WhatsApp Business Account as a SabNode project.
//!
//! The flow:
//! 1. Fetch `GET https://graph.facebook.com/v23.0/{wabaId}` to confirm the
//!    token can see the WABA and recover its display name.
//! 2. Optionally insert a `project_groups` doc when `groupName` is supplied.
//! 3. Upsert one row into `projects` keyed by `(userId, wabaId)`.
//! 4. Return the new project id; phone-number sync + webhook subscription
//!    are kicked off separately via the existing per-project endpoints.
//!
//! The TS variant tried to chain phone sync + webhook subscribe inline. We
//! deliberately keep those out of this handler — the admin proxy in TS calls
//! the existing Rust endpoints once we've returned, which keeps each
//! invocation idempotent and easy to retry.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, State},
    routing::post,
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use wachat_meta_client::MetaClient;

use crate::guard::require_admin;

const PROJECTS_COLL: &str = "projects";
const PROJECT_GROUPS_COLL: &str = "project_groups";
const META_API_VERSION: &str = "v25.0";
/// Default messages-per-second new projects start at; matches the value
/// the TS handler set on insert (`messagesPerSecond: 80`).
const DEFAULT_MPS: i64 = 80;

#[derive(Debug, Deserialize, ToSchema)]
pub struct SyncWabaBody {
    /// Mongo `_id` (hex string) of the SabNode user the project is being
    /// attached to. The TS caller resolves this from its own session.
    #[serde(rename = "userId")]
    pub user_id: String,
    /// Meta access token with `whatsapp_business_management` scope.
    #[serde(rename = "accessToken")]
    pub access_token: String,
    /// Meta App ID that owns the access token.
    #[serde(rename = "appId")]
    pub app_id: String,
    /// Numeric Meta WABA id (15–25 digit string).
    #[serde(rename = "wabaId")]
    pub waba_id: String,
    /// Optional human-readable label that wraps the new project in a group.
    #[serde(default, rename = "groupName")]
    pub group_name: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SyncWabaResponse {
    pub ok: bool,
    pub message: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    /// Echo back the WABA name Meta returned so the UI can show it.
    #[serde(rename = "wabaName")]
    pub waba_name: String,
    /// Count of WABAs newly attached. Always 1 on success; matches TS.
    pub count: u32,
}

#[derive(Debug, Deserialize)]
struct MetaWaba {
    id: String,
    #[serde(default)]
    name: Option<String>,
}

/// `POST /v1/admin/waba/sync` — fetch a WABA from Meta and attach it as a
/// project. Returns the inserted (or updated) project id.
pub async fn sync_waba(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<SyncWabaBody>,
) -> Result<Json<SyncWabaResponse>> {
    require_admin(&user)?;

    let access_token = body.access_token.trim().to_owned();
    let app_id = body.app_id.trim().to_owned();
    let waba_id = body.waba_id.trim().to_owned();
    let group_name = body
        .group_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let user_oid = ObjectId::parse_str(&body.user_id)
        .map_err(|_| ApiError::BadRequest("Invalid userId.".to_owned()))?;

    if access_token.is_empty() || app_id.is_empty() || waba_id.is_empty() {
        return Err(ApiError::BadRequest(
            "WABA ID, Access Token, and App ID are required.".to_owned(),
        ));
    }
    // Mirror the TS regex `^\d{6,25}$`.
    if waba_id.len() < 6 || waba_id.len() > 25 || !waba_id.chars().all(|c| c.is_ascii_digit()) {
        return Err(ApiError::BadRequest(
            "WABA ID should be a numeric id from Meta Business Manager. Double-check that you \
             pasted the WhatsApp Business Account ID (not the Business Portfolio, Page, or App ID)."
                .to_owned(),
        ));
    }

    // 1. Confirm the WABA is reachable + recover its display name.
    let meta = MetaClient::new(META_API_VERSION);
    let path = format!("{waba_id}?fields=id,name,currency,timezone_id,message_template_namespace");
    let waba: MetaWaba = meta.get_json(&path, &access_token).await.map_err(|e| {
        // `MetaError -> ApiError` exists in wachat-meta-client; surface
        // Meta's actual error so admins can see "expired token" / "missing
        // scope" rather than a generic 500.
        ApiError::from(e)
    })?;

    if waba.id != waba_id {
        return Err(ApiError::BadRequest(format!(
            "Meta returned a different id ({}) than requested ({waba_id}). Aborting.",
            waba.id
        )));
    }
    let waba_name = waba.name.unwrap_or_else(|| format!("WABA {waba_id}"));

    // 2. Optional project group.
    let mut group_id: Option<ObjectId> = None;
    if let Some(name) = group_name.as_ref() {
        let now = bson::DateTime::from_chrono(Utc::now());
        let res = mongo
            .collection::<Document>(PROJECT_GROUPS_COLL)
            .insert_one(doc! {
                "userId": user_oid,
                "name": name,
                "createdAt": now,
            })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("project_groups.insert_one"))
            })?;
        group_id = res.inserted_id.as_object_id();
    }

    // 3. Upsert project keyed by (userId, wabaId).
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut set_doc = doc! {
        "name": &waba_name,
        "accessToken": &access_token,
        "appId": &app_id,
    };
    if let (Some(gid), Some(gname)) = (group_id, group_name.as_ref()) {
        set_doc.insert("groupId", gid);
        set_doc.insert("groupName", gname);
    }

    let set_on_insert = doc! {
        "userId": user_oid,
        "wabaId": &waba_id,
        "createdAt": now,
        "messagesPerSecond": DEFAULT_MPS,
    };

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    coll.update_one(
        doc! { "userId": user_oid, "wabaId": &waba_id },
        doc! { "$set": set_doc, "$setOnInsert": set_on_insert },
    )
    .upsert(true)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.upsert")))?;

    let project = coll
        .find_one(doc! { "userId": user_oid, "wabaId": &waba_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "project disappeared between upsert and read"
            ))
        })?;
    let project_id = project
        .get_object_id("_id")
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("missing _id: {e}")))?
        .to_hex();

    Ok(Json(SyncWabaResponse {
        ok: true,
        message: format!("Added WhatsApp Business Account \"{waba_name}\"."),
        project_id,
        waba_name,
        count: 1,
    }))
}

pub fn routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/waba/sync", post(sync_waba))
}
