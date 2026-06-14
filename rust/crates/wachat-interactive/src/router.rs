//! Axum router for interactive endpoints, mounted at `/v1/wachat/interactive`.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    routing::post,
};
use bson::doc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use wachat_types::Project;

use crate::{send, state::WachatInteractiveState};

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

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatInteractiveState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/projects/{id}/cta-url", post(cta_url))
        .route("/projects/{id}/location-request", post(location_request))
        .route("/projects/{id}/send", post(send_passthrough))
}

async fn cta_url(
    user: AuthUser,
    State(s): State<WachatInteractiveState>,
    Path(id): Path<String>,
    Json(body): Json<send::CtaUrlBody>,
) -> Result<Json<send::SendResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(send::cta_url(&s.meta, &p, body).await?))
}

async fn location_request(
    user: AuthUser,
    State(s): State<WachatInteractiveState>,
    Path(id): Path<String>,
    Json(body): Json<send::LocationRequestBody>,
) -> Result<Json<send::SendResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(send::location_request(&s.meta, &p, body).await?))
}

async fn send_passthrough(
    user: AuthUser,
    State(s): State<WachatInteractiveState>,
    Path(id): Path<String>,
    Json(body): Json<send::PassthroughBody>,
) -> Result<Json<send::SendResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(send::passthrough(&s.meta, &p, body).await?))
}
