//! Axum router mounting all 16 wachat-config endpoints under
//! `/v1/wachat/config` (caller nests the prefix).

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, Query, State},
    routing::{get, post},
};
use bson::doc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde::Deserialize;
use serde_json::Value;
use wachat_types::Project;

use crate::{
    display_name, phone, project, qr, register, state::WachatConfigState, waba_setup, webhook,
    widget,
};

const PROJECTS_COLL: &str = "projects";

async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Project> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;
    if user.tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden("not your project".to_owned()));
    }
    Ok(project)
}

#[derive(Deserialize)]
struct WabaQuery {
    waba_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccessTokenQuery {
    access_token: String,
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatConfigState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/projects/{id}/public", get(get_public))
        .route("/projects/manual-setup", post(manual_setup))
        .route("/projects/by-waba/{waba_id}", get(get_project_by_waba))
        .route(
            "/projects/{id}/phone-numbers/sync",
            post(sync_phone_numbers),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/profile",
            post(update_phone_profile),
        )
        // Display-name change (deferred Graph feature). Literal suffixes
        // (`display-name`, `display-name/status`) after the `{pnid}` param
        // keep these unambiguous against the sibling phone-number routes.
        .route(
            "/projects/{id}/phone-numbers/{pnid}/display-name",
            post(request_display_name),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/display-name/status",
            get(display_name_status),
        )
        // WhatsApp Flows encryption-key management (deferred Graph feature).
        .route(
            "/projects/{id}/phone-numbers/{pnid}/flows-encryption/generate",
            post(generate_flows_keys),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/flows-encryption/upload",
            post(upload_flows_key),
        )
        .route(
            "/projects/{id}/webhook-subscription",
            get(get_webhook_subscription),
        )
        .route("/webhooks/subscribe-all", post(subscribe_all_webhooks))
        .route("/projects/{id}/webhooks/subscribe", post(subscribe_webhook))
        .route(
            "/projects/{id}/phone-numbers/{pnid}/register",
            post(register_phone),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/request-verification-code",
            post(request_verification_code),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/verify-code",
            post(verify_code),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/deregister",
            post(deregister_phone),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/two-step-pin",
            post(set_two_step_pin),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/qr-codes",
            get(list_qr_codes).post(create_qr_code),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/qr-codes/{code}",
            post(update_qr_code).delete(delete_qr_code),
        )
        .route("/projects/{id}/widget-settings", post(save_widget_settings))
        // WABA setup proxies — pre-project Meta calls used by the
        // legacy `_createProjectFromWaba` helper and the project-rename
        // flow. The accessToken is taken from the query string because
        // these are called *before* the project doc exists in Mongo (so
        // there is nothing on disk to read it from).
        .route("/me/businesses", get(get_me_businesses))
        .route("/waba/{waba_id}/details", get(get_waba_details))
        .route("/waba/{waba_id}/name", post(update_waba_name))
}

async fn get_public(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let pp = project::get_public(&s.mongo, &p.id).await?;
    Ok(Json(serde_json::to_value(pp).unwrap_or(Value::Null)))
}

async fn manual_setup(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Json(body): Json<project::ManualSetupBody>,
) -> Result<Json<Value>> {
    let user_oid = oid_from_str(&user.user_id)?;
    let p = project::manual_setup(&s.mongo, &user_oid, body).await?;
    Ok(Json(serde_json::to_value(p).unwrap_or(Value::Null)))
}

/// `GET /projects/by-waba/{waba_id}` — look up the caller's project for a
/// given WABA id. Replaces the residual `db.collection('projects')
/// .findOne({ wabaId })` lookups in the legacy
/// `getWebhookSubscriptionStatus` and `handleSubscribeProjectWebhook`
/// server actions: those need the projectId to call the existing
/// project-scoped webhook routes.
async fn get_project_by_waba(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path(waba_id): Path<String>,
) -> Result<Json<project::ProjectByWabaResponse>> {
    let user_oid = oid_from_str(&user.user_id)?;
    let lookup = project::find_id_by_waba(&s.mongo, &user_oid, &waba_id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("project for waba {waba_id}")))?;
    Ok(Json(lookup))
}

async fn sync_phone_numbers(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path(id): Path<String>,
) -> Result<Json<phone::SyncOutcome>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let out = phone::sync_numbers(&s.mongo, &s.meta, &p).await?;
    Ok(Json(out))
}

async fn update_phone_profile(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
    Json(body): Json<phone::UpdateProfileBody>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    phone::update_profile(&s.meta, &p, &pnid, body).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

// ---------------------------------------------------------------------------
// Display-name change + Flows encryption keys (deferred Graph features).
// All Meta Graph / RSA work is isolated in `crate::display_name` +
// `crate::flows_crypto`; handlers stay thin and project-scoped via
// `load_project_for` (multi-tenant guard, identical to the rest of the crate).
// ---------------------------------------------------------------------------

#[tracing::instrument(skip_all)]
async fn request_display_name(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
    Json(body): Json<display_name::DisplayNameBody>,
) -> Result<Json<display_name::DisplayNameOutcome>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let out = display_name::request_change(&s.mongo, &s.meta, &p, &pnid, body).await?;
    Ok(Json(out))
}

