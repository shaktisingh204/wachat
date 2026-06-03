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
        .route("/count", get(count_user))
        .route("/admin/count-global", post(count_global))
        // Multipart entrypoint — Server Action forwards FormData here.
        .route("/from-form/create", post(crate::from_form::create_qr_code))
        // Stats must come before the parameterised /{id} route so Axum sees it.
        .route("/{id}/stats", get(scan_stats))
        .route(
            "/{id}",
            get(get_one).patch(update_one).delete(delete_qr_code),
        )
}

#[derive(serde::Serialize)]
struct CountResp {
    count: u64,
}

async fn count_user(user: AuthUser, State(s): State<QrCodesState>) -> Result<Json<CountResp>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(CountResp {
        count: store::count_for_user(&s.mongo, oid).await?,
    }))
}

async fn count_global(user: AuthUser, State(s): State<QrCodesState>) -> Result<Json<CountResp>> {
    if !user.roles.iter().any(|r| r == "admin") {
        return Err(sabnode_common::ApiError::Forbidden(
            "admin role required".to_owned(),
        ));
    }
    Ok(Json(CountResp {
        count: store::count_global(&s.mongo).await?,
    }))
}

async fn list_qr_codes(user: AuthUser, State(s): State<QrCodesState>) -> Result<Json<Value>> {
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

async fn get_one(
    user: AuthUser,
    State(s): State<QrCodesState>,
    Path(id): Path<String>,
) -> Result<Json<Option<Value>>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::get_one(&s.mongo, oid, &id).await?))
}

async fn update_one(
    user: AuthUser,
    State(s): State<QrCodesState>,
    Path(id): Path<String>,
    Json(fields): Json<Value>,
) -> Result<Json<serde_json::Value>> {
    let oid = oid_from_str(&user.user_id)?;
    let matched = store::update(&s.mongo, oid, &id, fields).await?;
    Ok(Json(serde_json::json!({ "success": matched })))
}

async fn scan_stats(
    user: AuthUser,
    State(s): State<QrCodesState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::get_scan_stats(&s.mongo, oid, &id).await?))
}
