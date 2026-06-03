//! Admin-gated settings handlers.
//!
//! Ports the following TS server actions in `src/app/actions/admin.actions.ts`:
//!
//! - `setWebhookProcessingStatus` / `getWebhookProcessingStatus`
//!     → `POST /webhook-processing`, `GET /webhook-processing`
//! - `setAppLogo` / `getAppLogoUrl`
//!     → `POST /app-logo`, `GET /app-logo`
//! - `setDiwaliThemeStatus` / `getDiwaliThemeStatus`
//!     → `POST /diwali-theme`, `GET /diwali-theme`
//!
//! The settings collection stores key/value documents shaped like
//! `{ key, value, updatedAt }`. Read with `findOne({ key })`, write with
//! `updateOne(..., $set: { value, updatedAt }, upsert: true)`, clear with
//! `deleteOne({ key })`. The TS in-memory caches are intentionally not ported —
//! Rust handlers go straight to Mongo so multi-instance deployments stay
//! coherent.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, State},
    routing::get,
};
use bson::{Bson, Document, doc};
use chrono::Utc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::dto::AdminOk;
use crate::guard::require_admin;
use crate::store::SETTINGS_COLL;

const WEBHOOK_PROCESSING_KEY: &str = "webhook_processing_enabled";
const APP_LOGO_KEY: &str = "app_logo_url";
const DIWALI_THEME_KEY: &str = "diwali_theme_enabled";

/// `GET /webhook-processing` / `GET /diwali-theme` response.
#[derive(Debug, Serialize, ToSchema)]
pub struct EnabledResponse {
    pub enabled: bool,
}

/// `POST /webhook-processing` / `POST /diwali-theme` request body.
#[derive(Debug, Deserialize, ToSchema)]
pub struct EnabledBody {
    pub enabled: bool,
}

/// `GET /app-logo` response. Mirrors the TS `string | null` shape.
#[derive(Debug, Serialize, ToSchema)]
pub struct AppLogoResponse {
    pub url: Option<String>,
}

/// `POST /app-logo` request body. A `None`/`null` url clears the override and
/// resets to the default logo — same as the TS branch where neither a file
/// nor a URL is provided.
#[derive(Debug, Deserialize, ToSchema)]
pub struct AppLogoBody {
    #[serde(default)]
    pub url: Option<String>,
}

/// Read a `value` field for the given settings key.
async fn read_value(mongo: &MongoHandle, key: &str, op: &'static str) -> Result<Option<Bson>> {
    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    let stored = coll
        .find_one(doc! { "key": key })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(op)))?;
    Ok(stored.and_then(|d| d.get("value").cloned()))
}

/// Upsert `{ key, value, updatedAt }` into the settings collection.
async fn write_value(mongo: &MongoHandle, key: &str, value: Bson, op: &'static str) -> Result<()> {
    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(SETTINGS_COLL)
        .update_one(
            doc! { "key": key },
            doc! {
                "$set": {
                    "key": key,
                    "value": value,
                    "updatedAt": now,
                },
            },
        )
        .upsert(true)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(op)))?;
    Ok(())
}

/// Delete the settings document for the given key.
async fn delete_key(mongo: &MongoHandle, key: &str, op: &'static str) -> Result<()> {
    mongo
        .collection::<Document>(SETTINGS_COLL)
        .delete_one(doc! { "key": key })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(op)))?;
    Ok(())
}

/// `GET /v1/admin/webhook-processing` — defaults to `true` if the key has
/// never been written, matching the TS "fail-safe to enabled" behavior.
pub async fn get_webhook_processing(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<EnabledResponse>> {
    require_admin(&user)?;
    let value = read_value(&mongo, WEBHOOK_PROCESSING_KEY, "settings.webhook.read").await?;
    let enabled = match value {
        Some(Bson::Boolean(b)) => b,
        _ => true,
    };
    Ok(Json(EnabledResponse { enabled }))
}

/// `POST /v1/admin/webhook-processing` — persist the flag.
pub async fn set_webhook_processing(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<EnabledBody>,
) -> Result<Json<AdminOk>> {
    require_admin(&user)?;
    write_value(
        &mongo,
        WEBHOOK_PROCESSING_KEY,
        Bson::Boolean(body.enabled),
        "settings.webhook.write",
    )
    .await?;
    Ok(Json(AdminOk::new()))
}

/// `GET /v1/admin/app-logo` — returns the override URL or `None` when unset.
pub async fn get_app_logo(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<AppLogoResponse>> {
    require_admin(&user)?;
    let value = read_value(&mongo, APP_LOGO_KEY, "settings.app_logo.read").await?;
    let url = match value {
        Some(Bson::String(s)) if !s.is_empty() => Some(s),
        _ => None,
    };
    Ok(Json(AppLogoResponse { url }))
}

/// `POST /v1/admin/app-logo` — `Some(url)` upserts, `None` clears.
pub async fn set_app_logo(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<AppLogoBody>,
) -> Result<Json<AdminOk>> {
    require_admin(&user)?;
    match body.url.as_deref().map(str::trim) {
        Some(url) if !url.is_empty() => {
            write_value(
                &mongo,
                APP_LOGO_KEY,
                Bson::String(url.to_owned()),
                "settings.app_logo.write",
            )
            .await?;
        }
        _ => {
            delete_key(&mongo, APP_LOGO_KEY, "settings.app_logo.delete").await?;
        }
    }
    Ok(Json(AdminOk::new()))
}

/// `GET /v1/admin/diwali-theme` — defaults to `false` if unset.
pub async fn get_diwali_theme(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<EnabledResponse>> {
    require_admin(&user)?;
    let value = read_value(&mongo, DIWALI_THEME_KEY, "settings.diwali.read").await?;
    let enabled = matches!(value, Some(Bson::Boolean(true)));
    Ok(Json(EnabledResponse { enabled }))
}

/// `POST /v1/admin/diwali-theme` — persist the flag.
pub async fn set_diwali_theme(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<EnabledBody>,
) -> Result<Json<AdminOk>> {
    require_admin(&user)?;
    write_value(
        &mongo,
        DIWALI_THEME_KEY,
        Bson::Boolean(body.enabled),
        "settings.diwali.write",
    )
    .await?;
    Ok(Json(AdminOk::new()))
}

/// Routes mounted under `/v1/admin` from [`crate::router`].
pub fn routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/webhook-processing",
            get(get_webhook_processing).post(set_webhook_processing),
        )
        .route("/app-logo", get(get_app_logo).post(set_app_logo))
        .route(
            "/diwali-theme",
            get(get_diwali_theme).post(set_diwali_theme),
        )
}
