//! Axum router for `/v1/meta/token/*` endpoints (caller nests the prefix).
//!
//! Project-scoped routes load the project, then enforce
//! `user.tenant_id == project.user_id` exactly like
//! `wachat_config::router::load_project_for`.

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
use serde::{Deserialize, Serialize};
use serde_json::Value;
use wachat_types::Project;

use crate::{graph, state::MetaTokenState};

const PROJECTS_COLL: &str = "projects";

/// Tenant gate for project-scoped routes — mirrors the helper in
/// `wachat-config/src/router.rs`.
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

fn require_app_creds(s: &MetaTokenState) -> Result<()> {
    if !s.app_creds_configured() {
        return Err(ApiError::BadRequest(
            "Server credentials not configured.".to_owned(),
        ));
    }
    Ok(())
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MetaTokenState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/inspect", post(inspect))
        .route("/projects/{id}/inspect", get(inspect_project))
        .route("/projects/{id}/is-valid", get(is_valid))
        .route("/projects/{id}/scopes", get(scopes))
        .route("/exchange-short-lived", post(exchange_short_lived))
        .route("/projects/{id}/refresh", post(refresh_project))
        .route("/page-token", post(page_token))
        .route("/app-access-token", get(app_access_token))
        .route("/permissions", post(permissions))
        .route("/projects/{id}/permissions", get(project_permissions))
        .route("/projects/{id}/permissions/{perm}", get(check_permission))
        .route("/projects/{id}/usage", get(api_usage))
        .route("/projects/{id}/batch", post(batch))
        .route("/me", post(me))
        .route("/me/accounts", post(me_accounts))
        .route("/me/businesses", post(me_businesses))
}

