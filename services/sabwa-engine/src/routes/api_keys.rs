//! `/api-keys` — management endpoints for end-user API keys.
//!
//! These routes are mounted under the `require_service_token` umbrella in
//! [`crate::routes::router`]: only the Next.js layer (acting on behalf of an
//! authenticated dashboard user) ever calls them. The raw key value is
//! returned **exactly once** at creation time — afterwards we only persist
//! its SHA-256 hash and a short display prefix.
//!
//! Endpoints:
//! - `GET    /api-keys?projectId=...` — list keys for a project.
//! - `POST   /api-keys`               — generate a new key.
//! - `DELETE /api-keys/:id`           — soft-revoke (preserves audit trail).

use axum::{
    extract::{Path, Query, State},
    routing::{delete, get},
    Json, Router,
};
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};

use crate::auth::sha256_hex;
use crate::db::misc::{ApiKeysRepo, SabwaApiKey};
use crate::error::AppError;
use crate::state::AppState;

/// Build the `/api-keys` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_keys).post(create_key))
        .route("/:id", delete(revoke_key))
}

// ---------- DTOs ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListKeysQuery {
    pub project_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeySummary {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub prefix: String,
    pub scopes: Vec<String>,
    pub revoked: bool,
    pub usage_count: u64,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListKeysResponse {
    pub keys: Vec<ApiKeySummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKeyRequest {
    pub project_id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default)]
    pub expires_at: Option<DateTime<Utc>>,
}

/// Returned ONCE at creation. Subsequent reads only ever expose `prefix`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKeyResponse {
    pub id: String,
    /// Raw key — store immediately, never retrievable again.
    pub key: String,
    pub prefix: String,
    pub scopes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeKeyResponse {
    pub id: String,
    pub revoked: bool,
}

// ---------- Handlers ----------

async fn list_keys(
    State(state): State<AppState>,
    Query(q): Query<ListKeysQuery>,
) -> Result<Json<ListKeysResponse>, AppError> {
    let project_id = ObjectId::parse_str(&q.project_id)
        .map_err(|_| AppError::BadRequest("invalid projectId".into()))?;

    let repo = ApiKeysRepo::new(&state.db);
    let rows = repo
        .list_by_project(&project_id)
        .await
        .map_err(AppError::Internal)?;

    let keys = rows.into_iter().map(api_key_to_summary).collect();
    Ok(Json(ListKeysResponse { keys }))
}

async fn create_key(
    State(state): State<AppState>,
    Json(body): Json<CreateKeyRequest>,
) -> Result<Json<CreateKeyResponse>, AppError> {
    let project_id = ObjectId::parse_str(&body.project_id)
        .map_err(|_| AppError::BadRequest("invalid projectId".into()))?;

    let raw_key = generate_api_key();
    // Prefix length intentionally matches the spec: 6 chars total (e.g. "sk_AB").
    let prefix: String = raw_key.chars().take(6).collect();
    let key_hash = sha256_hex(raw_key.as_bytes());

    let now = Utc::now();
    let doc = SabwaApiKey {
        id: None,
        project_id,
        session_id: None,
        name: body.name.unwrap_or_default(),
        key_hash,
        prefix: prefix.clone(),
        scopes: body.scopes.clone(),
        revoked: false,
        last_used_at: None,
        usage_count: 0,
        expires_at: body.expires_at,
        created_at: now,
    };

    let repo = ApiKeysRepo::new(&state.db);
    let id = repo.create(&doc).await.map_err(AppError::Internal)?;

    tracing::info!(
        target: "sabwa_engine::api_keys",
        project_id = %project_id,
        key_id = %id,
        prefix = %prefix,
        "api_key created"
    );

    Ok(Json(CreateKeyResponse {
        id: id.to_hex(),
        key: raw_key,
        prefix,
        scopes: body.scopes,
    }))
}

async fn revoke_key(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<RevokeKeyResponse>, AppError> {
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("invalid id".into()))?;

    let repo = ApiKeysRepo::new(&state.db);
    repo.revoke(&oid).await.map_err(AppError::Internal)?;

    Ok(Json(RevokeKeyResponse {
        id,
        revoked: true,
    }))
}

// ---------- Helpers ----------

/// `sk_live_<32 alphanumeric chars>` — 40 chars total.
fn generate_api_key() -> String {
    const ALPHABET: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    let suffix: String = (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..ALPHABET.len());
            ALPHABET[idx] as char
        })
        .collect();
    format!("sk_live_{suffix}")
}

fn api_key_to_summary(k: SabwaApiKey) -> ApiKeySummary {
    ApiKeySummary {
        id: k.id.map(|o| o.to_hex()).unwrap_or_default(),
        project_id: k.project_id.to_hex(),
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes,
        revoked: k.revoked,
        usage_count: k.usage_count,
        last_used_at: k.last_used_at,
        expires_at: k.expires_at,
        created_at: k.created_at,
    }
}
