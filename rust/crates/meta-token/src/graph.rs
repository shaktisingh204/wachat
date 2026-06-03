//! Meta Graph API token-management primitives.
//!
//! Thin async helpers built on a shared `reqwest::Client`. Every function
//! that touches a raw token logs only the masked variant via
//! `wachat_meta_auth::types::mask`.

use bson::{doc, oid::ObjectId};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tracing::debug;
use wachat_meta_auth::types::mask;
use wachat_types::Project;

/// Graph API version — keep in lockstep with the legacy TS
/// (`meta-token.actions.ts`, `const API_VERSION = 'v23.0'`).
pub const API_VERSION: &str = "v23.0";

const PROJECTS_COLL: &str = "projects";

fn graph_url(path: &str) -> String {
    let p = path.trim_start_matches('/');
    format!("https://graph.facebook.com/{API_VERSION}/{p}")
}

// =================================================================
//  TOKEN INSPECTION
// =================================================================

/// Mirrors the legacy `tokenInfo` shape — kept loose so future Meta fields
/// pass through verbatim. Field names match Meta's wire format (snake_case).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_id: Option<String>,
    #[serde(default, rename = "type", skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,
    #[serde(default)]
    pub is_valid: bool,
    #[serde(default)]
    pub expires_at: i64,
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DebugTokenEnvelope {
    data: Option<TokenInfo>,
}

/// `GET /debug_token?input_token=…&access_token={app_token}`.
pub async fn inspect_token(
    http: &reqwest::Client,
    app_token: &str,
    access_token: &str,
) -> Result<TokenInfo> {
    debug!(input = %mask(access_token), "meta-token: inspect_token");
    let url = graph_url("debug_token");
    let resp = http
        .get(&url)
        .query(&[("input_token", access_token), ("access_token", app_token)])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta debug_token {}: {body}",
            status.as_u16()
        )));
    }
    let env: DebugTokenEnvelope =
        serde_json::from_str(&body).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    env.data
        .ok_or_else(|| ApiError::BadRequest("debug_token response missing `data`".to_owned()))
}

/// Look up a project's stored access token, then introspect it. Returns
/// `None` when the project has no token recorded.
pub async fn inspect_project_token(
    mongo: &MongoHandle,
    http: &reqwest::Client,
    app_token: &str,
    project_id: &ObjectId,
) -> Result<Option<TokenInfo>> {
    let project = load_project(mongo, project_id).await?;
    let Some(token) = project.access_token.as_deref().filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    Ok(Some(inspect_token(http, app_token, token).await?))
}

/// Compact validity probe — used by the `is-valid` endpoint.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidityResult {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
}

/// List of granted permissions exactly as Meta returns them.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionEntry {
    pub permission: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
struct PermissionsEnvelope {
    #[serde(default)]
    data: Vec<PermissionEntry>,
}

// =================================================================
//  TOKEN EXCHANGE / REFRESH
// =================================================================

#[derive(Debug, Deserialize)]
struct OauthTokenResp {
    access_token: String,
    #[serde(default)]
    expires_in: Option<i64>,
}

/// `GET /oauth/access_token?grant_type=fb_exchange_token&...`.
pub async fn exchange_short_lived_token(
    http: &reqwest::Client,
    app_id: &str,
    app_secret: &str,
    short_lived: &str,
) -> Result<(String, Option<i64>)> {
    debug!(short = %mask(short_lived), "meta-token: exchanging short-lived token");
    let url = graph_url("oauth/access_token");
    let resp = http
        .get(&url)
        .query(&[
            ("grant_type", "fb_exchange_token"),
            ("client_id", app_id),
            ("client_secret", app_secret),
            ("fb_exchange_token", short_lived),
        ])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta oauth/access_token {}: {body}",
            status.as_u16()
        )));
    }
    let parsed: OauthTokenResp =
        serde_json::from_str(&body).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok((parsed.access_token, parsed.expires_in))
}

/// `client_credentials` grant — yields an app-level access token.
pub async fn fetch_app_access_token(
    http: &reqwest::Client,
    app_id: &str,
    app_secret: &str,
) -> Result<String> {
    let url = graph_url("oauth/access_token");
    let resp = http
        .get(&url)
        .query(&[
            ("client_id", app_id),
            ("client_secret", app_secret),
            ("grant_type", "client_credentials"),
        ])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta oauth/client_credentials {}: {body}",
            status.as_u16()
        )));
    }
    let parsed: OauthTokenResp =
        serde_json::from_str(&body).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(parsed.access_token)
}

/// Refresh a project's stored access token: exchanges the current token for
/// a long-lived one and writes it back to `projects.accessToken` along with
/// `tokenRefreshedAt`.
pub async fn refresh_project_token(
    mongo: &MongoHandle,
    http: &reqwest::Client,
    app_id: &str,
    app_secret: &str,
    project_id: &ObjectId,
) -> Result<Option<i64>> {
    let project = load_project(mongo, project_id).await?;
    let token = project
        .access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))?;

    let (long_lived, expires_in) =
        exchange_short_lived_token(http, app_id, app_secret, token).await?;

    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<bson::Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project.id },
            doc! { "$set": { "accessToken": &long_lived, "tokenRefreshedAt": now } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    debug!(
        project_id = %project_id,
        token = %mask(&long_lived),
        "meta-token: persisted refreshed token"
    );
    Ok(expires_in)
}

// =================================================================
//  PAGE TOKEN
// =================================================================

