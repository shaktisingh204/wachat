//! Axum router mounting the 7 wachat-pay endpoints under `/v1/wachat/pay`
//! (caller nests the prefix).

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    routing::{get, post},
};
use bson::doc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use wachat_types::Project;

use crate::{config, state::WachatPayState, transactions};

const PROJECTS_COLL: &str = "projects";

/// Tenant-checked project loader. Mirrors
/// `wachat_config::router::load_project_for`.
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

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatPayState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/projects/{id}/configurations",
            get(list_configurations).post(create_configuration),
        )
        .route(
            "/projects/{id}/configurations/{name}",
            get(get_configuration).delete(delete_configuration),
        )
        .route(
            "/projects/{id}/configurations/{name}/data-endpoint",
            post(update_data_endpoint),
        )
        .route(
            "/projects/{id}/configurations/{name}/regenerate-oauth",
            post(regenerate_oauth),
        )
        .route(
            "/projects/{id}/configurations/{name}/sync-local",
            post(sync_local),
        )
        .route("/projects/{id}/transactions", get(list_transactions))
        .route(
            "/projects/{id}/transactions/{transaction_id}/refund",
            post(refund_transaction),
        )
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn list_configurations(
    user: AuthUser,
    State(s): State<WachatPayState>,
    Path(id): Path<String>,
) -> Result<Json<config::ListResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(config::list(&s.meta, &p).await?))
}

async fn get_configuration(
    user: AuthUser,
    State(s): State<WachatPayState>,
    Path((id, name)): Path<(String, String)>,
) -> Result<Json<config::ConfigResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(config::get_by_name(&s.meta, &p, &name).await?))
}

async fn create_configuration(
    user: AuthUser,
    State(s): State<WachatPayState>,
    Path(id): Path<String>,
    Json(body): Json<config::CreateConfigBody>,
) -> Result<Json<config::CreateResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(config::create(&s.meta, &p, body).await?))
}

async fn update_data_endpoint(
    user: AuthUser,
    State(s): State<WachatPayState>,
    Path((id, name)): Path<(String, String)>,
    Json(body): Json<config::UpdateDataEndpointBody>,
) -> Result<Json<serde_json::Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    config::update_data_endpoint(&s.meta, &p, &name, body).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn regenerate_oauth(
    user: AuthUser,
    State(s): State<WachatPayState>,
    Path((id, name)): Path<(String, String)>,
    Json(body): Json<config::RegenerateOauthBody>,
) -> Result<Json<config::OauthResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        config::regenerate_oauth(&s.meta, &p, &name, body).await?,
    ))
}

async fn delete_configuration(
    user: AuthUser,
    State(s): State<WachatPayState>,
    Path((id, name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    config::delete(&s.meta, &p, &name).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

async fn sync_local(
    user: AuthUser,
    State(s): State<WachatPayState>,
    Path((id, _name)): Path<(String, String)>,
    Json(body): Json<config::SyncLocalBody>,
) -> Result<Json<serde_json::Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    config::sync_local(&s.mongo, &p.id, body).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

/// `GET /projects/{id}/transactions` — list every `transactions` row for
/// the project, newest first. Mirrors the legacy
/// `getTransactionsForProject` server action.
async fn list_transactions(
    user: AuthUser,
    State(s): State<WachatPayState>,
    Path(id): Path<String>,
) -> Result<Json<transactions::TransactionsResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(transactions::list_for_project(&s.mongo, &p.id).await?))
}

async fn refund_transaction(
    user: AuthUser,
    State(s): State<WachatPayState>,
    Path((id, transaction_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    let (success, message) = transactions::refund_transaction(&s.mongo, &p.id, &transaction_id).await?;
    Ok(Json(serde_json::json!({ "success": success, "message": message })))
}
