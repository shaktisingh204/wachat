//! Axum router for `/v1/qr-codes/*` (caller nests the prefix).
//!
//! All routes are user-scoped: the AuthUser's `user_id` is the only tenancy
//! gate (every Mongo query filters on `userId`). There is no project-scope
//! check because saved QR codes are owned by the user, not a project — same
//! as the legacy server actions.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    routing::{get, post},
};
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::Result;
use sabnode_db::bson_helpers::oid_from_str;
use serde_json::Value;

use crate::{
    state::QrCodesState,
    store::{self, CreateBody, CreateResult, DeleteManyBody, DeleteManyResult, DeleteOneResult},
};

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    QrCodesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(list_qr_codes).post(create_qr_code))
        .route("/delete-many", post(delete_many))
        .route("/{id}", axum::routing::delete(delete_qr_code))
}

async fn list_qr_codes(
    user: AuthUser,
    State(s): State<QrCodesState>,
) -> Result<Json<Value>> {
    let oid = oid_from_str(&user.user_id)?;
    let docs = store::list(&s.mongo, oid).await?;
    Ok(Json(docs))
}

async fn create_qr_code(
    user: AuthUser,
    State(s): State<QrCodesState>,
    Json(body): Json<CreateBody>,
) -> Result<Json<CreateResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::create(&s.mongo, oid, body).await?))
}

async fn delete_qr_code(
    user: AuthUser,
    State(s): State<QrCodesState>,
    Path(id): Path<String>,
) -> Result<Json<DeleteOneResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::delete_one(&s.mongo, oid, &id).await?))
}

async fn delete_many(
    user: AuthUser,
    State(s): State<QrCodesState>,
    Json(body): Json<DeleteManyBody>,
) -> Result<Json<DeleteManyResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::delete_many(&s.mongo, oid, &body.ids).await?))
}
