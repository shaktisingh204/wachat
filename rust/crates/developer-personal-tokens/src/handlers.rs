//! Axum handlers for the PAT surface.
//!
//! Auth is enforced by [`AuthUser`]. The JWT subject (`user.user_id`) is
//! used as both the tenancy gate and the owner of the PAT — a tenant-id
//! is sourced from the same field for now since SabNode's JWTs encode the
//! tenant as the user id at the root level. When the schema gains a
//! separate `tenant_id` claim, swap the assignments below.

use axum::{
    Json,
    extract::{Path, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::Result;
use sabnode_db::mongo::MongoHandle;

use crate::{
    dto::{GenerateBody, GenerateResult, ListResult, RevokeResult},
    store,
};

/// `POST /v1/personal-access-tokens` — generate a new PAT for the authenticated user.
pub async fn generate_pat(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<GenerateBody>,
) -> Result<Json<GenerateResult>> {
    let created = store::create(
        &mongo,
        &user.user_id, // tenant_id
        &user.user_id, // user_id (PAT owner)
        &body.name,
        body.scopes,
        body.tier,
        body.expires_at,
    )
    .await?;
    Ok(Json(GenerateResult {
        success: true,
        token: Some(created.plaintext),
        token_id: Some(created.id.to_hex()),
        error: None,
    }))
}

/// `GET /v1/personal-access-tokens` — list PATs owned by the authenticated user.
pub async fn list_pats(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<ListResult>> {
    let summaries = store::list(&mongo, &user.user_id, &user.user_id).await?;
    Ok(Json(summaries))
}

/// `PATCH /v1/personal-access-tokens/{token_id}/revoke` — soft-delete a PAT.
pub async fn revoke_pat(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(token_id): Path<String>,
) -> Result<Json<RevokeResult>> {
    let ok = store::revoke(&mongo, &user.user_id, &user.user_id, &token_id).await?;
    if ok {
        Ok(Json(RevokeResult {
            success: true,
            error: None,
        }))
    } else {
        Ok(Json(RevokeResult {
            success: false,
            error: Some("PAT not found or you do not have permission.".to_owned()),
        }))
    }
}