#[tracing::instrument(skip_all)]
async fn display_name_status(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
) -> Result<Json<display_name::DisplayNameStatus>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let out = display_name::status(&s.meta, &p, &pnid).await?;
    Ok(Json(out))
}

#[tracing::instrument(skip_all)]
async fn generate_flows_keys(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
) -> Result<Json<display_name::GenerateKeysOutcome>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let out = display_name::generate_keys(&s.mongo, &p, &pnid).await?;
    Ok(Json(out))
}

#[tracing::instrument(skip_all)]
async fn upload_flows_key(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
) -> Result<Json<display_name::UploadKeyOutcome>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let out = display_name::upload_public_key(&s.mongo, &s.meta, &p, &pnid).await?;
    Ok(Json(out))
}

async fn get_webhook_subscription(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path(id): Path<String>,
    Query(q): Query<WabaQuery>,
) -> Result<Json<webhook::SubscriptionStatus>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let token = p.access_token.as_deref().unwrap_or("");
    let st = webhook::status(&s.meta, &q.waba_id, token).await?;
    Ok(Json(st))
}

async fn subscribe_all_webhooks(
    _user: AuthUser,
    State(s): State<WachatConfigState>,
) -> Result<Json<webhook::SubscribeAllOutcome>> {
    let out = webhook::subscribe_all(&s.mongo, &s.meta).await?;
    Ok(Json(out))
}

async fn subscribe_webhook(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path(id): Path<String>,
    Json(body): Json<webhook::SubscribeBody>,
) -> Result<Json<webhook::SubscriptionStatus>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let waba = p
        .waba_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing wabaId".to_owned()))?;
    webhook::subscribe_one(&s.meta, waba, &body.user_access_token).await?;
    Ok(Json(webhook::SubscriptionStatus { is_active: true }))
}

async fn register_phone(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
    Json(body): Json<register::PinBody>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    register::register(&s.meta, &p, &pnid, body).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn request_verification_code(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
    Json(body): Json<register::VerifReqBody>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    register::request_verification_code(&s.meta, &p, &pnid, body).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn verify_code(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
    Json(body): Json<register::CodeBody>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    register::verify_code(&s.meta, &p, &pnid, body).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn deregister_phone(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    register::deregister(&s.meta, &p, &pnid).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn set_two_step_pin(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
    Json(body): Json<register::PinBody>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    register::set_two_step_pin(&s.meta, &p, &pnid, body).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn list_qr_codes(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
) -> Result<Json<qr::QrList>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(qr::list(&s.meta, &p, &pnid).await?))
}

async fn create_qr_code(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid)): Path<(String, String)>,
    Json(body): Json<qr::CreateQrBody>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(qr::create(&s.meta, &p, &pnid, body).await?))
}

async fn update_qr_code(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid, code)): Path<(String, String, String)>,
    Json(body): Json<qr::UpdateQrBody>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(qr::update(&s.meta, &p, &pnid, &code, body).await?))
}

async fn delete_qr_code(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path((id, pnid, code)): Path<(String, String, String)>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    qr::delete(&s.meta, &p, &pnid, &code).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn save_widget_settings(
    user: AuthUser,
    State(s): State<WachatConfigState>,
    Path(id): Path<String>,
    Json(body): Json<widget::WidgetSettings>,
) -> Result<Json<Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    widget::save(&s.mongo, &p.id, &body).await?;
    Ok(Json(serde_json::json!({"success": true})))
}

// ---------------------------------------------------------------------------
// WABA setup proxies — thin auth-gated wrappers around three Meta calls.
// `AuthUser` is required so anonymous callers can't use the BFF as an open
// proxy, but the access token comes from the request (query/body) because
// the project doc may not exist yet.
// ---------------------------------------------------------------------------

async fn get_me_businesses(
    _user: AuthUser,
    State(s): State<WachatConfigState>,
    Query(q): Query<AccessTokenQuery>,
) -> Result<Json<waba_setup::BusinessesResponse>> {
    let resp = waba_setup::get_me_businesses(&s.meta, &q.access_token).await?;
    Ok(Json(resp))
}

async fn get_waba_details(
    _user: AuthUser,
    State(s): State<WachatConfigState>,
    Path(waba_id): Path<String>,
    Query(q): Query<AccessTokenQuery>,
) -> Result<Json<waba_setup::WabaDetails>> {
    let resp = waba_setup::get_waba_details(&s.meta, &waba_id, &q.access_token).await?;
    Ok(Json(resp))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateWabaNameRequest {
    access_token: String,
    name: String,
}

async fn update_waba_name(
    _user: AuthUser,
    State(s): State<WachatConfigState>,
    Path(waba_id): Path<String>,
    Json(body): Json<UpdateWabaNameRequest>,
) -> Result<Json<Value>> {
    let resp =
        waba_setup::update_waba_name(&s.meta, &waba_id, &body.access_token, &body.name).await?;
    Ok(Json(resp))
}