#[derive(Debug, Deserialize)]
struct PageTokenResp {
    access_token: String,
}

/// `GET /{page-id}?fields=access_token&access_token={user-token}`.
pub async fn get_page_token_from_user_token(
    http: &reqwest::Client,
    user_token: &str,
    page_id: &str,
) -> Result<String> {
    let url = graph_url(page_id);
    let resp = http
        .get(&url)
        .query(&[("fields", "access_token"), ("access_token", user_token)])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta page-token {}: {body}",
            status.as_u16()
        )));
    }
    let parsed: PageTokenResp =
        serde_json::from_str(&body).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(parsed.access_token)
}

// =================================================================
//  PERMISSIONS
// =================================================================

pub async fn list_granted_permissions(
    http: &reqwest::Client,
    access_token: &str,
) -> Result<Vec<PermissionEntry>> {
    let url = graph_url("me/permissions");
    let resp = http
        .get(&url)
        .query(&[("access_token", access_token)])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta me/permissions {}: {body}",
            status.as_u16()
        )));
    }
    let parsed: PermissionsEnvelope =
        serde_json::from_str(&body).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(parsed.data)
}

pub async fn list_project_permissions(
    mongo: &MongoHandle,
    http: &reqwest::Client,
    project_id: &ObjectId,
) -> Result<Vec<PermissionEntry>> {
    let project = load_project(mongo, project_id).await?;
    let token = project
        .access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))?;
    list_granted_permissions(http, token).await
}

// =================================================================
//  USAGE / RATE LIMIT
// =================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageStatus {
    pub app: Option<Value>,
    pub business: Option<Value>,
}

pub async fn fetch_api_usage(
    mongo: &MongoHandle,
    http: &reqwest::Client,
    project_id: &ObjectId,
) -> Result<UsageStatus> {
    let project = load_project(mongo, project_id).await?;
    let token = project
        .access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))?;
    let url = graph_url("me");
    let resp = http
        .get(&url)
        .query(&[("fields", "id"), ("access_token", token)])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let app_usage = resp
        .headers()
        .get("x-app-usage")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| serde_json::from_str::<Value>(s).ok());
    let business_usage = resp
        .headers()
        .get("x-business-use-case-usage")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| serde_json::from_str::<Value>(s).ok());
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta me {}: {body}",
            status.as_u16()
        )));
    }
    Ok(UsageStatus {
        app: app_usage,
        business: business_usage,
    })
}

// =================================================================
//  BATCH
// =================================================================

/// Single sub-request inside a Meta batch envelope.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BatchRequest {
    pub method: String,
    pub relative_url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
}

pub async fn batch_graph_requests(
    mongo: &MongoHandle,
    http: &reqwest::Client,
    project_id: &ObjectId,
    requests: Vec<BatchRequest>,
) -> Result<Value> {
    if requests.len() > 50 {
        return Err(ApiError::BadRequest(
            "Batch API supports a maximum of 50 requests per call.".to_owned(),
        ));
    }
    let project = load_project(mongo, project_id).await?;
    let token = project
        .access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::Forbidden("Access denied.".to_owned()))?;

    // Meta wants `batch` as a JSON-serialized **string**, not a JSON array.
    let batch_str =
        serde_json::to_string(&requests).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let url = graph_url("");
    let resp = http
        .post(url.trim_end_matches('/'))
        .json(&json!({ "access_token": token, "batch": batch_str }))
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta batch {}: {body}",
            status.as_u16()
        )));
    }
    serde_json::from_str(&body).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))
}

// =================================================================
//  USER IDENTITY / ACCOUNTS / BUSINESSES
// =================================================================

pub async fn fetch_me(http: &reqwest::Client, access_token: &str) -> Result<Value> {
    let url = graph_url("me");
    let resp = http
        .get(&url)
        .query(&[
            ("fields", "id,name,email,picture"),
            ("access_token", access_token),
        ])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta me {}: {body}",
            status.as_u16()
        )));
    }
    serde_json::from_str(&body).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))
}

#[derive(Debug, Deserialize)]
struct DataEnvelope {
    #[serde(default)]
    data: Vec<Value>,
}

pub async fn fetch_me_accounts(http: &reqwest::Client, access_token: &str) -> Result<Vec<Value>> {
    let url = graph_url("me/accounts");
    let resp = http
        .get(&url)
        .query(&[
            ("fields", "id,name,access_token,category,tasks,picture{url}"),
            ("access_token", access_token),
            ("limit", "100"),
        ])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta me/accounts {}: {body}",
            status.as_u16()
        )));
    }
    let env: DataEnvelope =
        serde_json::from_str(&body).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(env.data)
}

pub async fn fetch_me_businesses(http: &reqwest::Client, access_token: &str) -> Result<Vec<Value>> {
    let url = graph_url("me/businesses");
    let resp = http
        .get(&url)
        .query(&[
            ("fields", "id,name,link,created_time,verification_status"),
            ("access_token", access_token),
        ])
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "meta me/businesses {}: {body}",
            status.as_u16()
        )));
    }
    let env: DataEnvelope =
        serde_json::from_str(&body).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(env.data)
}

// =================================================================
//  internals
// =================================================================

pub(crate) async fn load_project(mongo: &MongoHandle, project_id: &ObjectId) -> Result<Project> {
    mongo
        .collection::<Project>(PROJECTS_COLL)
        .find_one(doc! { "_id": project_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {}", project_id.to_hex())))
}
