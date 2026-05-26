//! HTTP handlers for the SabChat **marketplace** domain.
//!
//! Each handler maps 1:1 to a route mounted under `/v1/sabchat/marketplace`.
//! One collection backs this surface:
//!
//! - `sabchat_installed_apps` — one doc per installed app (tenant-scoped).
//!
//! ## Tenancy
//!
//! Every read and write filters on `tenantId = ObjectId(auth.tenant_id)`.
//! A malformed JWT subject yields
//! [`ApiError::Unauthorized`](sabnode_common::ApiError::Unauthorized) — no
//! cross-tenant access is possible from the wire.

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
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    GetInstalledAppResponse, InstallAppBody, InstallAppResponse, ListInstalledAppsResponse,
    SuccessResponse,
};
use crate::state::SabChatMarketplaceState;

const INSTALLED_APPS_COLL: &str = "sabchat_installed_apps";

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the JWT tenant claim into an `ObjectId`. A malformed claim yields
/// `401 Unauthorized` — the token is structurally invalid, not the request.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

// ===========================================================================
// POST /v1/sabchat/marketplace — install_app
// ===========================================================================

/// `POST /v1/sabchat/marketplace` — install a new app under the calling tenant.
#[instrument(skip_all)]
pub async fn install_app(
    user: AuthUser,
    State(state): State<SabChatMarketplaceState>,
    Json(body): Json<InstallAppBody>,
) -> Result<Json<InstallAppResponse>> {
    if body.app_id.trim().is_empty() {
        return Err(ApiError::Validation("appId is required".to_owned()));
    }
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let tenant_id = tenant_oid(&user)?;

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    let mut app_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant_id,
        "appId": body.app_id.trim(),
        "name": body.name.trim(),
        "createdAt": now,
        "updatedAt": now,
    };

    if let Some(config) = body.configuration {
        app_doc.insert("configuration", bson::to_bson(&config).unwrap_or(Bson::Null));
    }

    state
        .mongo
        .collection::<Document>(INSTALLED_APPS_COLL)
        .insert_one(app_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_installed_apps.insert_one")))?;

    Ok(Json(InstallAppResponse {
        installed_app_id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /v1/sabchat/marketplace — list_installed_apps
// ===========================================================================

/// `GET /v1/sabchat/marketplace` — list every installed app the calling tenant owns,
/// sorted by `createdAt` descending.
#[instrument(skip_all)]
pub async fn list_installed_apps(
    user: AuthUser,
    State(state): State<SabChatMarketplaceState>,
) -> Result<Json<ListInstalledAppsResponse>> {
    let tenant_id = tenant_oid(&user)?;

    let opts = FindOptions::builder().sort(doc! { "createdAt": -1 }).build();

    let cursor = state
        .mongo
        .collection::<Document>(INSTALLED_APPS_COLL)
        .find(doc! { "tenantId": tenant_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_installed_apps.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_installed_apps.collect")))?;

    let apps: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListInstalledAppsResponse { apps }))
}

// ===========================================================================
// GET /v1/sabchat/marketplace/{id} — get_installed_app
// ===========================================================================

/// `GET /v1/sabchat/marketplace/{id}` — fetch a single installed app by id.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_installed_app(
    user: AuthUser,
    State(state): State<SabChatMarketplaceState>,
    Path(id): Path<String>,
) -> Result<Json<GetInstalledAppResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let app_oid = oid_from_str(&id)?;

    let app = state
        .mongo
        .collection::<Document>(INSTALLED_APPS_COLL)
        .find_one(doc! { "_id": app_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_installed_apps.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("installed app not found".to_owned()))?;

    Ok(Json(GetInstalledAppResponse {
        app: document_to_clean_json(app),
    }))
}

// ===========================================================================
// DELETE /v1/sabchat/marketplace/{id} — uninstall_app
// ===========================================================================

/// `DELETE /v1/sabchat/marketplace/{id}` — hard delete an installed app.
#[instrument(skip_all, fields(id = %id))]
pub async fn uninstall_app(
    user: AuthUser,
    State(state): State<SabChatMarketplaceState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let app_oid = oid_from_str(&id)?;

    let res = state
        .mongo
        .collection::<Document>(INSTALLED_APPS_COLL)
        .delete_one(doc! { "_id": app_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_installed_apps.delete_one"))
        })?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("installed app not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}
