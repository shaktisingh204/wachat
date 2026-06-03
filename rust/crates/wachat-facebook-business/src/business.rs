//! Business Manager Graph API forwarders.
//!
//! Mirrors the **BUSINESS MANAGER UTILITIES** block of
//! `src/app/actions/facebook.actions.ts` (lines ~2792–2952).
//!
//! Each function delegates to `wachat_meta_client::MetaClient` and surfaces
//! the raw `data` array (or single object for `getBusinessDetails`) verbatim
//! so the TS callers — which `JSON.parse(JSON.stringify(...))` Meta's
//! response — keep working unchanged.

use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

/// Pull the project's access token, returning the same `Access denied`
/// envelope the legacy server actions emitted when it's missing.
fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .filter(|t| !t.is_empty())
        .ok_or_else(|| {
            ApiError::BadRequest("Project not found or business ID not linked.".to_owned())
        })
}

/// Pull the project's `businessId`, returning the legacy error message
/// when the column is missing.
fn business_id_for(project: &Project) -> Result<&str> {
    project
        .business_id
        .as_deref()
        .filter(|t| !t.is_empty())
        .ok_or_else(|| {
            ApiError::BadRequest("Project not found or business ID not linked.".to_owned())
        })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BusinessResp {
    pub business: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PagesResp {
    pub pages: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdAccountsResp {
    pub ad_accounts: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstagramAccountsResp {
    pub accounts: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemUsersResp {
    pub system_users: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsersResp {
    pub users: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingUsersResp {
    pub pending_users: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AckResp {
    pub success: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteBody {
    pub email: String,
    /// One of `ADMIN | EMPLOYEE | FINANCE_EDITOR | FINANCE_ANALYST`.
    pub role: String,
}

/// Forwarded Graph `data: [...]` envelope.
#[derive(Debug, Deserialize)]
struct DataEnvelope {
    #[serde(default)]
    data: Vec<Value>,
}

/// `getBusinessDetails` — `GET /{businessId}?fields=…`.
pub async fn get_business_details(meta: &MetaClient, project: &Project) -> Result<BusinessResp> {
    let token = token_for(project)?;
    let business_id = business_id_for(project)?;
    let path = format!(
        "{business_id}?fields=id,name,primary_page,link,created_time,timezone_id,verification_status,profile_picture_uri"
    );
    let business: Value = meta.get_json(&path, token).await?;
    Ok(BusinessResp { business })
}

/// `getBusinessOwnedPages` — `GET /{businessId}/owned_pages?fields=…&limit=100`.
pub async fn get_business_owned_pages(meta: &MetaClient, project: &Project) -> Result<PagesResp> {
    let token = token_for(project)?;
    let business_id = business_id_for(project)?;
    let path = format!(
        "{business_id}/owned_pages?fields=id,name,category,picture%7Burl%7D,fan_count,link&limit=100"
    );
    let env: DataEnvelope = meta.get_json(&path, token).await?;
    Ok(PagesResp { pages: env.data })
}

/// `getBusinessOwnedAdAccounts` — `GET /{businessId}/owned_ad_accounts`.
pub async fn get_business_owned_ad_accounts(
    meta: &MetaClient,
    project: &Project,
) -> Result<AdAccountsResp> {
    let token = token_for(project)?;
    let business_id = business_id_for(project)?;
    let path = format!(
        "{business_id}/owned_ad_accounts?fields=id,name,account_id,account_status,currency,amount_spent,balance&limit=100"
    );
    let env: DataEnvelope = meta.get_json(&path, token).await?;
    Ok(AdAccountsResp {
        ad_accounts: env.data,
    })
}

/// `getBusinessOwnedInstagramAccounts` —
/// `GET /{businessId}/owned_instagram_accounts`.
pub async fn get_business_owned_instagram_accounts(
    meta: &MetaClient,
    project: &Project,
) -> Result<InstagramAccountsResp> {
    let token = token_for(project)?;
    let business_id = business_id_for(project)?;
    let path = format!(
        "{business_id}/owned_instagram_accounts?fields=id,username,profile_picture_url,followers_count&limit=100"
    );
    let env: DataEnvelope = meta.get_json(&path, token).await?;
    Ok(InstagramAccountsResp { accounts: env.data })
}

/// `getBusinessSystemUsers` — `GET /{businessId}/system_users`.
pub async fn get_business_system_users(
    meta: &MetaClient,
    project: &Project,
) -> Result<SystemUsersResp> {
    let token = token_for(project)?;
    let business_id = business_id_for(project)?;
    let path = format!("{business_id}/system_users?fields=id,name,role,created_by");
    let env: DataEnvelope = meta.get_json(&path, token).await?;
    Ok(SystemUsersResp {
        system_users: env.data,
    })
}

/// `getBusinessUsers` — `GET /{businessId}/business_users`.
pub async fn get_business_users(meta: &MetaClient, project: &Project) -> Result<UsersResp> {
    let token = token_for(project)?;
    let business_id = business_id_for(project)?;
    let path =
        format!("{business_id}/business_users?fields=id,name,email,role,created_time&limit=100");
    let env: DataEnvelope = meta.get_json(&path, token).await?;
    Ok(UsersResp { users: env.data })
}

/// `getBusinessPendingUsers` — `GET /{businessId}/pending_users`.
pub async fn get_business_pending_users(
    meta: &MetaClient,
    project: &Project,
) -> Result<PendingUsersResp> {
    let token = token_for(project)?;
    let business_id = business_id_for(project)?;
    let path = format!("{business_id}/pending_users?fields=id,email,role,status,created_time");
    let env: DataEnvelope = meta.get_json(&path, token).await?;
    Ok(PendingUsersResp {
        pending_users: env.data,
    })
}

/// `inviteBusinessUser` — `POST /{businessId}/business_users` with an
/// `email` + `role` payload. The legacy action constrained `role` to a
/// fixed enum at the TypeScript layer; we forward whatever the client
/// supplied since Meta validates it server-side and surfaces a clear
/// error if the value is wrong.
pub async fn invite_business_user(
    meta: &MetaClient,
    project: &Project,
    body: InviteBody,
) -> Result<AckResp> {
    let token = token_for(project)?;
    let business_id = business_id_for(project)?;
    let payload = json!({
        "email": body.email,
        "role": body.role,
    });
    let path = format!("{business_id}/business_users");
    let _: Value = meta.post_json(&path, token, &payload).await?;
    Ok(AckResp { success: true })
}
