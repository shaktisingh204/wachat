//! HTTP handlers for the admin API-key surface.
//!
//! Each handler maps to one server action in
//! `src/app/actions/api-keys.actions.ts`. Auth is enforced by the
//! [`AuthUser`] extractor — the JWT subject is the only tenancy gate, so
//! callers can never see or revoke another user's keys.
//!
//! Errors map to the workspace-wide `ApiError` envelope. Validation
//! failures (empty name, malformed key id) are `BadRequest`; missing
//! resources (revoking a key that doesn't exist or belongs to someone
//! else) are reported via the `success: false` branch of the response
//! envelope to match the legacy server-action contract.

use axum::{
    Json,
    extract::{Path, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::Result;
use sabnode_db::mongo::MongoHandle;

use crate::{
    dto::{ApiKeySummary, GenerateBody, GenerateResult, ListResult, RevokeResult},
    store,
};

/// `POST /v1/api-keys` — generate a new key for the authenticated user.
///
/// Returns the plaintext exactly once. The hash is stored under `key`
/// in the `api_keys` collection so
/// [`wachat_public_api::ApiKeyVerifier`] can authenticate inbound
/// requests against the new key without any extra wiring.
pub async fn generate_api_key(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<GenerateBody>,
) -> Result<Json<GenerateResult>> {
    let created = store::create(&mongo, &user.user_id, &body.name, body.scopes, body.tier).await?;
    Ok(Json(GenerateResult {
        success: true,
        api_key: Some(created.plaintext),
        key_id: Some(created.id.to_hex()),
        error: None,
    }))
}

/// `GET /v1/api-keys` — list metadata for keys owned by the
/// authenticated user. Hash and plaintext are NEVER on the wire.
///
/// Sorted by `createdAt` desc to match the dashboard's existing UI.
pub async fn list_api_keys(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<ListResult>> {
    let summaries: Vec<ApiKeySummary> = store::list(&mongo, &user.user_id).await?;
    Ok(Json(summaries))
}

/// `PATCH /v1/api-keys/:key_id/revoke` — soft-delete a key.
///
/// Sets `revoked: true` so the public-API verifier rejects subsequent
/// auth attempts (its query filters on `revoked: { $ne: true }`). Returns
/// the legacy envelope `{ success, error? }`; an unknown / cross-user id
/// resolves to `success: false` to avoid leaking existence.
pub async fn revoke_api_key(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(key_id): Path<String>,
) -> Result<Json<RevokeResult>> {
    let revoked = store::revoke(&mongo, &user.user_id, &key_id).await?;
    if revoked {
        Ok(Json(RevokeResult {
            success: true,
            error: None,
        }))
    } else {
        Ok(Json(RevokeResult {
            success: false,
            error: Some("API key not found or you do not have permission.".to_owned()),
        }))
    }
}