// ---------------------------------------------------------------------------
// Request / response DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccessTokenBody {
    access_token: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShortLivedBody {
    short_lived_token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExchangeResp {
    long_lived_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    expires_in: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageTokenBody {
    user_token: String,
    page_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PageTokenResp {
    page_token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppTokenResp {
    app_token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PermissionsResp {
    permissions: Vec<graph::PermissionEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GrantedResp {
    granted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UsageResp {
    usage: graph::UsageStatus,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchBody {
    requests: Vec<graph::BatchRequest>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BatchResp {
    responses: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserResp {
    user: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountsResp {
    accounts: Vec<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BusinessesResp {
    businesses: Vec<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScopesResp {
    scopes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InspectResp {
    token_info: graph::TokenInfo,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RefreshResp {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    expires_in: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct OptionalAccessTokenQuery {
    #[allow(dead_code)]
    access_token: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn inspect(
    _user: AuthUser,
    State(s): State<MetaTokenState>,
    Json(body): Json<AccessTokenBody>,
) -> Result<Json<InspectResp>> {
    require_app_creds(&s)?;
    let info = graph::inspect_token(&s.http, &s.app_token(), &body.access_token).await?;
    Ok(Json(InspectResp { token_info: info }))
}

async fn inspect_project(
    user: AuthUser,
    State(s): State<MetaTokenState>,
    Path(id): Path<String>,
) -> Result<Json<InspectResp>> {
    require_app_creds(&s)?;
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let token = p
        .access_token
        .as_deref()
        .filter(|t| !t.is_empty())
        .ok_or_else(|| ApiError::BadRequest("Project not found or token missing.".to_owned()))?;
    let info = graph::inspect_token(&s.http, &s.app_token(), token).await?;
    Ok(Json(InspectResp { token_info: info }))
}

async fn is_valid(
    user: AuthUser,
    State(s): State<MetaTokenState>,
    Path(id): Path<String>,
) -> Result<Json<graph::ValidityResult>> {
    require_app_creds(&s)?;
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let token = match p.access_token.as_deref().filter(|t| !t.is_empty()) {
        Some(t) => t,
        None => {
            return Ok(Json(graph::ValidityResult {
                valid: false,
                expires_at: None,
            }));
        }
    };
    let info = graph::inspect_token(&s.http, &s.app_token(), token).await?;
    Ok(Json(graph::ValidityResult {
        valid: info.is_valid,
        expires_at: if info.expires_at > 0 {
            Some(info.expires_at)
        } else {
            None
        },
    }))
}

async fn scopes(
    user: AuthUser,
    State(s): State<MetaTokenState>,
    Path(id): Path<String>,
) -> Result<Json<ScopesResp>> {
    require_app_creds(&s)?;
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let Some(token) = p.access_token.as_deref().filter(|t| !t.is_empty()) else {
        return Ok(Json(ScopesResp { scopes: Vec::new() }));
    };
    let info = graph::inspect_token(&s.http, &s.app_token(), token).await?;
    Ok(Json(ScopesResp {
        scopes: info.scopes,
    }))
}

async fn exchange_short_lived(
    _user: AuthUser,
    State(s): State<MetaTokenState>,
    Json(body): Json<ShortLivedBody>,
) -> Result<Json<ExchangeResp>> {
    require_app_creds(&s)?;
    let (long_lived, expires_in) = graph::exchange_short_lived_token(
        &s.http,
        &s.app_id,
        &s.app_secret,
        &body.short_lived_token,
    )
    .await?;
    Ok(Json(ExchangeResp {
        long_lived_token: long_lived,
        expires_in,
    }))
}

async fn refresh_project(
    user: AuthUser,
    State(s): State<MetaTokenState>,
    Path(id): Path<String>,
) -> Result<Json<RefreshResp>> {
    require_app_creds(&s)?;
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let expires_in =
        graph::refresh_project_token(&s.mongo, &s.http, &s.app_id, &s.app_secret, &p.id).await?;
    Ok(Json(RefreshResp {
        success: true,
        expires_in,
    }))
}

async fn page_token(
    _user: AuthUser,
    State(s): State<MetaTokenState>,
    Json(body): Json<PageTokenBody>,
) -> Result<Json<PageTokenResp>> {
    let token =
        graph::get_page_token_from_user_token(&s.http, &body.user_token, &body.page_id).await?;
    Ok(Json(PageTokenResp { page_token: token }))
}

async fn app_access_token(
    _user: AuthUser,
    State(s): State<MetaTokenState>,
) -> Result<Json<AppTokenResp>> {
    require_app_creds(&s)?;
    let token = graph::fetch_app_access_token(&s.http, &s.app_id, &s.app_secret).await?;
    Ok(Json(AppTokenResp { app_token: token }))
}

async fn permissions(
    _user: AuthUser,
    State(s): State<MetaTokenState>,
    Json(body): Json<AccessTokenBody>,
) -> Result<Json<PermissionsResp>> {
    let perms = graph::list_granted_permissions(&s.http, &body.access_token).await?;
    Ok(Json(PermissionsResp { permissions: perms }))
}

async fn project_permissions(
    user: AuthUser,
    State(s): State<MetaTokenState>,
    Path(id): Path<String>,
) -> Result<Json<PermissionsResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let perms = graph::list_project_permissions(&s.mongo, &s.http, &p.id).await?;
    Ok(Json(PermissionsResp { permissions: perms }))
}

async fn check_permission(
    user: AuthUser,
    State(s): State<MetaTokenState>,
    Path((id, perm)): Path<(String, String)>,
) -> Result<Json<GrantedResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let perms = graph::list_project_permissions(&s.mongo, &s.http, &p.id).await?;
    let granted = perms
        .iter()
        .any(|e| e.permission == perm && e.status == "granted");
    Ok(Json(GrantedResp { granted }))
}

async fn api_usage(
    user: AuthUser,
    State(s): State<MetaTokenState>,
    Path(id): Path<String>,
    Query(_q): Query<OptionalAccessTokenQuery>,
) -> Result<Json<UsageResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let usage = graph::fetch_api_usage(&s.mongo, &s.http, &p.id).await?;
    Ok(Json(UsageResp { usage }))
}

async fn batch(
    user: AuthUser,
    State(s): State<MetaTokenState>,
    Path(id): Path<String>,
    Json(body): Json<BatchBody>,
) -> Result<Json<BatchResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let resp = graph::batch_graph_requests(&s.mongo, &s.http, &p.id, body.requests).await?;
    Ok(Json(BatchResp { responses: resp }))
}

async fn me(
    _user: AuthUser,
    State(s): State<MetaTokenState>,
    Json(body): Json<AccessTokenBody>,
) -> Result<Json<UserResp>> {
    let user = graph::fetch_me(&s.http, &body.access_token).await?;
    Ok(Json(UserResp { user }))
}

async fn me_accounts(
    _user: AuthUser,
    State(s): State<MetaTokenState>,
    Json(body): Json<AccessTokenBody>,
) -> Result<Json<AccountsResp>> {
    let accounts = graph::fetch_me_accounts(&s.http, &body.access_token).await?;
    Ok(Json(AccountsResp { accounts }))
}

async fn me_businesses(
    _user: AuthUser,
    State(s): State<MetaTokenState>,
    Json(body): Json<AccessTokenBody>,
) -> Result<Json<BusinessesResp>> {
    let businesses = graph::fetch_me_businesses(&s.http, &body.access_token).await?;
    Ok(Json(BusinessesResp { businesses }))
}
